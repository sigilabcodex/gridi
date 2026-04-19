import type { Mode, TriggerModule } from "../patch";
import { createGearModel } from "../engine/pattern/gear";

type TriggerDisplayParams = {
  module: TriggerModule;
  isRuntimeActive: () => boolean;
  getStepPattern: () => string;
  onCommitLivePattern?: (pattern: Uint8Array | null, mode: Mode) => void;
};

type TriggerDisplayApi = {
  wrap: HTMLElement;
  sync: (module: TriggerModule) => void;
};

type StepGridState = {
  basePattern: Uint8Array;
  currentPattern: Uint8Array;
  pointerActive: boolean;
  pointerMode: "paint" | "erase" | "toggle";
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

function livePatternString(module: TriggerModule) {
  const live = module.liveState as
    | {
      mode?: unknown;
      steps?: unknown;
      pattern?: unknown;
      revision?: unknown;
    }
    | undefined;
  if (!live) return null;
  if (live.mode !== module.mode) return null;
  if (typeof live.steps !== "number" || !Number.isFinite(live.steps)) return null;
  if (typeof live.pattern !== "string") return null;
  return live.pattern;
}

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
  gear: "GEAR",
  sonar: "SONAR",
};

export function createTriggerDisplaySurface(params: TriggerDisplayParams): TriggerDisplayApi {
  const wrap = document.createElement("div");
  wrap.className = "triggerDisplaySurface";

  const canvas = document.createElement("div");
  canvas.className = "triggerDisplayCanvas";

  wrap.append(canvas);

  const stepGridState: StepGridState = {
    basePattern: new Uint8Array(0),
    currentPattern: new Uint8Array(0),
    pointerActive: false,
    pointerMode: "toggle",
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
  let lastSyncSignature: string | null = null;
  let animationMs = 0;
  let lastFrameMs: number | null = null;

  const ensureView = () => {
    if (view && activeMode === moduleRef.mode) return;
    canvas.textContent = "";
    activeMode = moduleRef.mode;
    lastSyncSignature = null;
    view = createViewForMode(moduleRef.mode, moduleRef, params, stepGridState);
    canvas.appendChild(view.root);
    view.sync(moduleRef, params, stepGridState);
    lastSyncSignature = createDisplaySyncSignature(moduleRef);
  };

  const tick = (timeMs: number) => {
    if (!wrap.isConnected) return;
    if (lastFrameMs == null) lastFrameMs = timeMs;
    const deltaMs = Math.max(0, timeMs - lastFrameMs);
    lastFrameMs = timeMs;
    if (params.isRuntimeActive()) animationMs += deltaMs;
    ensureView();
    view?.tick?.(animationMs, moduleRef, params, stepGridState);
    rafId = window.requestAnimationFrame(tick);
  };

  const sync = (module: TriggerModule) => {
    moduleRef = module;
    ensureView();
    const signature = createDisplaySyncSignature(module);
    if (signature !== lastSyncSignature) {
      view?.sync(module, params, stepGridState);
      lastSyncSignature = signature;
    }
    if (!rafId) rafId = window.requestAnimationFrame(tick);
  };

  sync(params.module);
  return { wrap, sync };
}

function createViewForMode(mode: Mode, module: TriggerModule, params: TriggerDisplayParams, stepState: StepGridState): DisplayView {
  if (mode === "step-sequencer") return createStepSequencerView(module, params, stepState);
  if (mode === "euclidean") return createEuclideanView(params);
  if (mode === "cellular-automata") return createCellularView(params);
  if (mode === "fractal") return createFractalView();
  if (mode === "non-euclidean") return createNonEuclideanView();
  if (mode === "hybrid") return createHybridView(params);
  if (mode === "markov-chains") return createMarkovView();
  if (mode === "l-systems") return createLSystemsView();
  if (mode === "xronomorph") return createXronoMorphView(params);
  if (mode === "genetic-algorithms") return createGeneticView();
  if (mode === "one-over-f-noise") return createOneOverFView(params);
  if (mode === "gear") return createGearView();
  if (mode === "sonar") return createSonarView();

  const placeholder = renderModePlaceholder(mode);
  return {
    root: placeholder,
    sync: () => {},
  };
}

function createGearView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayGear";

  const stage = document.createElement("div");
  stage.className = "triggerDisplayGearStage";

  const coincidenceSpoke = document.createElement("span");
  coincidenceSpoke.className = "triggerDisplayGearCoincidence";
  stage.appendChild(coincidenceSpoke);
  root.appendChild(stage);

  const ratioReadout = document.createElement("div");
  ratioReadout.className = "triggerDisplayGearRatio";
  root.appendChild(ratioReadout);

  type GearDisplayRing = {
    length: number;
    rotation: number;
    phase: number;
    direction: 1 | -1;
    pattern: Uint8Array;
    emphasis: number;
  };

  const ringTicks: HTMLElement[][] = [];
  const ringSlots: HTMLElement[][] = [];
  const ringBodies: HTMLElement[] = [];
  const ringMarkers: HTMLElement[] = [];
  const ringModels: GearDisplayRing[] = [];
  let triggerPattern = new Uint8Array(0);
  let lastPlayhead = -1;
  let alignmentUntil = 0;
  let visibleRings = 0;

  const buildRing = (ringIndex: number, ringModel: GearDisplayRing, activeCount: number) => {
    const ring = document.createElement("div");
    ring.className = `triggerDisplayGearWheel triggerDisplayGearWheel--${ringIndex + 1}`;
    ring.classList.toggle("is-enabled", ringIndex < activeCount);
    ring.style.setProperty("--gear-angle", "0deg");
    ring.style.setProperty("--gear-ring-index", String(ringIndex));
    ring.style.setProperty("--gear-ring-count", String(Math.max(1, activeCount)));

    const ringBody = document.createElement("span");
    ringBody.className = "triggerDisplayGearRingBody";

    const tickCount = clamp(Math.round(ringModel.length), 8, 40);
    const ticks: HTMLElement[] = [];
    for (let i = 0; i < tickCount; i++) {
      const tick = document.createElement("span");
      tick.className = "triggerDisplayGearTick";
      tick.style.setProperty("--gear-tooth-angle", `${((i / tickCount) * 360).toFixed(3)}deg`);
      tick.style.setProperty("--gear-tick-major", i % Math.max(2, Math.round(tickCount / 8)) === 0 ? "1" : "0");
      ringBody.appendChild(tick);
      ticks.push(tick);
    }

    const slots: HTMLElement[] = [];
    for (let i = 0; i < ringModel.length; i++) {
      const slot = document.createElement("span");
      slot.className = "triggerDisplayGearSlot";
      slot.style.setProperty("--gear-tooth-angle", `${((i / Math.max(1, ringModel.length)) * 360).toFixed(3)}deg`);
      ringBody.appendChild(slot);
      slots.push(slot);
    }

    const marker = document.createElement("span");
    marker.className = "triggerDisplayGearMarker";
    ring.append(ringBody, marker);
    stage.appendChild(ring);
    ringBodies[ringIndex] = ring;
    ringMarkers[ringIndex] = marker;
    ringTicks[ringIndex] = ticks;
    ringSlots[ringIndex] = slots;
  };

  const normalizeAngle = (angle: number) => {
    const wrapped = ((angle % 360) + 360) % 360;
    return wrapped;
  };

  const setPlayheadState = (nextPlayhead: number, triggerOn: boolean) => {
    const markerAngles: number[] = [];
    let activeAlignedCount = 0;
    ringSlots.forEach((slots, ringIndex) => {
      const ring = ringModels[ringIndex];
      if (!ring?.length || !slots.length) return;
      const previous = ((Math.floor(lastPlayhead * ring.direction + ring.rotation + lastPlayhead * ring.phase) % ring.length) + ring.length) % ring.length;
      slots[previous]?.classList.remove("is-playhead", "is-aligned");

      const index = ((Math.floor(nextPlayhead * ring.direction + ring.rotation + nextPlayhead * ring.phase) % ring.length) + ring.length) % ring.length;
      const active = ring.pattern[index] === 1;
      const phase = index / ring.length;
      const angle = normalizeAngle(phase * 360);
      markerAngles.push(angle);
      if (active) activeAlignedCount += 1;
      ringMarkers[ringIndex]?.style.setProperty("--gear-marker-angle", `${angle.toFixed(3)}deg`);
      slots[index]?.classList.add("is-playhead");
      slots[index]?.classList.toggle("is-aligned", triggerOn && active);
    });

    const isCoincident = triggerOn && activeAlignedCount >= Math.max(2, visibleRings - 1);
    if (isCoincident && markerAngles.length) {
      let anchor = markerAngles[0];
      let sum = anchor;
      for (let i = 1; i < markerAngles.length; i++) {
        const raw = markerAngles[i];
        let adjusted = raw;
        while (adjusted - anchor > 180) adjusted -= 360;
        while (adjusted - anchor < -180) adjusted += 360;
        sum += adjusted;
      }
      const mean = normalizeAngle(sum / markerAngles.length);
      coincidenceSpoke.style.setProperty("--gear-coincidence-angle", `${mean.toFixed(3)}deg`);
    }
    stage.classList.toggle("is-coincident", isCoincident);
  };

  return {
    root,
    sync: (nextModule) => {
      const model = createGearModel(nextModule, "preview");
      triggerPattern = new Uint8Array(model.triggerPattern);
      lastPlayhead = -1;
      alignmentUntil = 0;
      ringModels.length = 0;
      ringTicks.length = 0;
      ringSlots.length = 0;
      ringBodies.length = 0;
      ringMarkers.length = 0;
      stage.querySelectorAll(".triggerDisplayGearWheel").forEach((el) => el.remove());
      root.classList.remove("is-aligned");
      ratioReadout.textContent = "";

      model.rings.forEach((ringModel, ringIndex) => {
        ringModels[ringIndex] = {
          length: ringModel.length,
          rotation: ringModel.rotation,
          phase: ringModel.phase,
          direction: ringModel.direction,
          pattern: ringModel.pattern,
          emphasis: 0.6 + ringIndex * 0.2,
        };
      });
      visibleRings = clamp(model.ringCount, 2, 4);
      ringModels.splice(visibleRings);
      ringModels.forEach((ringModel, ringIndex) => {
        buildRing(ringIndex, ringModel, visibleRings);
        ringSlots[ringIndex]?.forEach((slot, i) => {
          slot.classList.toggle("on", ringModel.pattern[i] === 1);
        });
        ringTicks[ringIndex]?.forEach((tick) => tick.style.opacity = ringModel.emphasis.toFixed(3));
      });

      const ratios: string[] = [];
      if (model.rings[0] && model.rings[1]) ratios.push(`A:B ${model.rings[0].length}:${model.rings[1].length}`);
      if (model.rings[2]) ratios.push(`A:C ${model.rings[0].length}:${model.rings[2].length}`);
      if (model.rings[3]) ratios.push(`A:D ${model.rings[0].length}:${model.rings[3].length}`);
      ratios.push(`LCM ${triggerPattern.length}`);
      ratioReadout.textContent = ratios.join(" · ");
    },
    tick: (timeMs, liveModule) => {
      if (!triggerPattern.length) return;
      const play = resolveAnimatedStepIndex(timeMs, liveModule, triggerPattern.length);
      const progress = play / Math.max(1, triggerPattern.length);

      ringBodies.forEach((ringEl, ringIndex) => {
        const ring = ringModels[ringIndex];
        if (!ring?.length) return;
        const direction = ring.direction;
        const driftWarp = 1 + clamp(liveModule.weird, 0, 1) * ring.phase * 0.9;
        const angle = ring.rotation + (progress * 360 * (triggerPattern.length / ring.length) * direction * driftWarp);
        ringEl.style.setProperty("--gear-angle", `${angle.toFixed(3)}deg`);
      });

      if (play !== lastPlayhead) {
        const triggerOn = triggerPattern[play] === 1;
        setPlayheadState(play, triggerOn);
        if (triggerOn) alignmentUntil = timeMs + 180;
        lastPlayhead = play;
      }

      const aligned = alignmentUntil > timeMs;
      root.classList.toggle("is-aligned", aligned);
      stage.classList.toggle("is-aligned", aligned);
      if (!aligned) stage.classList.remove("is-coincident");
    },
  };
}

