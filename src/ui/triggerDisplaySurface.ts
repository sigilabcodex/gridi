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
  cells: HTMLElement[];
  lastPlayhead: number;
};

type DisplayView = {
  root: HTMLElement;
  sync: (module: TriggerModule, params: TriggerDisplayParams, stepState: StepGridState) => void;
  tick?: (timeMs: number, module: TriggerModule, params: TriggerDisplayParams, stepState: StepGridState) => void;
};

type PatternDotState = {
  dots: HTMLElement[];
  steps: number;
  pattern: Uint8Array;
  lastPlayhead: number;
};

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

export function createTriggerDisplaySurface(params: TriggerDisplayParams): TriggerDisplayApi {
  const wrap = document.createElement("div");
  wrap.className = "triggerDisplaySurface";

  const canvas = document.createElement("div");
  canvas.className = "triggerDisplayCanvas";

  wrap.append(canvas);

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
    cells: [],
    lastPlayhead: -1,
  };

  let moduleRef = params.module;
  let activeMode: Mode | null = null;
  let view: DisplayView | null = null;
  let rafId = 0;

  const ensureView = () => {
    if (view && activeMode === moduleRef.mode) return;
    canvas.textContent = "";
    activeMode = moduleRef.mode;
    view = createViewForMode(moduleRef.mode, moduleRef, params, stepGridState);
    canvas.appendChild(view.root);
    view.sync(moduleRef, params, stepGridState);
  };

  const tick = (timeMs: number) => {
    if (!wrap.isConnected) return;
    ensureView();
    view?.tick?.(timeMs, moduleRef, params, stepGridState);
    rafId = window.requestAnimationFrame(tick);
  };

  const sync = (module: TriggerModule) => {
    moduleRef = module;
    ensureView();
    view?.sync(module, params, stepGridState);
    if (!rafId) rafId = window.requestAnimationFrame(tick);
  };

  sync(params.module);
  return { wrap, sync };
}

function createViewForMode(mode: Mode, module: TriggerModule, params: TriggerDisplayParams, stepState: StepGridState): DisplayView {
  if (mode === "step-sequencer") return createStepSequencerView(module, params, stepState);
  if (mode === "euclidean") return createEuclideanView();
  if (mode === "cellular-automata") return createCellularView();
  if (mode === "fractal") return createFractalView();
  if (mode === "non-euclidean") return createNonEuclideanView();
  if (mode === "hybrid") return createHybridView(params);
  if (mode === "markov-chains") return createMarkovView();
  if (mode === "l-systems") return createLSystemsView();
  if (mode === "xronomorph") return createXronoMorphView(params);
  if (mode === "genetic-algorithms") return createGeneticView();
  if (mode === "one-over-f-noise") return createOneOverFView();

  const placeholder = renderModePlaceholder(mode);
  return {
    root: placeholder,
    sync: () => {},
  };
}

function createStepSequencerView(module: TriggerModule, params: TriggerDisplayParams, state: StepGridState): DisplayView {
  const root = document.createElement("div");
  const grid = renderInteractiveStepGrid(module, state);
  root.appendChild(grid);

  return {
    root,
    sync: (nextModule) => {
      const layout = resolveStepGridLayout(nextModule.length, nextModule.subdiv);
      const stepCount = layout.cols * layout.rows;
      const basePattern = parsePatternPreview(params.getStepPattern(), stepCount);

      if (state.lastSeed !== nextModule.seed || state.stepCount !== stepCount) {
        state.overlayPattern = new Int8Array(stepCount);
      } else if (state.overlayPattern.length !== stepCount) {
        const nextOverlay = new Int8Array(stepCount);
        nextOverlay.set(state.overlayPattern.subarray(0, Math.min(stepCount, state.overlayPattern.length)));
        state.overlayPattern = nextOverlay;
      }

      state.lastSeed = nextModule.seed;
      state.basePattern = basePattern;
      state.stepCount = stepCount;
      state.cols = layout.cols;
      state.rows = layout.rows;
      state.finalPattern = mergePattern(basePattern, state.overlayPattern);

      const needsRebuild = state.cells.length !== stepCount || grid.style.getPropertyValue("--trigger-display-cols") !== String(layout.cols);
      if (needsRebuild) {
        const nextGrid = renderInteractiveStepGrid(nextModule, state);
        root.replaceChildren(nextGrid);
      } else {
        state.cells.forEach((cell, i) => paintCell(cell, state, i));
      }
    },
    tick: (timeMs, liveModule) => {
      if (!state.cells.length || !state.stepCount) return;
      const stepIndex = resolveAnimatedStepIndex(timeMs, liveModule, state.stepCount);
      if (stepIndex === state.lastPlayhead) return;
      if (state.lastPlayhead >= 0) state.cells[state.lastPlayhead]?.classList.remove("is-playhead");
      state.cells[stepIndex]?.classList.add("is-playhead");
      state.lastPlayhead = stepIndex;
    },
  };
}

