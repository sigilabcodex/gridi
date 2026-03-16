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

function genEuclidPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const density = clamp01(trigger.density);
  const pulses = Math.round(density * n);
  const base = bjorklund(n, pulses);
  const rotated = rotatePattern(base, trigger.euclidRot | 0);
  const out = rotated.slice();

  const det = clamp01(trigger.determinism);
  const weird = clamp01(trigger.weird);
  const gravity = clamp01(trigger.gravity);
  const warp = weird * (1 - det);

  if (warp > 0.001) {
    for (let i = 0; i < n; i++) {
      if (rotated[i] !== 1) continue;
      if (stepRandom01(trigger.seed ^ 0x55aa11, voiceId, i) >= warp * 0.5) continue;
      out[i] = 0;
      const shiftDir = stepRandom01(trigger.seed ^ 0x55aa99, voiceId, i) < 0.5 ? -1 : 1;
      const target = ((i + shiftDir + n) % n);
      out[target] = 1;
    }
  }

  if (gravity > 0.001) {
    const anchorSpan = Math.max(1, Math.round(n / Math.max(1, trigger.subdiv | 0)));
    for (let i = 0; i < n; i++) {
      if (out[i] !== 1) continue;
      const nearest = Math.round(i / anchorSpan) * anchorSpan;
      const anchorDist = Math.abs(nearest - i);
      const pull = (1 - anchorDist / anchorSpan) * gravity;
      if (stepRandom01(trigger.seed ^ 0x7700aa, voiceId, i) < pull * 0.1) {
        out[i] = 0;
        out[((nearest % n) + n) % n] = 1;
      }
    }
  }

  return out;
}

function genCAPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const density = clamp01(trigger.density);
  const rule = (trigger.caRule | 0) & 255;
  const generations = Math.max(1, Math.min(MAX_PATTERN_STEPS, Math.round(4 + n * (0.5 + clamp01(trigger.gravity) * 2))));
  const width = n;

  let current = new Uint8Array(width);
  for (let i = 0; i < width; i++) {
    current[i] = stepRandom01(trigger.seed ^ 0x41c64e6d, voiceId, i) < clamp01(trigger.caInit) ? 1 : 0;
  }

  const sample = new Uint8Array(generations * width);
  sample.set(current, 0);

  for (let g = 1; g < generations; g++) {
    const next = new Uint8Array(width);
    for (let i = 0; i < width; i++) {
      const neighborhood = (current[(i - 1 + width) % width] << 2) | (current[i] << 1) | current[(i + 1) % width];
      next[i] = (rule >> neighborhood) & 1;
    }
    current = next;
    sample.set(current, g * width);
  }

  const out = new Uint8Array(n);
  const weird = clamp01(trigger.weird);
  const diagonalSkew = Math.round((weird - 0.5) * width * 0.4);

  for (let step = 0; step < n; step++) {
    const row = step % generations;
    const col = (step + row + diagonalSkew + width) % width;
    let bit = sample[row * width + col];

    if (density < 0.999 && bit === 1 && stepRandom01(trigger.seed ^ 0x10203040, voiceId, step) >= density) bit = 0;
    if (density > 0.001 && bit === 0 && stepRandom01(trigger.seed ^ 0x99887766, voiceId, step) < (density - 0.5) * weird * 0.35) bit = 1;

    out[step] = bit;
  }

  return out;
}

function genHybridPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const step = genStepPattern(trigger);
  const euclid = genEuclidPattern(trigger, voiceId);
  const ca = genCAPattern(trigger, voiceId);
  const out = new Uint8Array(n);

  const det = clamp01(trigger.determinism);
  const weird = clamp01(trigger.weird);
  const gravity = clamp01(trigger.gravity);

  for (let i = 0; i < n; i++) {
    const scaffold = euclid[i] || (gravity > 0.5 ? step[i] : 0);
    const texture = ca[i] && (step[i] || weird > 0.35);
    const structural = det >= 0.5 ? (scaffold && (texture || step[i])) : (scaffold || texture);

    let bit = structural ? 1 : 0;
    if (weird > 0.001 && stepRandom01(trigger.seed ^ 0x1234abcd, voiceId, i) < weird * (1 - det) * 0.4) bit = bit ? 0 : 1;
    out[i] = bit;
  }

  return out;
}

function highestPowerOfTwoAtMost(n: number) {
  let p = 1;
  while ((p << 1) <= n) p <<= 1;
  return p;
}

function genFractalPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const density = clamp01(trigger.density);
  const det = clamp01(trigger.determinism);
  const weird = clamp01(trigger.weird);
  const gravity = clamp01(trigger.gravity);

  const scale = highestPowerOfTwoAtMost(Math.max(2, n));
  const levels = Math.max(1, Math.floor(Math.log2(scale)));
  const out = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    let score = 0;
    let stepScale = 1;

    for (let l = 0; l < levels; l++) {
      const block = Math.floor(i / stepScale);
      const gate = stepRandom01(trigger.seed ^ (l * 0x45d9f3b), voiceId, block + (trigger.euclidRot | 0));
      const threshold = 0.5 - det * 0.35 + (gravity - 0.5) * 0.2;
      if (gate > threshold) score += 1 / (l + 1);
      if ((block & 1) === 1 && weird > 0.4) score += weird * 0.05;
      stepScale <<= 1;
    }

    const normalized = score / Math.max(1, levels * 0.75);
    const finalThreshold = density * (0.65 + weird * 0.25);
    out[i] = normalized >= finalThreshold ? 1 : 0;
  }

  return out;
}

function patternForMode(mode: Mode, trigger: TriggerModule, voiceId: string) {
  if (mode === "step") return genStepPattern(trigger);
  if (mode === "euclid") return genEuclidPattern(trigger, voiceId);
  if (mode === "ca") return genCAPattern(trigger, voiceId);
  if (mode === "fractal") return genFractalPattern(trigger, voiceId);
  return genHybridPattern(trigger, voiceId);
}

export function getPatternPreview(trigger: TriggerModule, voiceId = "preview", previewSteps = 32) {
  const pattern = patternForMode(trigger.mode, trigger, voiceId);
  if (pattern.length === 0) return "";
  const n = Math.max(1, Math.min(previewSteps | 0, pattern.length));
  let out = "";
  for (let i = 0; i < n; i++) out += pattern[i] ? "●" : "·";
  return out;
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
