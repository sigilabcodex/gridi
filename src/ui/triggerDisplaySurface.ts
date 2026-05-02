import type { Mode, TriggerModule } from "../patch";
import { createGearModel } from "../engine/pattern/gear";
import { buildMarkovPatternModel } from "../engine/pattern/module";
import { getGenModeMeta } from "../engine/pattern/genModeRegistry";

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
  pattern: Uint8Array;
  intensity: Float32Array;
  activeLength: number;
  stepCount: number;
  cols: number;
  rows: number;
  phraseSpan: number;
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

export function createTriggerDisplaySurface(params: TriggerDisplayParams): TriggerDisplayApi {
  const wrap = document.createElement("div");
  wrap.className = "triggerDisplaySurface";

  const canvas = document.createElement("div");
  canvas.className = "triggerDisplayCanvas";

  wrap.append(canvas);

  const stepGridState: StepGridState = {
    pattern: new Uint8Array(0),
    intensity: new Float32Array(0),
    activeLength: 0,
    stepCount: 0,
    cols: 16,
    rows: 2,
    phraseSpan: 4,
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
  if (mode === "radar") return createRadarView();

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
    module.accent,
    module.determinism,
    module.drop,
    module.euclidRot,
    module.caRule,
    module.caInit,
    liveSignature,
  ].join("|");
}