function createEuclideanView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayEuclideanWrap";

  const ring = document.createElement("div");
  ring.className = "triggerDisplayEuclideanRing";
  const indicator = document.createElement("span");
  indicator.className = "triggerDisplayEuclideanIndicator";
  ring.appendChild(indicator);
  root.appendChild(ring);

  const dotState: PatternDotState = { dots: [], steps: 0, pattern: new Uint8Array(0), lastPlayhead: -1 };

  return {
    root,
    sync: (nextModule) => {
      const steps = clamp(Math.round(nextModule.length), 8, 24);
      dotState.steps = steps;
      dotState.pattern = generateEuclideanPattern(nextModule, steps);
      dotState.lastPlayhead = -1;
      ring.querySelectorAll(".triggerDisplayEuclideanDot").forEach((el) => el.remove());
      dotState.dots = [];

      for (let i = 0; i < steps; i++) {
        const dot = document.createElement("span");
        dot.className = "triggerDisplayEuclideanDot";
        const angle = (Math.PI * 2 * i) / steps - Math.PI / 2;
        const x = Math.cos(angle) * 38;
        const y = Math.sin(angle) * 38;
        dot.style.setProperty("--dot-x", `${x.toFixed(2)}px`);
        dot.style.setProperty("--dot-y", `${y.toFixed(2)}px`);
        if (dotState.pattern[i] === 1) dot.classList.add("on");
        ring.appendChild(dot);
        dotState.dots.push(dot);
      }
    },
    tick: (timeMs, liveModule) => {
      if (!dotState.steps) return;
      const playhead = resolveAnimatedStepIndex(timeMs, liveModule, dotState.steps);
      if (playhead === dotState.lastPlayhead) return;
      if (dotState.lastPlayhead >= 0) dotState.dots[dotState.lastPlayhead]?.classList.remove("is-playhead");
      dotState.dots[playhead]?.classList.add("is-playhead");
      dotState.lastPlayhead = playhead;
      const angle = (Math.PI * 2 * playhead) / dotState.steps - Math.PI / 2;
      indicator.style.setProperty("--dot-x", `${(Math.cos(angle) * 46).toFixed(2)}px`);
      indicator.style.setProperty("--dot-y", `${(Math.sin(angle) * 46).toFixed(2)}px`);
    },
  };
}

