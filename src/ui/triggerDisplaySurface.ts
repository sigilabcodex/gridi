import type { Mode, TriggerModule } from "../patch";

type TriggerDisplayParams = {
  module: TriggerModule;
  getStepPattern: () => string;
};

type TriggerDisplayApi = {
  wrap: HTMLElement;
  sync: (module: TriggerModule) => void;
};

type StepGridState = {
  basePattern: Uint8Array;
  overlayPattern: Int8Array;
  finalPattern: Uint8Array;
  pointerActive: boolean;
  pointerMode: "paint" | "erase";
  lastSeed: number;
  stepCount: number;
  cols: number;
  rows: number;
};

type DisplayRenderer = (canvas: HTMLElement, module: TriggerModule, params: TriggerDisplayParams) => void;

const MODE_LABELS: Record<Mode, string> = {
  "step-sequencer": "Step Sequencer",
  "cellular-automata": "Cellular Automata",
  euclidean: "Euclidean",
  "non-euclidean": "Non-Euclidean",
  fractal: "Fractal",
  hybrid: "Hybrid",
  "markov-chains": "Markov Chains",
  "l-systems": "L-Systems",
  xronomorph: "XronoMorph",
  "genetic-algorithms": "Genetic Algorithms",
  "one-over-f-noise": "1/f Noise",
};

const DISPLAY_RENDERERS: Partial<Record<Mode, DisplayRenderer>> = {
  euclidean: (canvas, module) => {
    canvas.appendChild(renderEuclideanRing(module));
  },
  "cellular-automata": (canvas, module) => {
    canvas.appendChild(renderCellularField(module));
  },
  fractal: (canvas, module) => {
    canvas.appendChild(renderFractalTrace(module));
  },
  hybrid: (canvas, module, params) => {
    const host = document.createElement("div");
    host.className = "triggerDisplayHybrid";
    host.append(renderStepPreviewGrid(module, params.getStepPattern()), renderEuclideanRing(module));
    canvas.appendChild(host);
  },
};

export function createTriggerDisplaySurface(params: TriggerDisplayParams): TriggerDisplayApi {
  const wrap = document.createElement("div");
  wrap.className = "triggerDisplaySurface";

  const modeCaption = document.createElement("div");
  modeCaption.className = "triggerDisplayCaption small";

  const canvas = document.createElement("div");
  canvas.className = "triggerDisplayCanvas";

  wrap.append(modeCaption, canvas);
  const stepGridState: StepGridState = {
    basePattern: new Uint8Array(0),
    overlayPattern: new Int8Array(0),
    finalPattern: new Uint8Array(0),
    pointerActive: false,
    pointerMode: "paint",
    lastSeed: params.module.seed,
    stepCount: 0,
    cols: 16,
    rows: 2,
  };

  const sync = (module: TriggerModule) => {
    modeCaption.textContent = `${MODE_LABELS[module.mode]} Display Surface`;
    renderMode(canvas, module, params, stepGridState);
  };

  sync(params.module);
  return { wrap, sync };
}

function renderMode(canvas: HTMLElement, module: TriggerModule, params: TriggerDisplayParams, stepGridState: StepGridState) {
  canvas.textContent = "";
  canvas.dataset.mode = module.mode;

  if (module.mode === "step-sequencer") {
    renderStepRenderer(canvas, module, params, stepGridState);
    return;
  }

  const renderer = DISPLAY_RENDERERS[module.mode];
  if (renderer) {
    renderer(canvas, module, params);
    return;
  }

  canvas.appendChild(renderModePlaceholder(module.mode));
}

function renderModePlaceholder(mode: Mode) {
  const placeholder = document.createElement("div");
  placeholder.className = "triggerDisplayPlaceholder";

  const title = document.createElement("strong");
  title.textContent = MODE_LABELS[mode];

  const hint = document.createElement("span");
  hint.textContent = "Renderer host ready. Mode-specific visualization is planned for next pass.";

  placeholder.append(title, hint);
  return placeholder;
}