function createRadarView(): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayRadar";
  const stage = document.createElement("div");
  stage.className = "triggerDisplayRadarStage";
  const sweep = document.createElement("span");
  sweep.className = "triggerDisplayRadarSweep";
  const rangeRing = document.createElement("span");
  rangeRing.className = "triggerDisplayRadarRange";
  stage.append(sweep, rangeRing);
  root.append(stage);

  type RadarBlipModel = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radiusNorm: number;
    hitGlow: number;
    eventGlow: number;
    trailHead: number;
    trailX: Float32Array;
    trailY: Float32Array;
    trails: HTMLElement[];
    returnEl: HTMLElement;
  };

  const blips: HTMLElement[] = [];
  const blipModels: RadarBlipModel[] = [];
  let lastPlayhead = -1;
  let pattern = new Uint8Array(0);
  let sweepGlow = 0;
  let lastTickMs: number | null = null;
  const FIELD_RADIUS = 62;
  const TRAIL_POINTS = 4;

  return {
    root,
    sync: (nextModule) => {
      pattern = decodeLivePattern(nextModule, Math.max(8, nextModule.length)) ?? buildRadarPattern(nextModule, Math.max(8, nextModule.length));
      stage.querySelectorAll(".triggerDisplayRadarBlip, .triggerDisplayRadarTrail, .triggerDisplayRadarReturn").forEach((el) => el.remove());
      blips.length = 0;
      blipModels.length = 0;
      const count = clamp(2 + Math.round(nextModule.density * 9 + nextModule.gravity * 2), 2, 12);
      const rangeNorm = radarRangeNorm(nextModule);
      const ringGap = 10 + (1 - rangeNorm) * 10;
      stage.style.setProperty("--radar-range-reach", (0.28 + rangeNorm * 0.72).toFixed(3));
      stage.style.setProperty("--radar-ring-gap", `${ringGap.toFixed(2)}px`);
      stage.style.setProperty("--radar-target-scale", (1.06 - rangeNorm * 0.14).toFixed(3));
      for (let i = 0; i < count; i++) {
        const blip = document.createElement("span");
        blip.className = "triggerDisplayRadarBlip";
        const target = createRadarTargetState(nextModule, i, FIELD_RADIUS);
        const x = target.x;
        const y = target.y;
        const trails: HTMLElement[] = [];
        for (let trail = 0; trail < TRAIL_POINTS; trail++) {
          const trailDot = document.createElement("span");
          trailDot.className = "triggerDisplayRadarTrail";
          trailDot.style.setProperty("--radar-trail-index", String(trail + 1));
          trailDot.style.setProperty("--radar-trail-x", `${x.toFixed(2)}px`);
          trailDot.style.setProperty("--radar-trail-y", `${y.toFixed(2)}px`);
          stage.appendChild(trailDot);
          trails.push(trailDot);
        }
        const returnEl = document.createElement("span");
        returnEl.className = "triggerDisplayRadarReturn";
        stage.appendChild(returnEl);
        blip.style.setProperty("--radar-x", `${x.toFixed(2)}px`);
        blip.style.setProperty("--radar-y", `${y.toFixed(2)}px`);
        blip.style.setProperty("--radar-hit", "0");
        blip.style.setProperty("--radar-range-dim", "0.22");
        blip.style.setProperty("--radar-return", "0");
        stage.appendChild(blip);
        blips.push(blip);
        blipModels.push({
          ...target,
          hitGlow: 0,
          eventGlow: 0,
          trailHead: 0,
          trailX: Float32Array.from({ length: TRAIL_POINTS }, () => x),
          trailY: Float32Array.from({ length: TRAIL_POINTS }, () => y),
          trails,
          returnEl,
        });
      }
      lastPlayhead = -1;
      sweepGlow = 0;
      lastTickMs = null;
    },
    tick: (timeMs, liveModule) => {
      const steps = Math.max(1, pattern.length || liveModule.length || 16);
      const sweepPhase = resolveAnimatedSweepPhase(timeMs, liveModule);
      const playhead = clamp(Math.floor(sweepPhase * steps), 0, Math.max(0, steps - 1));
      const sweepAngle = (sweepPhase * 360) - 90;
      sweep.style.setProperty("--radar-angle", `${sweepAngle.toFixed(3)}deg`);
      const sweepAngleRad = sweepPhase * Math.PI * 2 - Math.PI / 2;
      const density = clamp(liveModule.density, 0, 1);
      const threshold = clamp(0.42 - density * 0.16, 0.12, 0.62);
      const dtMs = lastTickMs == null ? 16 : clamp(timeMs - lastTickMs, 0, 34);
      const dt = dtMs / 1000;
      lastTickMs = timeMs;
      const drift = clamp(liveModule.weird, 0, 1);
      const speedScale = dt * (16 + drift * 38);
      const rangeNorm = radarRangeNorm(liveModule);
      const reachNorm = 0.28 + rangeNorm * 0.72;
      const rangeRadius = FIELD_RADIUS * reachNorm;
      stage.style.setProperty("--radar-range-reach", reachNorm.toFixed(3));
      stage.style.setProperty("--radar-ring-gap", `${(10 + (1 - rangeNorm) * 10).toFixed(2)}px`);
      stage.style.setProperty("--radar-target-scale", (1.06 - rangeNorm * 0.14).toFixed(3));
      if (playhead !== lastPlayhead) {
        const generatedHit = pattern[playhead % Math.max(1, pattern.length)] === 1;
        if (generatedHit) sweepGlow = 1;
        lastPlayhead = playhead;
      }
      sweepGlow = Math.max(0, sweepGlow - 0.12);
      sweep.style.setProperty("--radar-sweep-glow", sweepGlow.toFixed(3));
      for (let index = 0; index < blips.length; index++) {
        const blip = blips[index];
        const model = blipModels[index];
        if (!model) continue;
        stepRadarTarget(model, speedScale, FIELD_RADIUS);
        const response = radarDetectionStrength(model.x, model.y, liveModule, sweepAngleRad, FIELD_RADIUS);
        const distance = Math.hypot(model.x, model.y);
        const inRange = distance <= rangeRadius;
        const responseGain = inRange ? 1 : 0;
        const detected = response * responseGain > threshold;
        if (detected && pattern[playhead % Math.max(1, pattern.length)] === 1) model.eventGlow = 1;
        const weightedResponse = response * responseGain;
        model.hitGlow = Math.max(model.hitGlow * 0.82, weightedResponse);
        model.eventGlow = Math.max(0, model.eventGlow - 0.14);
        model.trailX[model.trailHead] = model.x;
        model.trailY[model.trailHead] = model.y;
        model.trailHead = (model.trailHead + 1) % TRAIL_POINTS;

        const rangeFade = inRange ? 1 : clamp(1 - (distance - rangeRadius) / Math.max(6, FIELD_RADIUS - rangeRadius), 0.06, 0.35);
        const hitStrength = clamp(model.hitGlow * (0.76 + model.eventGlow * 0.24), 0, 1);
        blip.style.setProperty("--radar-x", `${model.x.toFixed(2)}px`);
        blip.style.setProperty("--radar-y", `${model.y.toFixed(2)}px`);
        blip.style.setProperty("--radar-hit", hitStrength.toFixed(3));
        blip.style.setProperty("--radar-range-dim", rangeFade.toFixed(3));
        blip.style.setProperty("--radar-return", detected ? "1" : "0");
        blip.classList.toggle("is-hot", detected && inRange);
        model.returnEl.style.setProperty("--radar-return-x", `${model.x.toFixed(2)}px`);
        model.returnEl.style.setProperty("--radar-return-y", `${model.y.toFixed(2)}px`);
        model.returnEl.style.setProperty("--radar-return-hit", (hitStrength * rangeFade).toFixed(3));
        model.returnEl.style.setProperty("--radar-return-visible", detected && inRange ? "1" : "0");
        for (let trail = 0; trail < TRAIL_POINTS; trail++) {
          const slot = (model.trailHead - 1 - trail + TRAIL_POINTS) % TRAIL_POINTS;
          const trailEl = model.trails[trail];
          trailEl?.style.setProperty("--radar-trail-x", `${model.trailX[slot]?.toFixed(2) ?? "0"}px`);
          trailEl?.style.setProperty("--radar-trail-y", `${model.trailY[slot]?.toFixed(2) ?? "0"}px`);
          trailEl?.style.setProperty("--radar-trail-hit", (hitStrength * rangeFade).toFixed(3));
        }
      }
    },
  };
}