function createCellularView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayCellular";
  const cells: HTMLElement[] = [];
  let cols = 8;
  let rows = 8;

  return {
    root,
    sync: (nextModule) => {
      cols = clamp(Math.round(nextModule.length / 2), 8, 20);
      rows = clamp(6 + Math.round(nextModule.subdiv), 6, 12);
      root.style.setProperty("--trigger-display-cols", String(cols));
      const total = cols * rows;

      if (cells.length !== total) {
        root.textContent = "";
        cells.length = 0;
        for (let i = 0; i < total; i++) {
          const cell = document.createElement("span");
          cell.className = "triggerDisplayCell";
          root.appendChild(cell);
          cells.push(cell);
        }
      }

      const generations = buildCARows(nextModule, rows, cols);
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          const active = generations[row]?.[col] === 1;
          const cell = cells[idx];
          cell.classList.toggle("on", active);
          cell.classList.toggle("accent", active && row % Math.max(2, Math.round(5 - nextModule.weird * 3)) === 0);
          cell.classList.remove("is-playhead", "is-secondary");
        }
      }
    },
    tick: (timeMs, liveModule) => {
      if (!cells.length) return;
      const lead = resolveAnimatedStepIndex(timeMs, liveModule, rows);
      const tail = (lead - 1 + rows) % rows;
      for (let row = 0; row < rows; row++) {
        const hot = row === lead;
        const warm = row === tail;
        for (let col = 0; col < cols; col++) {
          const cell = cells[row * cols + col];
          cell.classList.toggle("is-playhead", hot);
          cell.classList.toggle("is-secondary", warm);
        }
      }
    },
  };
}

function createFractalView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayFractalWrap";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 220 90");
  svg.setAttribute("class", "triggerDisplayFractal");

  const pathMain = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathMain.setAttribute("class", "triggerDisplayFractalPath");
  const pathEcho = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathEcho.setAttribute("class", "triggerDisplayFractalPath triggerDisplayFractalPath--echo");
  const cursor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  cursor.setAttribute("class", "triggerDisplayFractalCursor");
  cursor.setAttribute("r", "2.8");
  svg.append(pathEcho, pathMain, cursor);
  root.append(svg);

  let points: Array<{ x: number; y: number }> = [];

  return {
    root,
    sync: (nextModule) => {
      points = buildFractalPoints(nextModule, 34);
      pathMain.setAttribute("d", `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`);
      const echoed = points.map((point, idx) => ({ x: point.x, y: clamp(point.y + Math.sin(idx * 0.7 + nextModule.gravity * 2) * (2 + nextModule.weird * 6), 8, 84) }));
      pathEcho.setAttribute("d", `M ${echoed.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`);
    },
    tick: (timeMs, liveModule) => {
      if (!points.length) return;
      const index = resolveAnimatedStepIndex(timeMs, liveModule, points.length);
      const pt = points[index];
      cursor.setAttribute("cx", pt.x.toFixed(2));
      cursor.setAttribute("cy", pt.y.toFixed(2));
    },
  };
}

function createHybridView(params: TriggerDisplayParams): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayHybrid";

  const stepGrid = document.createElement("div");
  const ringView = createEuclideanView();
  const meter = document.createElement("div");
  meter.className = "triggerDisplayHybridMeter";
  const meterFill = document.createElement("span");
  meterFill.className = "triggerDisplayHybridMeterFill";
  meter.appendChild(meterFill);

  root.append(stepGrid, ringView.root, meter);

  return {
    root,
    sync: (nextModule) => {
      const preview = renderStepPreviewGrid(nextModule, params.getStepPattern());
      stepGrid.replaceChildren(preview);
      ringView.sync(nextModule, params, {
        basePattern: new Uint8Array(0), overlayPattern: new Int8Array(0), finalPattern: new Uint8Array(0),
        pointerActive: false, pointerMode: "paint", lastSeed: nextModule.seed, stepCount: 0, cols: 0, rows: 0, cells: [], lastPlayhead: -1,
      });
      const blend = clamp(nextModule.determinism * 0.6 + nextModule.gravity * 0.4, 0, 1);
      meterFill.style.setProperty("--hybrid-blend", blend.toFixed(3));
      meterFill.style.width = `${Math.round(blend * 100)}%`;
    },
    tick: (timeMs, liveModule, liveParams, liveStepState) => {
      ringView.tick?.(timeMs, liveModule, liveParams, liveStepState);
    },
  };
}

