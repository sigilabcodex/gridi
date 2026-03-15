import type { Mode, VoiceModule } from "../../patch";
import { genStepPattern } from "./stepPatternModule";

const MAX_PATTERN_STEPS = 128;
const EPS = 1e-9;

export type PatternSourceRef =
  | { readonly type: "self" }
  | { readonly type: "module"; readonly moduleId: string };

export type PatternEvent = {
  readonly voiceId: string;
  readonly beatOffset: number;
  readonly velocity?: number;
  readonly eventId?: string;
};

export type PatternEventWindow = {
  readonly startBeat: number;
  readonly endBeat: number;
  readonly events: readonly PatternEvent[];
};

export type PatternRenderRequest = {
  readonly voiceId: string;
  readonly voice: VoiceModule;
  readonly source: PatternSourceRef;
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

function patternLength(voice: VoiceModule) {
  return Math.max(1, Math.min(MAX_PATTERN_STEPS, voice.length | 0));
}

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) | 0;
  return h | 0;
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

function stepRandom01(seed: number, voiceId: string, stepIndex: number) {
  let x = (seed | 0) ^ hashString(voiceId) ^ Math.imul(stepIndex | 0, 0x9e3779b1);
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function rotatePattern(p: Uint8Array, rot: number) {
  const n = p.length;
  if (n <= 1) return p;
  const normalized = ((rot | 0) % n + n) % n;
  if (normalized === 0) return p;

  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = p[(i - normalized + n) % n];
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

  function build(l: number) {
    if (l === -1) pattern.push(0);
    else if (l === -2) pattern.push(1);
    else {
      for (let i = 0; i < counts[l]; i++) build(l - 1);
      if (remainders[l] !== 0) build(l - 2);
    }
  }

  build(level);

  const out = pattern.slice(0, n);
  const firstOne = out.indexOf(1);
  const normalized = firstOne > 0 ? firstOne : 0;
  return Uint8Array.from(out.slice(normalized).concat(out.slice(0, normalized)));
}

function mutatePatternDeterministically(base: Uint8Array, voice: VoiceModule) {
  const n = base.length;
  const out = new Uint8Array(n);
  const rnd = xorshift32((voice.seed ^ 0x5f3759df) | 0);
  const weird = clamp01(voice.weird);
  const det = clamp01(voice.determinism);

  for (let i = 0; i < n; i++) {
    const flipChance = weird * (1 - det) * 0.35;
    const flip = rnd() < flipChance;
    out[i] = flip ? (base[i] ? 0 : 1) : base[i];
  }
  return out;
}

function genEuclidPattern(voice: VoiceModule) {
  const n = patternLength(voice);
  const density = clamp01(voice.density);
  const pulses = Math.round(density * n);
  const base = bjorklund(n, pulses);

  const gravityBias = Math.round((clamp01(voice.gravity) - 0.5) * n * 0.25);
  const weirdBias = Math.round((clamp01(voice.weird) - 0.5) * n * 0.2);
  const phase = (voice.euclidRot | 0) + gravityBias + weirdBias;

  return rotatePattern(base, phase);
}

function genCAPattern(voice: VoiceModule) {
  const n = patternLength(voice);
  const rule = (voice.caRule | 0) & 255;
  const rnd = xorshift32((voice.seed ^ 0x9e3779b9) | 0);

  const init = new Uint8Array(n);
  const initProb = clamp01(voice.caInit);
  for (let i = 0; i < n; i++) init[i] = rnd() < initProb ? 1 : 0;

  const gravity = clamp01(voice.gravity);
  const weird = clamp01(voice.weird);
  const iters = 2 + Math.floor(gravity * 14 + weird * 4);

  let cur = init;
  let next = new Uint8Array(n);
  for (let t = 0; t < iters; t++) {
    for (let i = 0; i < n; i++) {
      const left = cur[(i - 1 + n) % n];
      const center = cur[i];
      const right = cur[(i + 1) % n];
      const idx = (left << 2) | (center << 1) | right;
      next[i] = (rule >> idx) & 1;
    }

    const tmp = cur;
    cur = next;
    next = tmp;
  }

  // density softly gates occupancy so CA stays responsive to the density macro.
  const density = clamp01(voice.density);
  if (density >= 0.999) return cur;

  const gated = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const keep = stepRandom01(voice.seed ^ 0x44d, voice.id, i) < density;
    gated[i] = cur[i] && keep ? 1 : 0;
  }
  return gated;
}