function createDisplaySyncSignature(module: TriggerModule) {
  const live = module.liveState;
  const livePattern = livePatternString(module);
  const liveSignature = !live
    ? "none"
    : `${String(live.mode ?? "unknown")}:${String(live.steps ?? "unknown")}:${String(live.revision ?? "unknown")}:${livePattern?.length ?? 0}`;
  return [
    module.mode,
    module.seed,
    module.length,
    module.subdiv,
    module.density,
    module.weird,
    module.gravity,
    module.determinism,
    module.drop,
    module.euclidRot,
    module.caRule,
    module.caInit,
    liveSignature,
  ].join("|");
}

function createSonarView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplaySonar";
  const stage = document.createElement("div");
  stage.className = "triggerDisplaySonarStage";
  const sweep = document.createElement("span");
  sweep.className = "triggerDisplaySonarSweep";
  const pulse = document.createElement("span");
  pulse.className = "triggerDisplaySonarPulse";
  stage.append(sweep, pulse);
  root.append(stage);

  const blips: HTMLElement[] = [];
  const blipModels: Array<{ baseX: number; baseY: number; driftX: number; driftY: number }> = [];
  let lastPlayhead = -1;
  let pattern = new Uint8Array(0);

  return {
    root,
    sync: (nextModule) => {
      pattern = decodeLivePattern(nextModule, Math.max(8, nextModule.length)) ?? buildSonarPattern(nextModule, Math.max(8, nextModule.length));
      stage.querySelectorAll(".triggerDisplaySonarBlip").forEach((el) => el.remove());
      blips.length = 0;
      blipModels.length = 0;
      const count = clamp(7 + Math.round(nextModule.density * 14), 6, 20);
      for (let i = 0; i < count; i++) {
        const blip = document.createElement("span");
        blip.className = "triggerDisplaySonarBlip";
        const radius = 16 + hash01(nextModule.seed * 0.37 + i * 19.3) * 44;
        const angle = hash01(nextModule.seed * 0.19 + i * 7.7) * Math.PI * 2;
        const baseX = Math.cos(angle) * radius;
        const baseY = Math.sin(angle) * radius;
        const driftHeading = hash01(nextModule.seed * 0.63 + i * 13.2) * Math.PI * 2;
        const driftSpeed = 0.25 + nextModule.weird * 2.2;
        const driftX = Math.cos(driftHeading) * driftSpeed;
        const driftY = Math.sin(driftHeading) * driftSpeed;
        blip.style.setProperty("--sonar-x", `${baseX.toFixed(2)}px`);
        blip.style.setProperty("--sonar-y", `${baseY.toFixed(2)}px`);
        blip.style.setProperty("--sonar-phase", `${(hash01(nextModule.seed * 0.43 + i * 11.2) * 0.9 + 0.1).toFixed(3)}`);
        stage.appendChild(blip);
        blips.push(blip);
        blipModels.push({ baseX, baseY, driftX, driftY });
      }
      lastPlayhead = -1;
    },
    tick: (timeMs, liveModule) => {
      const steps = Math.max(1, pattern.length || liveModule.length || 16);
      const playhead = resolveAnimatedStepIndex(timeMs, liveModule, steps);
      const sweepAngle = ((playhead / steps) * 360) - 90;
      sweep.style.setProperty("--sonar-angle", `${sweepAngle.toFixed(3)}deg`);
      pulse.style.setProperty("--sonar-pulse", `${((timeMs * 0.0018) % 1).toFixed(3)}`);
      if (playhead === lastPlayhead) return;
      const hit = pattern[playhead % Math.max(1, pattern.length)] === 1;
      blips.forEach((blip, index) => {
        const model = blipModels[index];
        if (model) {
          const t = timeMs * 0.001;
          const wobble = 2 + liveModule.gravity * 4;
          const x = model.baseX + Math.sin(t * model.driftX + index * 0.43) * wobble;
          const y = model.baseY + Math.cos(t * model.driftY + index * 0.57) * wobble;
          blip.style.setProperty("--sonar-x", `${x.toFixed(2)}px`);
          blip.style.setProperty("--sonar-y", `${y.toFixed(2)}px`);
        }
        const phase = Number(blip.style.getPropertyValue("--sonar-phase")) || 0.5;
        const local = Math.cos((sweepAngle * Math.PI) / 180 + phase * Math.PI * 2 + index * 0.3);
        const strength = clamp((local + 1) * 0.5, 0, 1);
        blip.style.setProperty("--sonar-hit", hit ? strength.toFixed(3) : (strength * 0.45).toFixed(3));
        blip.classList.toggle("is-hot", hit && strength > 0.68);
      });
      lastPlayhead = playhead;
    },
  };
}