function createNonEuclideanView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayNonEuclidean";
  const bars: HTMLElement[] = [];
  let segments = 0;
  let lastPlayhead = -1;

  return {
    root,
    sync: (nextModule) => {
      segments = clamp(4 + Math.round(nextModule.weird * 10 + nextModule.gravity * 4), 4, 14);
      if (bars.length !== segments) {
        root.textContent = "";
        bars.length = 0;
        for (let i = 0; i < segments; i++) {
          const bar = document.createElement("span");
          bar.className = "triggerDisplayNonEuclideanSegment";
          root.appendChild(bar);
          bars.push(bar);
        }
      }
      lastPlayhead = -1;
      for (let i = 0; i < segments; i++) {
        const t = i / Math.max(1, segments - 1);
        const warp = Math.pow(t, 0.65 + nextModule.weird * 1.6);
        const height = 24 + warp * 70;
        const active = hash01(nextModule.seed + i * 59) < clamp(nextModule.density * (0.65 + (i % 3) * 0.12), 0.04, 0.95);
        bars[i].style.height = `${height.toFixed(2)}%`;
        bars[i].classList.toggle("on", active);
        bars[i].classList.remove("is-playhead");
      }
    },
    tick: (timeMs, liveModule) => {
      if (!segments) return;
      const playhead = resolveAnimatedStepIndex(timeMs, liveModule, segments);
      if (playhead === lastPlayhead) return;
      if (lastPlayhead >= 0) bars[lastPlayhead]?.classList.remove("is-playhead");
      bars[playhead]?.classList.add("is-playhead");
      lastPlayhead = playhead;
    },
  };
}

function createMarkovView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayMarkov";
  const nodeWrap = document.createElement("div");
  nodeWrap.className = "triggerDisplayMarkovNodes";
  const matrix = document.createElement("div");
  matrix.className = "triggerDisplayMarkovMatrix";
  const matrixCells: HTMLElement[] = [];
  const nodes: HTMLElement[] = [];
  const transitions: HTMLElement[] = [];
  root.append(nodeWrap, matrix);
  let lastState = 0;

  for (let i = 0; i < 4; i++) {
    const node = document.createElement("span");
    node.className = "triggerDisplayMarkovNode";
    node.textContent = String(i + 1);
    nodeWrap.appendChild(node);
    nodes.push(node);
  }
  for (let i = 0; i < 4; i++) {
    const tr = document.createElement("span");
    tr.className = "triggerDisplayMarkovTransition";
    nodeWrap.appendChild(tr);
    transitions.push(tr);
  }

  for (let i = 0; i < 16; i++) {
    const cell = document.createElement("span");
    cell.className = "triggerDisplayMarkovCell";
    matrix.appendChild(cell);
    matrixCells.push(cell);
  }

  return {
    root,
    sync: (nextModule) => {
      const stay = clamp(0.32 + nextModule.determinism * 0.58 - nextModule.weird * 0.25, 0.05, 0.95);
      const bias = clamp(nextModule.gravity, 0, 1);
      const matrixData = [
        [stay, 0.45 * (1 - stay) + bias * 0.2, 0.25 * (1 - stay), 0.3 * (1 - stay) - bias * 0.05],
        [0.2 * (1 - stay), stay, 0.5 * (1 - stay) + nextModule.weird * 0.08, 0.3 * (1 - stay)],
        [0.3 * (1 - stay), 0.22 * (1 - stay), stay, 0.48 * (1 - stay) + bias * 0.08],
        [0.36 * (1 - stay), 0.24 * (1 - stay), 0.2 * (1 - stay), stay],
      ];

      for (let r = 0; r < 4; r++) {
        const rowSum = matrixData[r].reduce((sum, value) => sum + value, 0) || 1;
        for (let c = 0; c < 4; c++) {
          const prob = matrixData[r][c] / rowSum;
          const cell = matrixCells[r * 4 + c];
          cell.style.opacity = (0.24 + prob * 0.9).toFixed(3);
          cell.textContent = `${Math.round(prob * 100)}`;
        }
      }

      transitions.forEach((edge, i) => edge.classList.toggle("hot", i === (nextModule.seed % transitions.length)));
    },
    tick: (timeMs, liveModule) => {
      const phase = resolveAnimatedStepIndex(timeMs, liveModule, 64);
      const nextState = phase % 4;
      if (nextState === lastState) return;
      nodes[lastState]?.classList.remove("is-playhead");
      const transitionIndex = (lastState * 3 + nextState) % transitions.length;
      transitions.forEach((edge, i) => edge.classList.toggle("is-playhead", i === transitionIndex));
      nodes[nextState]?.classList.add("is-playhead");
      lastState = nextState;
    },
  };
}