function renderStepRenderer(canvas: HTMLElement, module: TriggerModule, params: TriggerDisplayParams, state: StepGridState) {
  const layout = resolveStepGridLayout(module.length, module.subdiv);
  const stepCount = layout.cols * layout.rows;
  const basePattern = parsePatternPreview(params.getStepPattern(), stepCount);

  if (state.lastSeed !== module.seed || state.stepCount !== stepCount) {
    state.overlayPattern = new Int8Array(stepCount);
  } else if (state.overlayPattern.length !== stepCount) {
    const nextOverlay = new Int8Array(stepCount);
    nextOverlay.set(state.overlayPattern.subarray(0, Math.min(stepCount, state.overlayPattern.length)));
    state.overlayPattern = nextOverlay;
  }

  state.lastSeed = module.seed;
  state.basePattern = basePattern;
  state.stepCount = stepCount;
  state.cols = layout.cols;
  state.rows = layout.rows;
  state.finalPattern = mergePattern(basePattern, state.overlayPattern);

  canvas.appendChild(renderInteractiveStepGrid(module, state));
}

function renderInteractiveStepGrid(module: TriggerModule, state: StepGridState) {
  const grid = document.createElement("div");
  grid.className = "triggerDisplayStepGrid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", `${module.name} step overlay editor`);
  grid.style.setProperty("--trigger-display-cols", String(state.cols));

  for (let i = 0; i < state.stepCount; i++) {
    const cell = document.createElement("span");
    cell.className = "triggerDisplayCell";
    cell.dataset.index = String(i);
    cell.setAttribute("role", "gridcell");
    paintCell(cell, state, i);
    cell.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const erase = event.button === 2;
      state.pointerActive = true;
      state.pointerMode = erase ? "erase" : "paint";
      if (erase) writeOverlay(state, i, 0);
      else toggleOverlay(state, i);
      paintCell(cell, state, i);
    });
    cell.addEventListener("pointerenter", (event) => {
      if (!state.pointerActive) return;
      if (!(event.buttons & 1) && !(event.buttons & 2)) {
        state.pointerActive = false;
        return;
      }
      writeOverlay(state, i, state.pointerMode === "paint" ? 1 : 0);
      paintCell(cell, state, i);
    });
    grid.appendChild(cell);
  }

  grid.addEventListener("contextmenu", (event) => event.preventDefault());
  const endPointer = () => {
    state.pointerActive = false;
  };
  grid.addEventListener("pointerup", endPointer);
  grid.addEventListener("pointerleave", (event) => {
    if (!(event.buttons & 1) && !(event.buttons & 2)) endPointer();
  });

  return grid;
}

function renderStepPreviewGrid(module: TriggerModule, patternPreview: string) {
  const layout = resolveStepGridLayout(module.length, module.subdiv);
  const steps = layout.cols * layout.rows;
  const basePattern = parsePatternPreview(patternPreview, steps);
  const grid = document.createElement("div");
  grid.className = "triggerDisplayStepGrid";
  grid.style.setProperty("--trigger-display-cols", String(layout.cols));
  for (let i = 0; i < steps; i++) {
    const cell = document.createElement("span");
    cell.className = `triggerDisplayCell ${basePattern[i] === 1 ? "on" : "off"}`;
    if (basePattern[i] === 1 && i >= layout.cols) cell.classList.add("echo");
    grid.appendChild(cell);
  }
  return grid;
}

function paintCell(cell: HTMLElement, state: StepGridState, stepIndex: number) {
  const baseOn = state.basePattern[stepIndex] === 1;
  const finalOn = state.finalPattern[stepIndex] === 1;
  const overlay = state.overlayPattern[stepIndex];
  cell.classList.toggle("base-on", baseOn);
  cell.classList.toggle("on", finalOn);
  cell.classList.toggle("overlay-on", overlay === 1);
  cell.classList.toggle("overlay-off", overlay === -1);
}

function parsePatternPreview(patternPreview: string, steps: number) {
  const out = new Uint8Array(steps);
  const compact = patternPreview.replace(/\s+/g, "");
  for (let i = 0; i < steps; i++) {
    const char = compact[i] ?? ".";
    out[i] = char === "·" || char === "." ? 0 : 1;
  }
  return out;
}