function createStepSequencerView(module: TriggerModule, params: TriggerDisplayParams, state: StepGridState): DisplayView {
  const root = document.createElement("div");
  const grid = renderInteractiveStepGrid(module, state, params);
  root.appendChild(grid);

  return {
    root,
    sync: (nextModule) => {
      const layout = resolveStepGridLayout(nextModule.length, nextModule.subdiv);
      const stepCount = layout.cols * layout.rows;
      const basePattern = parsePatternPreview(params.getStepPattern(), stepCount);
      const seededLive = decodeLivePattern(nextModule, stepCount);
      const isFreshSeed = state.lastSeed !== nextModule.seed || state.stepCount !== stepCount;
      if (isFreshSeed) state.currentPattern = seededLive ?? basePattern.slice();
      else if (seededLive) state.currentPattern = seededLive;
      else if (state.currentPattern.length !== stepCount) {
        const resized = new Uint8Array(stepCount);
        resized.set(state.currentPattern.subarray(0, Math.min(stepCount, state.currentPattern.length)));
        state.currentPattern = resized;
      }

      state.lastSeed = nextModule.seed;
      state.basePattern = basePattern;
      state.stepCount = stepCount;
      state.cols = layout.cols;
      state.rows = layout.rows;

      const needsRebuild = state.cells.length !== stepCount
        || grid.style.getPropertyValue("--trigger-display-cols") !== String(layout.cols)
        || grid.style.getPropertyValue("--trigger-display-rows") !== String(layout.rows);
      if (needsRebuild) {
        const nextGrid = renderInteractiveStepGrid(nextModule, state, params);
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

function createEuclideanView(params: TriggerDisplayParams): DisplayView {
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
      dotState.pattern = decodeLivePattern(nextModule, steps) ?? generateEuclideanPattern(nextModule, steps);
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
        dot.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          dotState.pattern[i] = dotState.pattern[i] === 1 ? 0 : 1;
          dot.classList.toggle("on", dotState.pattern[i] === 1);
          params.onCommitLivePattern?.(dotState.pattern, "euclidean");
        });
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

function createCellularView(params: TriggerDisplayParams): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayCellular";
  const cells: HTMLElement[] = [];
  let cols = 8;
  let rows = 8;
  let generations: Uint8Array[] = [];
  let baseGeneration = 0;

  return {
    root,
    sync: (nextModule) => {
      cols = clamp(Math.round(nextModule.length / 2), 8, 16);
      rows = clamp(5 + Math.round(nextModule.subdiv), 6, 10);
      root.style.setProperty("--trigger-display-cols", String(cols));
      root.style.setProperty("--trigger-display-rows", String(rows));
      root.style.setProperty("--trigger-cell-gap", cols > 12 ? "2px" : "3px");
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

      generations = buildCARows(nextModule, Math.max(rows * 3, 24), cols);
      baseGeneration = 0;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const idx = row * cols + col;
          const active = generations[row + baseGeneration]?.[col] === 1;
          const cell = cells[idx];
          cell.classList.toggle("on", active);
          cell.classList.toggle("accent", active && row % Math.max(2, Math.round(5 - nextModule.weird * 3)) === 0);
          cell.classList.remove("is-playhead", "is-secondary");
          cell.onpointerdown = (event) => {
            event.preventDefault();
            const absoluteRow = row + baseGeneration;
            const currentlyActive = generations[absoluteRow]?.[col] === 1;
            const next = currentlyActive ? 0 : 1;
            if (generations[absoluteRow]) generations[absoluteRow][col] = next;
            cell.classList.toggle("on", next === 1);
            if (absoluteRow === baseGeneration) {
              const current = generations[baseGeneration] ?? new Uint8Array(cols);
              params.onCommitLivePattern?.(current, "cellular-automata");
            }
          };
        }
      }
    },
    tick: (timeMs, liveModule) => {
      if (!cells.length) return;
      const nextBase = resolveAnimatedStepIndex(timeMs, liveModule, Math.max(1, generations.length - rows));
      if (nextBase !== baseGeneration) {
        baseGeneration = nextBase;
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const idx = row * cols + col;
            const active = generations[row + baseGeneration]?.[col] === 1;
            cells[idx]?.classList.toggle("on", active);
          }
        }
      }
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
  svg.setAttribute("viewBox", "0 0 220 92");
  svg.setAttribute("class", "triggerDisplayFractal");

  const pathParent = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathParent.setAttribute("class", "triggerDisplayFractalPath triggerDisplayFractalPath--echo");
  const pathMain = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathMain.setAttribute("class", "triggerDisplayFractalPath");
  const pathChildA = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathChildA.setAttribute("class", "triggerDisplayFractalPath triggerDisplayFractalPath--child");
  const pathChildB = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathChildB.setAttribute("class", "triggerDisplayFractalPath triggerDisplayFractalPath--child");
  const cursor = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  cursor.setAttribute("class", "triggerDisplayFractalCursor");
  cursor.setAttribute("r", "2.8");
  svg.append(pathParent, pathChildA, pathChildB, pathMain, cursor);
  root.append(svg);

  let points: Array<{ x: number; y: number }> = [];
  let parent: Array<{ x: number; y: number }> = [];
  let childA: Array<{ x: number; y: number }> = [];
  let childB: Array<{ x: number; y: number }> = [];

  return {
    root,
    sync: (nextModule) => {
      points = buildFractalPoints(nextModule, 32);
      const coarseSource = buildFractalPoints({ ...nextModule, length: Math.max(6, Math.round(nextModule.length / 2)), weird: clamp(nextModule.weird * 0.35, 0, 1) }, 18);
      const scaleX = 212 / Math.max(1, coarseSource.length - 1);
      parent = coarseSource.map((pt, i) => ({ x: 4 + i * scaleX, y: clamp(14 + (pt.y - 12) * 0.84, 8, 84) }));
      const split = Math.floor(points.length / 2);
      childA = points.slice(0, split).map((pt, i) => ({ x: 8 + (i / Math.max(1, split - 1)) * 94, y: clamp(10 + pt.y * 0.42, 10, 48) }));
      childB = points.slice(split).map((pt, i) => ({ x: 118 + (i / Math.max(1, points.length - split - 1)) * 94, y: clamp(46 + (pt.y - 45) * 0.42, 46, 84) }));
      pathParent.setAttribute("d", `M ${parent.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`);
      pathMain.setAttribute("d", `M ${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`);
      pathChildA.setAttribute("d", `M ${childA.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`);
      pathChildB.setAttribute("d", `M ${childB.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L ")}`);
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
  const ringView = createEuclideanView(params);
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
        basePattern: new Uint8Array(0), currentPattern: new Uint8Array(0),
        pointerActive: false, pointerMode: "toggle", lastSeed: nextModule.seed, stepCount: 0, cols: 0, rows: 0, cells: [], lastPlayhead: -1,
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

function createOneOverFView(params: TriggerDisplayParams): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayOneOverF";
  const path = document.createElement("div");
  path.className = "triggerDisplayOneOverFPath";
  const spark = document.createElement("div");
  spark.className = "triggerDisplayOneOverFSpark";
  path.appendChild(spark);
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
      const live = decodeLivePattern(nextModule, pattern.length);
      const finalPattern = live ?? pattern;
      cells = renderLinearCells(grid, cells, finalPattern.length, finalPattern);
      cells.forEach((cell, idx) => {
        cell.onpointerdown = (event) => {
          event.preventDefault();
          finalPattern[idx] = finalPattern[idx] === 1 ? 0 : 1;
          cell.classList.toggle("on", finalPattern[idx] === 1);
          params.onCommitLivePattern?.(finalPattern, "one-over-f-noise");
        };
      });
    },
    tick: (timeMs, liveModule) => {
      if (!cells.length) return;
      const i = resolveAnimatedStepIndex(timeMs, liveModule, cells.length);
      paintPlayhead(cells, i);
      const y = 100 - (values[i] ?? 0.5) * 100;
      const x = (i / Math.max(1, cells.length - 1)) * 100;
      spark.style.left = `${x}%`;
      spark.style.top = `${y}%`;
      path.style.setProperty("--spark-x", `${x}%`);
      path.style.setProperty("--spark-y", `${y}%`);
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

function renderInteractiveStepGrid(module: TriggerModule, state: StepGridState, params: TriggerDisplayParams) {
  const grid = document.createElement("div");
  grid.className = "triggerDisplayStepGrid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", `${module.name} step overlay editor`);
  grid.style.setProperty("--trigger-display-cols", String(state.cols));
  grid.style.setProperty("--trigger-display-rows", String(state.rows));
  state.cells = [];

  for (let i = 0; i < state.stepCount; i++) {
    const cell = document.createElement("span");
    cell.className = "triggerDisplayCell";
    cell.dataset.index = String(i);
    cell.setAttribute("role", "gridcell");
    paintCell(cell, state, i);
    cell.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const erase = event.button === 2 || (event.shiftKey && event.button === 0);
      state.pointerActive = true;
      state.pointerMode = erase ? "erase" : "toggle";
      if (erase) writeCurrentPattern(state, i, 0);
      else toggleCurrentPattern(state, i);
      paintCell(cell, state, i);
      params.onCommitLivePattern?.(state.currentPattern, "step-sequencer");
    });
    cell.addEventListener("pointerenter", (event) => {
      if (!state.pointerActive) return;
      if (!(event.buttons & 1) && !(event.buttons & 2)) {
        state.pointerActive = false;
        return;
      }
      writeCurrentPattern(state, i, state.pointerMode === "erase" ? 0 : 1);
      paintCell(cell, state, i);
      params.onCommitLivePattern?.(state.currentPattern, "step-sequencer");
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
  grid.style.setProperty("--trigger-display-rows", String(layout.rows));
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
  const currentOn = state.currentPattern[stepIndex] === 1;
  cell.classList.toggle("base-on", baseOn);
  cell.classList.toggle("on", currentOn);
  cell.classList.toggle("overlay-on", !baseOn && currentOn);
  cell.classList.toggle("overlay-off", baseOn && !currentOn);
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

function decodeLivePattern(module: TriggerModule, steps: number) {
  const live = module.liveState;
  const pattern = livePatternString(module);
  if (!live || !pattern || live.steps !== steps) return null;
  const out = new Uint8Array(steps);
  for (let i = 0; i < steps; i++) out[i] = pattern[i] === "1" ? 1 : 0;
  return out;
}

function toggleCurrentPattern(state: StepGridState, index: number) {
  const next = state.currentPattern[index] === 1 ? 0 : 1;
  writeCurrentPattern(state, index, next);
}

function writeCurrentPattern(state: StepGridState, index: number, next: 0 | 1) {
  state.currentPattern[index] = next;
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

function buildSonarPattern(module: TriggerModule, steps: number) {
  const out = new Uint8Array(steps);
  const targetCount = clamp(3 + Math.round(module.density * 9), 2, 12);
  const lock = clamp(module.determinism, 0, 1);
  const drift = clamp(module.weird, 0, 1);
  for (let i = 0; i < steps; i++) {
    const phase = i / Math.max(1, steps);
    let strongest = 0;
    for (let target = 0; target < targetCount; target++) {
      const anchor = hash01(module.seed * 0.011 + target * 0.73);
      const drifted = (anchor + (hash01(module.seed * 0.021 + i * 0.17 + target * 2.9) - 0.5) * drift * 0.24 + 1) % 1;
      const distance = Math.abs(phase - drifted);
      const wrapped = Math.min(distance, 1 - distance);
      strongest = Math.max(strongest, 1 - wrapped * (4.2 + lock * 2.4));
    }
    const bias = 0.18 + module.gravity * 0.24;
    out[i] = strongest > (1 - module.density * 0.58 - bias) ? 1 : 0;
    if (out[i] === 1 && hash01(module.seed + i * 61) < module.drop * 0.4) out[i] = 0;
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