function createLSystemsView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayLSystem";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 220 90");
  svg.setAttribute("class", "triggerDisplayLSystemSvg");
  const branches = document.createElementNS("http://www.w3.org/2000/svg", "path");
  branches.setAttribute("class", "triggerDisplayLSystemBranch");
  const tracer = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  tracer.setAttribute("class", "triggerDisplayLSystemTracer");
  tracer.setAttribute("r", "2.2");
  svg.append(branches, tracer);
  root.appendChild(svg);
  let points: Array<{ x: number; y: number }> = [];

  return {
    root,
    sync: (nextModule) => {
      points = buildLSystemPoints(nextModule, 42);
      branches.setAttribute("d", pointsToPath(points));
    },
    tick: (timeMs, liveModule) => {
      if (!points.length) return;
      const i = resolveAnimatedStepIndex(timeMs, liveModule, points.length);
      tracer.setAttribute("cx", points[i].x.toFixed(2));
      tracer.setAttribute("cy", points[i].y.toFixed(2));
    },
  };
}

function createXronoMorphView(params: TriggerDisplayParams): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayXronoMorph";
  const laneA = document.createElement("div");
  laneA.className = "triggerDisplayXronoLane";
  const laneB = document.createElement("div");
  laneB.className = "triggerDisplayXronoLane triggerDisplayXronoLane--alt";
  const merge = document.createElement("div");
  merge.className = "triggerDisplayXronoMerge";
  root.append(laneA, laneB, merge);
  let cellsA: HTMLElement[] = [];
  let cellsB: HTMLElement[] = [];
  let cellsM: HTMLElement[] = [];

  return {
    root,
    sync: (nextModule) => {
      const layout = resolveStepGridLayout(nextModule.length, nextModule.subdiv);
      const steps = clamp(layout.cols * layout.rows, 12, 48);
      const patternA = parsePatternPreview(params.getStepPattern(), steps);
      const patternB = createMorphPattern(nextModule, steps);
      const patternM = new Uint8Array(steps);
      for (let i = 0; i < steps; i++) patternM[i] = (i % 2 === 0 ? patternA[i] : patternB[i]) || (nextModule.weird > 0.55 && (patternA[i] ^ patternB[i]) ? 1 : 0);
      cellsA = renderLinearCells(laneA, cellsA, steps, patternA);
      cellsB = renderLinearCells(laneB, cellsB, steps, patternB);
      cellsM = renderLinearCells(merge, cellsM, steps, patternM);
    },
    tick: (timeMs, liveModule) => {
      if (!cellsM.length) return;
      const i = resolveAnimatedStepIndex(timeMs, liveModule, cellsM.length);
      paintPlayhead(cellsA, i);
      paintPlayhead(cellsB, (i + 2) % cellsB.length);
      paintPlayhead(cellsM, i);
    },
  };
}

function createGeneticView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayGenetic";
  const rows: HTMLElement[] = [];
  const rowCount = 4;
  let cols = 16;

  for (let r = 0; r < rowCount; r++) {
    const row = document.createElement("div");
    row.className = "triggerDisplayGeneticRow";
    root.appendChild(row);
    rows.push(row);
  }

  return {
    root,
    sync: (nextModule) => {
      cols = clamp(Math.round(nextModule.length), 12, 32);
      rows.forEach((row, idx) => {
        const pattern = createGeneticRow(nextModule, cols, idx);
        const existing = Array.from(row.children) as HTMLElement[];
        const cells = renderLinearCells(row, existing, cols, pattern);
        const fitness = evaluateFitness(pattern, nextModule);
        row.style.setProperty("--genetic-fit", fitness.toFixed(3));
        cells.forEach((cell) => cell.classList.toggle("elite", idx === 0));
      });
    },
    tick: (timeMs, liveModule) => {
      const i = resolveAnimatedStepIndex(timeMs, liveModule, cols);
      rows.forEach((row, idx) => {
        const cells = Array.from(row.children) as HTMLElement[];
        paintPlayhead(cells, (i + idx) % Math.max(1, cells.length));
      });
    },
  };
}