function mergePattern(basePattern: Uint8Array, overlayPattern: Int8Array) {
  const out = new Uint8Array(basePattern.length);
  for (let i = 0; i < basePattern.length; i++) {
    const overlay = overlayPattern[i] ?? 0;
    out[i] = overlay === 0 ? basePattern[i] : overlay === 1 ? 1 : 0;
  }
  return out;
}

function toggleOverlay(state: StepGridState, index: number) {
  const base = state.basePattern[index] ?? 0;
  const currentOverlay = state.overlayPattern[index] ?? 0;
  if (currentOverlay !== 0) writeOverlay(state, index, 0);
  else writeOverlay(state, index, base ? 0 : 1);
}

function writeOverlay(state: StepGridState, index: number, nextFinalValue: 0 | 1) {
  const base = state.basePattern[index] ?? 0;
  state.overlayPattern[index] = nextFinalValue === base ? 0 : nextFinalValue ? 1 : -1;
  state.finalPattern = mergePattern(state.basePattern, state.overlayPattern);
}

function resolveStepGridLayout(length: number, subdiv: number) {
  const clampedLength = clamp(Math.round(length), 1, 128);
  let rows = clamp(Math.round(subdiv), 1, 8);
  let cols = Math.ceil(clampedLength / rows);
  while (cols > 32 && rows < 8) {
    rows += 1;
    cols = Math.ceil(clampedLength / rows);
  }
  cols = clamp(cols, 1, 32);
  rows = Math.ceil(clampedLength / cols);
  return { cols, rows };
}

function renderEuclideanRing(module: TriggerModule) {
  const ring = document.createElement("div");
  ring.className = "triggerDisplayEuclideanRing";

  const steps = clamp(module.length, 8, 24);
  const pulses = Math.max(1, Math.round(steps * module.density));

  for (let i = 0; i < steps; i++) {
    const dot = document.createElement("span");
    dot.className = "triggerDisplayEuclideanDot";
    const angle = (Math.PI * 2 * i) / steps - Math.PI / 2;
    const x = Math.cos(angle) * 38;
    const y = Math.sin(angle) * 38;
    dot.style.setProperty("--dot-x", `${x.toFixed(2)}px`);
    dot.style.setProperty("--dot-y", `${y.toFixed(2)}px`);
    if (i < pulses) dot.classList.add("on");
    ring.appendChild(dot);
  }

  return ring;
}

function renderCellularField(module: TriggerModule) {
  const field = document.createElement("div");
  field.className = "triggerDisplayCellular";

  const cols = clamp(Math.round(module.length / 2), 8, 20);
  const rows = 8;
  field.style.setProperty("--trigger-display-cols", String(cols));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = document.createElement("span");
      const index = row * cols + col;
      const value = hash01(module.seed + index * 17 + module.caRule * 131 + Math.round(module.caInit * 1000));
      const threshold = 0.62 - module.caInit * 0.36 + row * 0.012;
      const active = value > threshold;
      cell.className = `triggerDisplayCell ${active ? "on" : "off"}`;
      if (active && value > 0.88) cell.classList.add("accent");
      field.appendChild(cell);
    }
  }

  return field;
}

function renderFractalTrace(module: TriggerModule) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 220 90");
  svg.setAttribute("class", "triggerDisplayFractal");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "triggerDisplayFractalPath");

  const points: string[] = [];
  for (let step = 0; step <= 32; step++) {
    const x = 8 + step * 6.3;
    const n1 = hash01(module.seed + step * 97);
    const n2 = hash01(module.seed + step * 41 + Math.round(module.weird * 200));
    const level = Math.sin((step / 32) * Math.PI * (1.2 + module.determinism)) * (0.35 + module.gravity * 0.4);
    const y = 72 - (n1 * 22 + n2 * 14 + level * 26);
    points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  path.setAttribute("d", `M ${points.join(" L ")}`);
  svg.append(path);
  return svg;
}

function hash01(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