function createStepSequencerView(module: TriggerModule, params: TriggerDisplayParams, state: StepGridState): DisplayView {
  const root = document.createElement("div");
  root.className = "triggerDisplayStepView";
  let grid = renderReadOnlyStepGrid(module, state);
  root.appendChild(grid);

  return {
    root,
    sync: (nextModule) => {
      const layout = resolveStepGridLayout(nextModule.length, nextModule.subdiv);
      const stepCount = layout.cols * layout.rows;
      state.pattern = decodeLivePattern(nextModule, stepCount) ?? parsePatternPreview(params.getStepPattern(), stepCount);
      state.intensity = computeStepIntensities(state.pattern, nextModule, layout.cols);
      state.activeLength = clamp(Math.round(nextModule.length), 1, 128);
      state.stepCount = stepCount;
      state.cols = layout.cols;
      state.rows = layout.rows;
      state.phraseSpan = resolvePhraseSpan(layout.cols, nextModule.subdiv);

      const needsRebuild = state.cells.length !== stepCount
        || grid.style.getPropertyValue("--trigger-display-cols") !== String(layout.cols)
        || grid.style.getPropertyValue("--trigger-display-rows") !== String(layout.rows);
      if (needsRebuild) {
        const nextGrid = renderReadOnlyStepGrid(nextModule, state);
        root.replaceChildren(nextGrid);
        grid = nextGrid;
      } else {
        state.cells.forEach((cell, i) => paintCell(cell, state, i));
      }
      root.style.setProperty("--trigger-step-density", ((countActiveSteps(state.pattern, state.activeLength) / Math.max(1, state.activeLength))).toFixed(3));
      root.style.setProperty("--trigger-step-accent-depth", clamp(nextModule.accent, 0, 1).toFixed(3));
    },
    tick: (timeMs, liveModule) => {
      if (!state.cells.length || !state.activeLength) return;
      const stepIndex = resolveAnimatedStepIndex(timeMs, liveModule, state.activeLength);
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
        pattern: new Uint8Array(0), intensity: new Float32Array(0), activeLength: 0,
        stepCount: 0, cols: 0, rows: 0, phraseSpan: 4, cells: [], lastPlayhead: -1,
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
  const pathStrip = document.createElement("div");
  pathStrip.className = "triggerDisplayMarkovPath";
  const matrix = document.createElement("div");
  matrix.className = "triggerDisplayMarkovMatrix";
  const matrixCells: HTMLElement[] = [];
  const nodes: HTMLElement[] = [];
  const pathCells: HTMLElement[] = [];
  root.append(nodeWrap, matrix, pathStrip);
  let lastPlayhead = -1;
  let path: Uint8Array = new Uint8Array(0);
  let p11Mean = 0.5;
  let p01Mean = 0.5;
  for (let i = 0; i < 2; i++) {
    const node = document.createElement("span");
    node.className = "triggerDisplayMarkovNode";
    node.textContent = i === 0 ? "R" : "H";
    nodeWrap.appendChild(node);
    nodes.push(node);
  }
  for (let i = 0; i < 4; i++) {
    const cell = document.createElement("span");
    cell.className = "triggerDisplayMarkovCell";
    matrix.appendChild(cell);
    matrixCells.push(cell);
  }

  return {
    root,
    sync: (nextModule) => {
      const length = Math.max(8, nextModule.length | 0);
      const model = buildMarkovPatternModel({ ...nextModule, length }, "display-markov");
      path = model.statePath;
      p11Mean = model.p11.reduce((sum, value) => sum + value, 0) / Math.max(1, model.p11.length);
      p01Mean = model.p01.reduce((sum, value) => sum + value, 0) / Math.max(1, model.p01.length);
      const matrixData = [1 - p01Mean, p01Mean, 1 - p11Mean, p11Mean];
      matrixCells.forEach((cell, idx) => {
        const prob = matrixData[idx];
        cell.style.opacity = (0.18 + prob * 0.92).toFixed(3);
        cell.textContent = `${Math.round(prob * 100)}`;
      });
      pathStrip.textContent = "";
      pathCells.length = 0;
      for (let i = 0; i < path.length; i++) {
        const cell = document.createElement("span");
        cell.className = "triggerDisplayMarkovPathCell";
        cell.classList.toggle("is-hit", path[i] === 1);
        pathStrip.appendChild(cell);
        pathCells.push(cell);
      }
      lastPlayhead = -1;
    },
    tick: (timeMs, liveModule) => {
      if (!path.length) return;
      const playhead = resolveAnimatedStepIndex(timeMs, liveModule, path.length);
      if (playhead === lastPlayhead) return;
      if (lastPlayhead >= 0) {
        pathCells[lastPlayhead]?.classList.remove("is-playhead");
      }
      pathCells[playhead]?.classList.add("is-playhead");
      nodes.forEach((node, idx) => node.classList.toggle("is-playhead", idx === path[playhead]));
      const prev = playhead > 0 ? path[playhead - 1] : path[path.length - 1];
      const isSwitch = prev !== path[playhead];
      root.classList.toggle("is-switch", isSwitch);
      root.style.setProperty("--markov-switch-strength", (isSwitch ? p01Mean : p11Mean).toFixed(3));
      lastPlayhead = playhead;
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
  title.textContent = getGenModeMeta(mode).fullLabel;

  const hint = document.createElement("span");
  hint.textContent = "Mode renderer is intentionally deferred in this pass.";

  placeholder.append(title, hint);
  return placeholder;
}

function renderReadOnlyStepGrid(module: TriggerModule, state: StepGridState) {
  const grid = document.createElement("div");
  grid.className = "triggerDisplayStepGrid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", `${module.name} sequencer readout`);
  grid.setAttribute("aria-readonly", "true");
  grid.style.setProperty("--trigger-display-cols", String(state.cols));
  grid.style.setProperty("--trigger-display-rows", String(state.rows));
  grid.style.setProperty("--trigger-step-phrase", String(state.phraseSpan));
  state.cells = [];

  for (let i = 0; i < state.stepCount; i++) {
    const col = i % Math.max(1, state.cols);
    const isOverflow = i >= state.activeLength;
    const isMeasureStart = col % state.phraseSpan === 0;
    const isSubdivisionStart = state.phraseSpan >= 4 && col % Math.max(1, state.phraseSpan / 2) === 0;
    const cell = document.createElement("span");
    cell.className = "triggerDisplayCell";
    cell.dataset.index = String(i);
    cell.setAttribute("role", "gridcell");
    if (isOverflow) cell.setAttribute("aria-disabled", "true");
    cell.classList.toggle("is-overflow", isOverflow);
    cell.classList.toggle("is-measure-start", isMeasureStart);
    cell.classList.toggle("is-subdivision-start", !isMeasureStart && isSubdivisionStart);
    paintCell(cell, state, i);
    grid.appendChild(cell);
    state.cells.push(cell);
  }

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
  if (stepIndex >= state.activeLength) {
    cell.classList.remove("on", "off", "is-ghost", "is-strong", "is-soft");
    return;
  }
  const active = state.pattern[stepIndex] === 1;
  const intensity = clamp(state.intensity[stepIndex] ?? 0.5, 0, 1);
  cell.classList.toggle("on", active);
  cell.classList.toggle("off", !active);
  cell.classList.toggle("is-ghost", !active && intensity > 0.45);
  cell.classList.toggle("is-strong", active && intensity >= 0.72);
  cell.classList.toggle("is-soft", active && intensity < 0.5);
  cell.style.setProperty("--trigger-step-intensity", intensity.toFixed(3));
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

function computeStepIntensities(pattern: Uint8Array, module: TriggerModule, cols: number) {
  const intensity = new Float32Array(pattern.length);
  const accentDepth = clamp(module.accent, 0, 1);
  const phraseSpan = resolvePhraseSpan(cols, module.subdiv);
  for (let i = 0; i < pattern.length; i++) {
    const col = i % Math.max(1, cols);
    const progress = pattern.length <= 1 ? 0.5 : i / (pattern.length - 1);
    const phraseWeight = col % phraseSpan === 0 ? 0.22 : col % Math.max(1, phraseSpan / 2) === 0 ? 0.12 : 0;
    const contour = 0.36 + progress * (0.28 + accentDepth * 0.2) + phraseWeight;
    intensity[i] = clamp(contour, 0, 1);
  }
  return intensity;
}

function countActiveSteps(pattern: Uint8Array, usableLength: number) {
  let active = 0;
  const end = Math.min(pattern.length, Math.max(0, usableLength));
  for (let i = 0; i < end; i++) active += pattern[i] === 1 ? 1 : 0;
  return active;
}

function resolveStepGridLayout(length: number, subdiv: number) {
  const clampedLength = clamp(Math.round(length), 1, 128);
  const snappedSubdiv = clamp(Math.round(subdiv), 1, 8);
  const cols = 16;
  let rows = 1;
  if (clampedLength <= 16) rows = 1;
  else if (clampedLength <= 32) rows = 2;
  else if (clampedLength <= 48) rows = 3;
  else if (clampedLength <= 64) rows = 4;
  else if (clampedLength <= 96) rows = 6;
  else rows = 8;

  if (snappedSubdiv <= 2 && clampedLength > 96) rows = 7;
  return { cols, rows };
}

function resolvePhraseSpan(cols: number, subdiv: number) {
  if (cols >= 24) return 8;
  if (cols <= 8) return 2;
  if (subdiv >= 4) return 8;
  return 4;
}

function resolveAnimatedStepIndex(timeMs: number, module: TriggerModule, steps: number) {
  const phase = resolveAnimatedSweepPhase(timeMs, module);
  return clamp(Math.floor(phase * steps), 0, Math.max(0, steps - 1));
}

function resolveAnimatedSweepPhase(timeMs: number, module: TriggerModule) {
  const speedBase = 0.45 + (module.subdiv - 1) * 0.15;
  const speedShape = module.weird * 0.25 + module.gravity * 0.18;
  const cycleSeconds = clamp(2.2 - speedBase - speedShape, 0.45, 3.2);
  return ((timeMs / 1000) / cycleSeconds + module.seed * 0.00021 + module.euclidRot * 0.007) % 1;
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

function buildRadarPattern(module: TriggerModule, steps: number) {
  const out = new Uint8Array(steps);
  const targetCount = clamp(2 + Math.round(module.density * 9 + module.gravity * 2), 2, 12);
  const threshold = clamp(0.42 - module.density * 0.16, 0.12, 0.62);
  const fieldRadius = 62;
  const rangeRadius = fieldRadius * (0.28 + radarRangeNorm(module) * 0.72);
  const targets = Array.from({ length: targetCount }, (_, index) => createRadarTargetState(module, index, fieldRadius));
  const motionPerStep = 0.72 + clamp(module.weird, 0, 1) * 0.66;
  for (let i = 0; i < steps; i++) {
    const phase = i / steps;
    const sweepAngle = phase * Math.PI * 2 - Math.PI / 2;
    let strongest = 0;
    for (let target = 0; target < targetCount; target++) {
      const model = targets[target];
      if (!model) continue;
      stepRadarTarget(model, motionPerStep, fieldRadius);
      if (Math.hypot(model.x, model.y) > rangeRadius) continue;
      strongest = Math.max(strongest, radarDetectionStrength(model.x, model.y, module, sweepAngle, fieldRadius));
    }
    out[i] = strongest > threshold ? 1 : 0;
    if (out[i] === 1 && radarStepRandom(module.seed ^ 0x7ac5, "drop", i) < module.drop * 0.42) out[i] = 0;
  }
  return out;
}

function radarRangeNorm(module: TriggerModule) {
  return clamp((module.length - 4) / (128 - 4), 0, 1);
}

function createRadarTargetState(module: TriggerModule, index: number, fieldRadius: number) {
  const anchor = radarStepRandom(module.seed ^ 0x79e2, `target:${index}`, index);
  const angle = anchor * Math.PI * 2 - Math.PI / 2;
  const bias = clamp(module.gravity, 0, 1);
  const radialRand = radarStepRandom(module.seed ^ 0x56a3, `radius:${index}`, index);
  const radiusNorm = clamp(Math.pow(radialRand, 0.55 + bias * 1.2), 0.04, 1);
  const radius = radiusNorm * fieldRadius;
  const speedMin = 0.045 + clamp(module.weird, 0, 1) * 0.05;
  const speed = speedMin + radarStepRandom(module.seed ^ 0x1f2a, `speed:${index}`, index) * 0.16;
  const heading = radarStepRandom(module.seed ^ 0x8bc7, `heading:${index}`, index) * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
    radiusNorm,
  };
}

function stepRadarTarget(target: { x: number; y: number; vx: number; vy: number }, speedScale: number, fieldRadius: number) {
  target.x += target.vx * speedScale;
  target.y += target.vy * speedScale;
  if (target.x > fieldRadius) target.x = -fieldRadius;
  else if (target.x < -fieldRadius) target.x = fieldRadius;
  if (target.y > fieldRadius) target.y = -fieldRadius;
  else if (target.y < -fieldRadius) target.y = fieldRadius;
}

function radarDetectionStrength(x: number, y: number, module: TriggerModule, sweepAngle: number, fieldRadius: number) {
  const lock = clamp(module.determinism, 0, 1);
  const bias = clamp(module.gravity, 0, 1);
  const rangeNorm = clamp(Math.hypot(x, y) / Math.max(1, fieldRadius * (0.34 + clamp(module.length / 128, 0.08, 1) * 0.66)), 0, 1);
  const targetAngle = Math.atan2(y, x);
  const delta = Math.abs(Math.atan2(Math.sin(targetAngle - sweepAngle), Math.cos(targetAngle - sweepAngle)));
  const beamHalfWidth = 0.58 - lock * 0.44;
  const alignment = clamp(1 - delta / Math.max(0.04, beamHalfWidth), 0, 1);
  const proximity = Math.pow(1 - rangeNorm, 0.75);
  const biasFocus = clamp(1 - Math.abs(rangeNorm - (1 - bias)) * 1.25, 0.6, 1);
  return alignment * proximity * biasFocus;
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return h | 0;
}

function radarStepRandom(seed: number, id: string, stepIndex: number) {
  let x = (seed | 0) ^ hashString(id) ^ Math.imul(stepIndex | 0, 0x9e3779b1);
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
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