function createOneOverFView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayOneOverF";
  const path = document.createElement("div");
  path.className = "triggerDisplayOneOverFPath";
  const grid = document.createElement("div");
  grid.className = "triggerDisplayOneOverFGrid";
  root.append(path, grid);
  let values: number[] = [];
  let cells: HTMLElement[] = [];

  return {
    root,
    sync: (nextModule) => {
      values = buildOneOverFValues(nextModule, 34);
      path.style.setProperty("--oneoverf-points", values.map((v, i) => `${(i / 33) * 100}% ${(1 - v) * 100}%`).join(","));
      const pattern = Uint8Array.from(values.map((v) => (v < nextModule.density ? 1 : 0)));
      cells = renderLinearCells(grid, cells, pattern.length, pattern);
    },
    tick: (timeMs, liveModule) => {
      if (!cells.length) return;
      const i = resolveAnimatedStepIndex(timeMs, liveModule, cells.length);
      paintPlayhead(cells, i);
    },
  };
}

function renderModePlaceholder(mode: Mode) {
  const placeholder = document.createElement("div");
  placeholder.className = "triggerDisplayPlaceholder";

  const title = document.createElement("strong");
  title.textContent = MODE_LABELS[mode];

  const hint = document.createElement("span");
  hint.textContent = "Mode renderer is intentionally deferred in this pass.";

  placeholder.append(title, hint);
  return placeholder;
}

function renderInteractiveStepGrid(module: TriggerModule, state: StepGridState) {
  const grid = document.createElement("div");
  grid.className = "triggerDisplayStepGrid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", `${module.name} step overlay editor`);
  grid.style.setProperty("--trigger-display-cols", String(state.cols));
  state.cells = [];

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
    state.cells.push(cell);
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

function resolveAnimatedStepIndex(timeMs: number, module: TriggerModule, steps: number) {
  const speedBase = 0.45 + (module.subdiv - 1) * 0.15;
  const speedShape = module.weird * 0.25 + module.gravity * 0.18;
  const cycleSeconds = clamp(2.2 - speedBase - speedShape, 0.45, 3.2);
  const phase = ((timeMs / 1000) / cycleSeconds + module.seed * 0.00021 + module.euclidRot * 0.007) % 1;
  return clamp(Math.floor(phase * steps), 0, Math.max(0, steps - 1));
}

function generateEuclideanPattern(module: TriggerModule, steps: number) {
  const pulses = clamp(Math.round(steps * module.density), 0, steps);
  const base = bjorklund(steps, pulses);
  const rotated = rotatePattern(base, module.euclidRot);
  const out = new Uint8Array(steps);
  const jitter = clamp(module.weird, 0, 1);
  for (let i = 0; i < steps; i++) {
    let bit = rotated[i];
    if (jitter > 0.001 && hash01(module.seed + i * 17) < jitter * 0.22) bit = bit ? 0 : 1;
    if (bit && hash01(module.seed + i * 41 + module.drop * 1000) < module.drop * 0.5) bit = 0;
    out[i] = bit;
  }
  return out;
}

