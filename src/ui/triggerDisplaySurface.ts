import type { Mode, TriggerModule } from "../patch";

type TriggerDisplayParams = {
  module: TriggerModule;
  getStepPattern: () => string;
};

type TriggerDisplayApi = {
  wrap: HTMLElement;
  sync: (module: TriggerModule) => void;
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
  "step-sequencer": (canvas, module, params) => {
    canvas.appendChild(renderStepFamilyGrid(module, params.getStepPattern()));
  },
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
    host.append(renderStepFamilyGrid(module, params.getStepPattern()), renderEuclideanRing(module));
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

  const sync = (module: TriggerModule) => {
    modeCaption.textContent = `${MODE_LABELS[module.mode]} Display Surface`;
    renderMode(canvas, module, params);
  };

  sync(params.module);
  return { wrap, sync };
}

function renderMode(canvas: HTMLElement, module: TriggerModule, params: TriggerDisplayParams) {
  canvas.textContent = "";
  canvas.dataset.mode = module.mode;

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

function renderStepFamilyGrid(module: TriggerModule, patternPreview: string) {
  const grid = document.createElement("div");
  grid.className = "triggerDisplayStepGrid";

  const cols = clamp(module.length, 8, 32);
  const rows = clamp(module.subdiv + 1, 2, 8);
  grid.style.setProperty("--trigger-display-cols", String(cols));

  const compact = patternPreview.replace(/\s+/g, "");
  const count = cols * rows;

  for (let i = 0; i < count; i++) {
    const cell = document.createElement("span");
    const stepIndex = i % cols;
    const char = compact[stepIndex] ?? ".";
    const active = char !== ".";
    cell.className = `triggerDisplayCell ${active ? "on" : "off"}`;
    if (active && i >= cols) cell.classList.add("echo");
    grid.appendChild(cell);
  }

  return grid;
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