function genHybridPattern(voice: VoiceModule) {
  const euclid = genEuclidPattern(voice);
  const ca = genCAPattern(voice);
  const step = genStepPattern(voice);
  const n = Math.min(euclid.length, ca.length, step.length);
  const out = new Uint8Array(n);

  const det = clamp01(voice.determinism);
  const weird = clamp01(voice.weird);
  const blendNoise = xorshift32((voice.seed ^ 0x13579bdf) | 0);

  for (let i = 0; i < n; i++) {
    const structural = det >= 0.5 ? (euclid[i] && ca[i]) : (euclid[i] || ca[i]);
    const chaosMix = blendNoise() < weird * 0.5 ? step[i] : structural;
    const gravityGate = clamp01(voice.gravity) * 0.25;
    out[i] = chaosMix && blendNoise() >= gravityGate ? 1 : 0;
  }

  return out;
}

function genFractalProtoPattern(voice: VoiceModule) {
  const n = patternLength(voice);
  const density = clamp01(voice.density);
  const weird = clamp01(voice.weird);
  const proto = new Uint8Array([1, density > 0.5 ? 1 : 0]);
  const out = new Uint8Array(n);

  const maxBits = Math.ceil(Math.log2(Math.max(2, n)));
  const seedMask = (voice.seed ^ ((voice.caRule | 0) << 8) ^ (voice.euclidRot | 0)) >>> 0;

  for (let i = 0; i < n; i++) {
    // Deterministic proto-fractal fold: xor a small set of index bits then project to proto motif.
    let fold = 0;
    for (let b = 0; b < maxBits; b++) {
      const bit = (i >> b) & 1;
      const seedBit = (seedMask >> (b % 24)) & 1;
      fold ^= bit ^ seedBit;
    }

    const protoHit = proto[fold & 1] === 1;
    const gravityBias = clamp01(voice.gravity) * 0.3;
    const threshold = density - gravityBias + (fold ? weird * 0.15 : -weird * 0.1);
    const gate = stepRandom01(voice.seed ^ 0x777, voice.id, i) < clamp01(threshold);
    out[i] = protoHit && gate ? 1 : 0;
  }

  return out;
}

const MODE_ENGINES: Record<Mode, (voice: VoiceModule) => Uint8Array> = {
  step: (voice) => genStepPattern(voice),
  euclid: (voice) => mutatePatternDeterministically(genEuclidPattern(voice), voice),
  ca: (voice) => genCAPattern(voice),
  hybrid: (voice) => genHybridPattern(voice),
  fractal: (voice) => genFractalProtoPattern(voice),
};

function toStepWindowEvents(params: {
  pattern: Uint8Array;
  voice: VoiceModule;
  voiceId: string;
  startBeat: number;
  endBeat: number;
}): PatternEventWindow {
  const { pattern, voice, voiceId, startBeat, endBeat } = params;
  const subdiv = Math.max(1, voice.subdiv | 0);
  const stepsPerBeat = 2 * subdiv;
  const firstStep = Math.ceil(startBeat * stepsPerBeat - EPS);
  const drop = clamp01(voice.drop);
  const events: PatternEvent[] = [];

  for (let step = firstStep; ; step++) {
    const beat = step / stepsPerBeat;
    if (beat >= endBeat - EPS) break;
    if (beat < startBeat - EPS) continue;

    const idx = pattern.length > 0 ? ((step % pattern.length) + pattern.length) % pattern.length : 0;
    if (pattern[idx] !== 1) continue;
    if (drop > 0 && stepRandom01(voice.seed, voiceId, step) < drop) continue;

    events.push({
      voiceId,
      beatOffset: beat - startBeat,
    });
  }

  return {
    startBeat,
    endBeat,
    events,
  };
}

export function createPatternModuleForMode(mode: Mode): PatternModule {
  return {
    id: `pattern:self:${mode}`,
    kind: mode,
    renderWindow(request) {
      const pattern = MODE_ENGINES[mode](request.voice);
      return toStepWindowEvents({
        pattern,
        voice: request.voice,
        voiceId: request.voiceId,
        startBeat: request.startBeat,
        endBeat: request.endBeat,
      });
    },
  };
}

export function createStepPatternModule(): PatternModule {
  return createPatternModuleForMode("step");
}

export function createPatternModuleForVoice(voice: VoiceModule): PatternModule {
  return createPatternModuleForMode(voice.mode);
}