function buildCARows(module: TriggerModule, rows: number, cols: number) {
  const rule = (module.caRule | 0) & 255;
  const seedRow = new Uint8Array(cols);
  const initProb = clamp(module.caInit * 0.75 + module.density * 0.25, 0, 1);
  for (let i = 0; i < cols; i++) seedRow[i] = hash01(module.seed + i * 31) < initProb ? 1 : 0;

  const generations: Uint8Array[] = [seedRow];
  for (let row = 1; row < rows; row++) {
    const prev = generations[row - 1];
    const next = new Uint8Array(cols);
    for (let col = 0; col < cols; col++) {
      const left = prev[(col - 1 + cols) % cols];
      const center = prev[col];
      const right = prev[(col + 1) % cols];
      const idx = (left << 2) | (center << 1) | right;
      let bit = (rule >> idx) & 1;
      if (module.weird > 0.001 && hash01(module.seed + row * 181 + col * 19) < module.weird * 0.08) bit = bit ? 0 : 1;
      if (bit && hash01(module.seed + row * 97 + col * 13) < module.drop * 0.45) bit = 0;
      next[col] = bit;
    }
    generations.push(next);
  }
  return generations;
}

function buildFractalPoints(module: TriggerModule, pointCount: number) {
  const points: Array<{ x: number; y: number }> = [];
  const branch = 0.3 + module.gravity * 0.6;
  const sym = 0.2 + module.determinism * 0.7;
  for (let step = 0; step < pointCount; step++) {
    const x = 8 + step * (204 / (pointCount - 1));
    const t = step / Math.max(1, pointCount - 1);
    const n1 = hash01(module.seed + step * 97);
    const n2 = hash01(module.seed + step * 41 + Math.round(module.weird * 200));
    const harmonic = Math.sin(t * Math.PI * (1.5 + sym * 3));
    const folded = Math.cos(t * Math.PI * (2 + branch * 4) + module.euclidRot * 0.12);
    const y = 72 - (harmonic * (12 + branch * 22) + folded * (6 + module.weird * 14) + (n1 * 8 + n2 * 6));
    points.push({ x, y: clamp(y, 8, 84) });
  }
  return points;
}

function bjorklund(steps: number, pulses: number) {
  const clampedSteps = Math.max(1, steps | 0);
  const clampedPulses = Math.max(0, Math.min(clampedSteps, pulses | 0));
  if (clampedPulses === 0) return new Uint8Array(clampedSteps);
  if (clampedPulses === clampedSteps) return Uint8Array.from({ length: clampedSteps }, () => 1);

  const pattern: number[] = [];
  const counts: number[] = [];
  const remainders: number[] = [];
  let divisor = clampedSteps - clampedPulses;
  remainders.push(clampedPulses);
  let level = 0;

  while (true) {
    counts.push(Math.floor(divisor / remainders[level]));
    remainders.push(divisor % remainders[level]);
    divisor = remainders[level];
    level += 1;
    if (remainders[level] <= 1) break;
  }
  counts.push(divisor);

  const build = (currentLevel: number): void => {
    if (currentLevel === -1) pattern.push(0);
    else if (currentLevel === -2) pattern.push(1);
    else {
      for (let i = 0; i < counts[currentLevel]; i++) build(currentLevel - 1);
      if (remainders[currentLevel] !== 0) build(currentLevel - 2);
    }
  };
  build(level);

  const out = pattern.slice(0, clampedSteps);
  const firstOne = out.indexOf(1);
  const rot = firstOne > 0 ? firstOne : 0;
  return Uint8Array.from(out.slice(rot).concat(out.slice(0, rot)));
}

function rotatePattern(pattern: Uint8Array, rotation: number) {
  const n = pattern.length;
  if (n <= 1) return pattern;
  const rot = ((rotation | 0) % n + n) % n;
  if (rot === 0) return pattern;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = pattern[(i - rot + n) % n];
  return out;
}

function hash01(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pointsToPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  return `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`;
}

function buildLSystemPoints(module: TriggerModule, count: number) {
  const points: Array<{ x: number; y: number }> = [];
  let angle = -Math.PI / 2;
  let x = 20;
  let y = 78;
  const len = 4.2 + module.gravity * 2.8;
  const turn = 0.28 + module.weird * 0.6;
  const stack: Array<{ x: number; y: number; angle: number }> = [];
  for (let i = 0; i < count; i++) {
    const token = hash01(module.seed + i * 31 + module.caRule);
    if (token < 0.2 + module.weird * 0.3 && stack.length < 6) stack.push({ x, y, angle });
    else if (token > 0.86 - module.determinism * 0.2 && stack.length) {
      const pop = stack.pop();
      if (pop) {
        x = pop.x;
        y = pop.y;
        angle = pop.angle;
      }
    }
    angle += (token < 0.5 ? -1 : 1) * turn * (0.6 + module.determinism * 0.5);
    x += Math.cos(angle) * len;
    y += Math.sin(angle) * len * (0.8 + module.density * 0.6);
    x = clamp(x, 6, 214);
    y = clamp(y, 8, 84);
    points.push({ x, y });
  }
  return points;
}

