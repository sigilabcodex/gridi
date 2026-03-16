import type { Mode, TriggerModule } from "../../patch";
import { genStepPattern } from "./stepPatternModule.ts";

const MAX_PATTERN_STEPS = 128;
const EPS = 1e-9;

export type PatternEvent = {
  readonly voiceId: string;
  readonly beatOffset: number;
};

export type PatternEventWindow = {
  readonly startBeat: number;
  readonly endBeat: number;
  readonly events: readonly PatternEvent[];
};

export type PatternRenderRequest = {
  readonly voiceId: string;
  readonly trigger: TriggerModule;
  readonly startBeat: number;
  readonly endBeat: number;
};

export type PatternModule = {
  readonly id: string;
  readonly kind: string;
  renderWindow(request: PatternRenderRequest): PatternEventWindow;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function patternLength(trigger: TriggerModule) {
  return Math.max(1, Math.min(MAX_PATTERN_STEPS, trigger.length | 0));
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return h | 0;
}

function stepRandom01(seed: number, voiceId: string, stepIndex: number) {
  let x = (seed | 0) ^ hashString(voiceId) ^ Math.imul(stepIndex | 0, 0x9e3779b1);
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function xorshift32(seed: number) {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function rotatePattern(p: Uint8Array, rot: number) {
  const n = p.length;
  if (n <= 1) return p;
  const shift = ((rot | 0) % n + n) % n;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = p[(i - shift + n) % n];
  return out;
}

function bjorklund(steps: number, pulses: number) {
  const n = Math.max(1, steps | 0);
  const k = Math.max(0, Math.min(n, pulses | 0));
  if (k === 0) return new Uint8Array(n);
  if (k === n) return Uint8Array.from({ length: n }, () => 1);

  const pattern: number[] = [];
  const counts: number[] = [];
  const remainders: number[] = [k];
  let divisor = n - k;
  let level = 0;

  while (true) {
    counts.push(Math.floor(divisor / remainders[level]));
    remainders.push(divisor % remainders[level]);
    divisor = remainders[level];
    level++;
    if (remainders[level] <= 1) break;
  }
  counts.push(divisor);

  const build = (l: number) => {
    if (l === -1) pattern.push(0);
    else if (l === -2) pattern.push(1);
    else {
      for (let i = 0; i < counts[l]; i++) build(l - 1);
      if (remainders[l] !== 0) build(l - 2);
    }
  };

  build(level);
  const out = pattern.slice(0, n);
  const firstOne = out.indexOf(1);
  const normalized = firstOne > 0 ? firstOne : 0;
  return Uint8Array.from(out.slice(normalized).concat(out.slice(0, normalized)));
}

function genEuclidPattern(trigger: TriggerModule) {
  const n = patternLength(trigger);
  const pulses = Math.round(clamp01(trigger.density) * n);
  const base = bjorklund(n, pulses);
  const phase = (trigger.euclidRot | 0)
    + Math.round((clamp01(trigger.gravity) - 0.5) * n * 0.25)
    + Math.round((clamp01(trigger.weird) - 0.5) * n * 0.2);
  return rotatePattern(base, phase);
}

function genCAPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const rule = (trigger.caRule | 0) & 255;
  const rnd = xorshift32((trigger.seed ^ 0x9e3779b9) | 0);

  let cur = new Uint8Array(n);
  for (let i = 0; i < n; i++) cur[i] = rnd() < clamp01(trigger.caInit) ? 1 : 0;

  const iters = 2 + Math.floor(clamp01(trigger.gravity) * 14 + clamp01(trigger.weird) * 4);
  let next = new Uint8Array(n);

  for (let t = 0; t < iters; t++) {
    for (let i = 0; i < n; i++) {
      const idx = (cur[(i - 1 + n) % n] << 2) | (cur[i] << 1) | cur[(i + 1) % n];
      next[i] = (rule >> idx) & 1;
    }
    [cur, next] = [next, cur];
  }

  const density = clamp01(trigger.density);
  if (density >= 0.999) return cur;

  const gated = new Uint8Array(n);
  for (let i = 0; i < n; i++) gated[i] = cur[i] && stepRandom01(trigger.seed ^ 0x44d, voiceId, i) < density ? 1 : 0;
  return gated;
}

function genHybridPattern(trigger: TriggerModule, voiceId: string) {
  const euclid = genEuclidPattern(trigger);
  const ca = genCAPattern(trigger, voiceId);
  const step = genStepPattern(trigger);
  const out = new Uint8Array(Math.min(euclid.length, ca.length, step.length));

  const det = clamp01(trigger.determinism);
  const weird = clamp01(trigger.weird);
  const blendNoise = xorshift32((trigger.seed ^ 0x13579bdf) | 0);

  for (let i = 0; i < out.length; i++) {
    const structural = det >= 0.5 ? (euclid[i] && ca[i]) : (euclid[i] || ca[i]);
    const chaosMix = blendNoise() < weird * 0.5 ? step[i] : structural;
    out[i] = chaosMix && blendNoise() >= clamp01(trigger.gravity) * 0.25 ? 1 : 0;
  }

  return out;
}

function genFractalProtoPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const density = clamp01(trigger.density);
  const weird = clamp01(trigger.weird);
  const proto = new Uint8Array([1, density > 0.5 ? 1 : 0]);
  const out = new Uint8Array(n);
  const maxBits = Math.ceil(Math.log2(Math.max(2, n)));
  const seedMask = (trigger.seed ^ ((trigger.caRule | 0) << 8) ^ (trigger.euclidRot | 0)) >>> 0;

  for (let i = 0; i < n; i++) {
    let fold = 0;
    for (let b = 0; b < maxBits; b++) fold ^= ((i >> b) & 1) ^ ((seedMask >> (b % 24)) & 1);
    const threshold = density - clamp01(trigger.gravity) * 0.3 + (fold ? weird * 0.15 : -weird * 0.1);
    out[i] = proto[fold & 1] && stepRandom01(trigger.seed ^ 0x777, voiceId, i) < clamp01(threshold) ? 1 : 0;
  }

  return out;
}

function patternForMode(mode: Mode, trigger: TriggerModule, voiceId: string) {
  if (mode === "step") return genStepPattern(trigger);
  if (mode === "euclid") {
    const base = genEuclidPattern(trigger);
    const out = new Uint8Array(base.length);
    const rnd = xorshift32((trigger.seed ^ 0x5f3759df) | 0);
    for (let i = 0; i < base.length; i++) {
      const flip = rnd() < clamp01(trigger.weird) * (1 - clamp01(trigger.determinism)) * 0.35;
      out[i] = flip ? (base[i] ? 0 : 1) : base[i];
    }
    return out;
  }
  if (mode === "ca") return genCAPattern(trigger, voiceId);
  if (mode === "fractal") return genFractalProtoPattern(trigger, voiceId);
  return genHybridPattern(trigger, voiceId);
}

function toStepWindowEvents(pattern: Uint8Array, trigger: TriggerModule, voiceId: string, startBeat: number, endBeat: number): PatternEventWindow {
  const subdiv = Math.max(1, trigger.subdiv | 0);
  const stepsPerBeat = 2 * subdiv;
  const firstStep = Math.ceil(startBeat * stepsPerBeat - EPS);
  const drop = clamp01(trigger.drop);
  const events: PatternEvent[] = [];

  for (let step = firstStep; ; step++) {
    const beat = step / stepsPerBeat;
    if (beat >= endBeat - EPS) break;
    if (beat < startBeat - EPS) continue;
    const idx = pattern.length > 0 ? ((step % pattern.length) + pattern.length) % pattern.length : 0;
    if (pattern[idx] !== 1) continue;
    if (drop > 0 && stepRandom01(trigger.seed, voiceId, step) < drop) continue;
    events.push({ voiceId, beatOffset: beat - startBeat });
  }

  return { startBeat, endBeat, events };
}

export function createPatternModuleForTrigger(trigger: TriggerModule): PatternModule {
  return {
    id: `pattern:trigger:${trigger.id}:${trigger.mode}`,
    kind: trigger.mode,
    renderWindow(request) {
      const pattern = patternForMode(trigger.mode, request.trigger, request.voiceId);
      return toStepWindowEvents(pattern, request.trigger, request.voiceId, request.startBeat, request.endBeat);
    },
  };
}