function createMorphPattern(module: TriggerModule, steps: number) {
  const out = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) {
    const phase = (i / Math.max(1, steps - 1)) + module.seed * 0.00083 + module.euclidRot * 0.01;
    const wave = Math.sin(phase * Math.PI * (2.2 + module.weird * 3.6)) * 0.5 + 0.5;
    const noise = hash01(module.seed + i * 17) * 0.35;
    out[i] = wave + noise < module.density ? 1 : 0;
  }
  return out;
}

function renderLinearCells(host: HTMLElement, existing: HTMLElement[], steps: number, pattern: Uint8Array) {
  host.style.setProperty("--trigger-linear-cols", String(steps));
  const cells = existing;
  if (cells.length !== steps) {
    host.textContent = "";
    cells.length = 0;
    for (let i = 0; i < steps; i++) {
      const cell = document.createElement("span");
      cell.className = "triggerDisplayLinearCell";
      host.appendChild(cell);
      cells.push(cell);
    }
  }
  for (let i = 0; i < steps; i++) {
    cells[i].classList.toggle("on", pattern[i] === 1);
    cells[i].classList.remove("is-playhead");
  }
  return cells;
}

function paintPlayhead(cells: HTMLElement[], playhead: number) {
  for (let i = 0; i < cells.length; i++) cells[i].classList.toggle("is-playhead", i === playhead);
}

function createGeneticRow(module: TriggerModule, cols: number, row: number) {
  const out = new Uint8Array(cols);
  const mutate = module.weird * (0.08 + row * 0.05);
  for (let i = 0; i < cols; i++) {
    let bit = hash01(module.seed + row * 101 + i * 13) < module.density ? 1 : 0;
    if (hash01(module.seed + row * 71 + i * 19) < mutate) bit = bit ? 0 : 1;
    if (bit && hash01(module.seed + row * 29 + i * 7) < module.drop * 0.45) bit = 0;
    out[i] = bit;
  }
  return out;
}

function evaluateFitness(pattern: Uint8Array, module: TriggerModule) {
  const hits = pattern.reduce((sum, bit) => sum + bit, 0);
  const densityFit = 1 - Math.abs(hits / Math.max(1, pattern.length) - module.density);
  let anchorHits = 0;
  for (let i = 0; i < pattern.length; i++) if (pattern[i] && i % 4 === 0) anchorHits++;
  const anchorFit = anchorHits / Math.max(1, Math.ceil(pattern.length / 4));
  return clamp(densityFit * 0.75 + anchorFit * module.gravity * 0.25, 0, 1);
}

function buildOneOverFValues(module: TriggerModule, count: number) {
  const values: number[] = [];
  let low = hash01(module.seed + 11);
  let mid = hash01(module.seed + 23);
  let high = hash01(module.seed + 37);
  for (let i = 0; i < count; i++) {
    if (hash01(module.seed + i * 19) < 0.08 + (1 - module.determinism) * 0.08) low = hash01(module.seed + i * 31 + 7);
    if (hash01(module.seed + i * 29) < 0.18 + module.weird * 0.18) mid = hash01(module.seed + i * 43 + 13);
    if (hash01(module.seed + i * 41) < 0.36 + module.weird * 0.32) high = hash01(module.seed + i * 53 + 17);
    const composite = low * 0.58 + mid * 0.3 + high * 0.12;
    values.push(clamp(composite + (module.gravity - 0.5) * 0.14, 0, 1));
  }
  return values;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
