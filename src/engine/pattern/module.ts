import type { Mode, TriggerModule } from "../../patch";
import { genStepPattern } from "./stepPatternModule.ts";
import { createGearPattern } from "./gear.ts";

const MAX_PATTERN_STEPS = 128;
const EPS = 1e-9;

export type PatternEvent = {
  readonly voiceId: string;
  readonly beatOffset: number;
  readonly value: number;
  readonly targetLane?: number;
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

function triggerAccentDepth(trigger: TriggerModule) {
  const raw = (trigger as Partial<TriggerModule>).accent;
  return clamp01(typeof raw === "number" ? raw : 0.5);
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

export type NonEuclideanSegmentModel = {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly span: number;
  readonly localTarget: number;
  readonly pulses: number;
  readonly localRotation: number;
  readonly localPulses: Uint8Array;
};

export type NonEuclideanPatternModel = {
  readonly segmentCount: number;
  readonly edges: Int32Array;
  readonly segments: readonly NonEuclideanSegmentModel[];
  readonly warpAmount: number;
  readonly pattern: Uint8Array;
};

export function buildNonEuclideanPatternModel(trigger: TriggerModule, voiceId: string): NonEuclideanPatternModel {
  const n = patternLength(trigger);
  const density = clamp01(trigger.density);
  const weird = clamp01(trigger.weird);
  const gravity = clamp01(trigger.gravity);
  const det = clamp01(trigger.determinism);
  const drop = clamp01(trigger.drop);

  const segmentCount = Math.max(3, Math.min(9, 3 + Math.round(weird * 6 + gravity * 2)));
  const edgeSeed = trigger.seed ^ 0x7f4a7c15 ^ hashString(voiceId);
  const edges = new Int32Array(segmentCount + 1);
  edges[0] = 0;
  for (let i = 1; i < segmentCount; i++) {
    const t = i / segmentCount;
    const warp = Math.pow(t, 0.65 + weird * 1.3) * (0.75 + stepRandom01(edgeSeed, voiceId, i) * 0.5);
    edges[i] = Math.max(edges[i - 1] + 1, Math.min(n - (segmentCount - i), Math.round(warp * n)));
  }
  edges[segmentCount] = n;

  const out = new Uint8Array(n);
  const segments: NonEuclideanSegmentModel[] = [];
  for (let seg = 0; seg < segmentCount; seg++) {
    const start = edges[seg];
    const end = Math.max(start + 1, edges[seg + 1]);
    const span = end - start;
    const segShape = 0.7 + stepRandom01(edgeSeed ^ 0x99a5, voiceId, seg) * 0.8;
    const localTarget = clamp01(density * (0.55 + segShape * 0.6) + (seg % 2 === 0 ? gravity * 0.15 : -gravity * 0.08));
    const pulses = Math.max(0, Math.min(span, Math.round(span * localTarget)));
    const local = bjorklund(span, pulses);
    const localRot = Math.round((trigger.euclidRot | 0) * (seg % 2 === 0 ? 1 : -0.5) + weird * span * 0.35 * (stepRandom01(edgeSeed ^ 0x6123, voiceId, seg) - 0.5));
    const rotatedLocal = rotatePattern(local, localRot);

    segments.push({
      index: seg,
      start,
      end,
      span,
      localTarget,
      pulses,
      localRotation: localRot,
      localPulses: rotatedLocal,
    });

    for (let i = 0; i < span; i++) {
      let bit = rotatedLocal[i];
      const idx = start + i;
      const edgeBias = Math.abs(i / Math.max(1, span - 1) - 0.5);
      const bendChance = weird * (1 - det) * (0.18 + edgeBias * 0.22);
      if (bit && stepRandom01(edgeSeed ^ 0x18cd, voiceId, idx) < bendChance) {
        bit = 0;
        const offset = stepRandom01(edgeSeed ^ 0x18ef, voiceId, idx) < 0.5 ? -1 : 1;
        const to = start + ((i + offset + span) % span);
        out[to] = 1;
      }
      if (bit && stepRandom01(edgeSeed ^ 0x44d1, voiceId, idx) < drop * 0.55) bit = 0;
      if (!bit && stepRandom01(edgeSeed ^ 0x52aa, voiceId, idx) < weird * gravity * 0.08) bit = 1;
      if (bit) out[idx] = 1;
    }
  }

  return {
    segmentCount,
    edges,
    segments,
    warpAmount: weird,
    pattern: out,
  };
}

function genNonEuclideanPattern(trigger: TriggerModule, voiceId: string) {
  return buildNonEuclideanPatternModel(trigger, voiceId).pattern;
}
function genMarkovPattern(trigger: TriggerModule, voiceId: string) {
  return buildMarkovPatternModel(trigger, voiceId).pattern;
}

export type MarkovPatternModel = {
  readonly pattern: Uint8Array;
  readonly statePath: Uint8Array;
  readonly p11: Float32Array;
  readonly p01: Float32Array;
};

export function buildMarkovPatternModel(trigger: TriggerModule, voiceId: string): MarkovPatternModel {
  const n = patternLength(trigger);
  const density = clamp01(trigger.density);
  const weird = clamp01(trigger.weird);
  const det = clamp01(trigger.determinism);
  const gravity = clamp01(trigger.gravity);
  const out = new Uint8Array(n);
  const statePath = new Uint8Array(n);
  const p11 = new Float32Array(n);
  const p01 = new Float32Array(n);

  let state = stepRandom01(trigger.seed ^ 0x1badf00d, voiceId, 0) < density ? 1 : 0;
  for (let i = 0; i < n; i++) {
    const anchor = i % Math.max(1, Math.round(8 / Math.max(1, trigger.subdiv | 0))) === 0 ? 1 : 0;
    const stayHot = clamp01(0.35 + det * 0.55 + gravity * 0.15 - weird * 0.2 + anchor * gravity * 0.15);
    const rise = clamp01(0.04 + density * 0.86 + weird * 0.28 - det * 0.35 + anchor * gravity * 0.2);
    p11[i] = stayHot;
    p01[i] = rise;
    const r = stepRandom01(trigger.seed ^ 0x31f0 + i * 17, voiceId, i);
    state = state === 1 ? (r < stayHot ? 1 : 0) : (r < rise ? 1 : 0);
    if (state === 1 && stepRandom01(trigger.seed ^ 0x8ac4 + i * 13, voiceId, i) < trigger.drop * 0.5) state = 0;
    statePath[i] = state;
    out[i] = state;
  }

  const rot = trigger.euclidRot | 0;
  return {
    pattern: rotatePattern(out, rot),
    statePath: rotatePattern(statePath, rot),
    p11: rotateFloatPattern(p11, rot),
    p01: rotateFloatPattern(p01, rot),
  };
}

function rotateFloatPattern(p: Float32Array, rot: number) {
  const n = p.length;
  if (n <= 1) return p;
  const shift = ((rot | 0) % n + n) % n;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = p[(i - shift + n) % n];
  return out;
}

function genLSystemsPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const weird = clamp01(trigger.weird);
  const det = clamp01(trigger.determinism);
  const density = clamp01(trigger.density);
  const branch = clamp01(trigger.gravity);
  const depth = Math.max(2, Math.min(6, 2 + Math.round((n / 128) * 3 + weird * 2)));

  let tokens: number[] = [1];
  for (let gen = 0; gen < depth; gen++) {
    const next: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const symbol = tokens[i];
      const mutation = stepRandom01(trigger.seed ^ 0x777 + gen * 41 + i * 3, voiceId, i);
      if (symbol === 1) {
        const split = mutation < (0.2 + weird * 0.5) ? 1 : 0;
        if (split) next.push(1, 0, 1, branch > 0.55 ? 1 : 0);
        else next.push(1, 0, 1);
      } else if (symbol === 0) {
        next.push(mutation < (0.08 + weird * 0.15) ? 1 : 0);
      } else {
        next.push(symbol);
      }
      if (next.length >= n * 4) break;
    }
    tokens = next.length ? next : [1];
  }

  if (tokens.length < n) {
    const loop = tokens.slice();
    while (tokens.length < n) tokens.push(...loop);
  }
  tokens = tokens.slice(0, n);

  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const idx = ((i + (trigger.euclidRot | 0)) % n + n) % n;
    let bit = tokens[idx] ? 1 : 0;
    const life = 0.55 + det * 0.35 - weird * 0.2;
    if (bit && stepRandom01(trigger.seed ^ 0x2001 + i * 29, voiceId, i) > life) bit = 0;
    if (!bit && stepRandom01(trigger.seed ^ 0x2011 + i * 31, voiceId, i) < density * branch * 0.15) bit = 1;
    if (bit && stepRandom01(trigger.seed ^ 0x2021 + i * 37, voiceId, i) < trigger.drop * 0.42) bit = 0;
    out[i] = bit;
  }

  return out;
}

function genXronoMorphPattern(trigger: TriggerModule, voiceId: string) {
  return buildXronoMorphPatternModel(trigger, voiceId).output;
}

export type XronoMorphPatternModel = {
  readonly sourceEuclid: Uint8Array;
  readonly sourceCA: Uint8Array;
  readonly sourceStep: Uint8Array;
  readonly output: Uint8Array;
  readonly agreement: Uint8Array;
  readonly chooser: Float32Array;
  readonly phase: Float32Array;
  readonly dominantSourceByStep: Uint8Array;
};

export function buildXronoMorphPatternModel(trigger: TriggerModule, voiceId: string): XronoMorphPatternModel {
  const n = patternLength(trigger);
  const morph = clamp01(trigger.weird);
  const det = clamp01(trigger.determinism);
  const gravity = clamp01(trigger.gravity);

  const sourceEuclid = genEuclidPattern({ ...trigger, density: clamp01(trigger.density * 0.9 + gravity * 0.1) }, voiceId);
  const sourceCA = genCAPattern({ ...trigger, caRule: (trigger.caRule + 73) & 255, caInit: clamp01(trigger.caInit * 0.75 + 0.1) }, voiceId);
  const sourceStep = genStepPattern({ ...trigger, density: clamp01(trigger.density * 0.8 + morph * 0.15) });

  const output = new Uint8Array(n);
  const agreement = new Uint8Array(n);
  const chooserTrack = new Float32Array(n);
  const phaseTrack = new Float32Array(n);
  const dominantSourceByStep = new Uint8Array(n);
  const phaseRate = 0.7 + (trigger.subdiv | 0) * 0.22 + morph * 0.5;
  for (let i = 0; i < n; i++) {
    const phase = ((i / Math.max(1, n - 1)) * phaseRate + trigger.seed * 0.00091 + (trigger.euclidRot | 0) * 0.013) % 1;
    const chooser = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;
    const a = sourceEuclid[i];
    const b = sourceCA[(i + Math.round(phase * 5)) % n];
    const c = sourceStep[(i + Math.round((1 - phase) * 7)) % n];
    const blend = chooser < 0.33 ? a : chooser < 0.66 ? b : c;
    const fuse = det > 0.58 ? ((a && b) || (blend && c)) : (blend || (morph > 0.45 ? a ^ b : 0));
    let bit = fuse ? 1 : 0;
    if (bit && stepRandom01(trigger.seed ^ 0x4545 + i * 23, voiceId, i) < trigger.drop * (0.35 + morph * 0.3)) bit = 0;
    if (!bit && stepRandom01(trigger.seed ^ 0x4555 + i * 19, voiceId, i) < morph * (1 - det) * 0.18) bit = 1;
    output[i] = bit;
    agreement[i] = a === b && b === c ? 1 : 0;
    chooserTrack[i] = chooser;
    phaseTrack[i] = phase;
    dominantSourceByStep[i] = chooser < 0.33 ? 0 : chooser < 0.66 ? 1 : 2;
  }
  return { sourceEuclid, sourceCA, sourceStep, output, agreement, chooser: chooserTrack, phase: phaseTrack, dominantSourceByStep };
}

function genGeneticPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const popSize = 6;
  const generations = Math.max(3, Math.min(9, 3 + Math.round(trigger.weird * 6)));
  const target = clamp01(trigger.density);
  const selectPressure = clamp01(trigger.determinism);
  const mutationRate = clamp01(trigger.weird) * (0.08 + (1 - selectPressure) * 0.3);

  const population: Uint8Array[] = [];
  for (let p = 0; p < popSize; p++) {
    const chromosome = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      chromosome[i] = stepRandom01(trigger.seed ^ 0x3355 + p * 47, voiceId, i) < target ? 1 : 0;
    }
    population.push(chromosome);
  }

  const score = (chrom: Uint8Array) => {
    let hits = 0;
    let anchors = 0;
    for (let i = 0; i < chrom.length; i++) {
      if (!chrom[i]) continue;
      hits++;
      if (i % Math.max(1, Math.round(8 / Math.max(1, trigger.subdiv | 0))) === 0) anchors++;
    }
    const densityFit = 1 - Math.abs(hits / Math.max(1, chrom.length) - target);
    const anchorFit = anchors / Math.max(1, Math.ceil(chrom.length / Math.max(1, Math.round(8 / Math.max(1, trigger.subdiv | 0)))));
    return densityFit * 0.78 + anchorFit * clamp01(trigger.gravity) * 0.22;
  };

  for (let gen = 0; gen < generations; gen++) {
    population.sort((a, b) => score(b) - score(a));
    const eliteCount = Math.max(2, Math.round(2 + selectPressure * 2));
    const elites = population.slice(0, eliteCount);
    const next: Uint8Array[] = elites.map((e) => e.slice());

    while (next.length < popSize) {
      const pa = elites[next.length % elites.length];
      const pb = elites[(next.length + 1) % elites.length];
      const child = new Uint8Array(n);
      const split = 1 + Math.floor(stepRandom01(trigger.seed ^ 0x9ab0 + gen * 13, voiceId, next.length) * (n - 1));
      for (let i = 0; i < n; i++) {
        let gene = i < split ? pa[i] : pb[i];
        if (stepRandom01(trigger.seed ^ 0x9af0 + gen * 29 + i * 3, voiceId, i + next.length) < mutationRate) gene = gene ? 0 : 1;
        child[i] = gene;
      }
      next.push(child);
    }
    population.splice(0, population.length, ...next);
  }

  population.sort((a, b) => score(b) - score(a));
  const out = population[0].slice();
  for (let i = 0; i < n; i++) {
    if (out[i] && stepRandom01(trigger.seed ^ 0x58aa + i * 41, voiceId, i) < trigger.drop * 0.55) out[i] = 0;
  }
  return rotatePattern(out, trigger.euclidRot | 0);
}

function genOneOverFPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const density = clamp01(trigger.density);
  const rough = clamp01(trigger.weird);
  const correlation = clamp01(trigger.determinism);
  const drift = clamp01(trigger.gravity);
  const out = new Uint8Array(n);

  let low = stepRandom01(trigger.seed ^ 0xa11f, voiceId, 0);
  let mid = stepRandom01(trigger.seed ^ 0xa12f, voiceId, 1);
  let high = stepRandom01(trigger.seed ^ 0xa13f, voiceId, 2);

  for (let i = 0; i < n; i++) {
    const refreshLow = 0.04 + (1 - correlation) * 0.1;
    const refreshMid = 0.12 + rough * 0.18;
    const refreshHigh = 0.28 + rough * 0.32;
    if (stepRandom01(trigger.seed ^ 0xa21f + i * 3, voiceId, i) < refreshLow) low = stepRandom01(trigger.seed ^ 0xa31f + i * 5, voiceId, i);
    if (stepRandom01(trigger.seed ^ 0xa22f + i * 7, voiceId, i) < refreshMid) mid = stepRandom01(trigger.seed ^ 0xa32f + i * 11, voiceId, i + 1);
    if (stepRandom01(trigger.seed ^ 0xa23f + i * 13, voiceId, i) < refreshHigh) high = stepRandom01(trigger.seed ^ 0xa33f + i * 17, voiceId, i + 2);

    const color = low * 0.58 + mid * 0.3 + high * 0.12;
    const threshold = density + (drift - 0.5) * 0.18 + Math.sin((i / Math.max(1, n)) * Math.PI * 2 + trigger.seed * 0.0007) * drift * 0.08;
    let bit = color < clamp01(threshold) ? 1 : 0;
    if (bit && stepRandom01(trigger.seed ^ 0xa44f + i * 23, voiceId, i) < trigger.drop * 0.48) bit = 0;
    out[i] = bit;
  }

  return rotatePattern(out, trigger.euclidRot | 0);
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

function genRadarPattern(trigger: TriggerModule, voiceId: string) {
  const n = patternLength(trigger);
  const density = clamp01(trigger.density);
  const bias = clamp01(trigger.gravity);
  const out = new Uint8Array(n);
  const targetCount = Math.max(2, Math.min(12, 2 + Math.round(density * 9 + bias * 2)));
  const targets = Array.from({ length: targetCount }, (_, i) => createRadarTargetState(trigger, voiceId, i, 1));
  const threshold = clamp01(0.42 - density * 0.16);
  const motionPerStep = 0.72 + clamp01(trigger.weird) * 0.66;

  for (let step = 0; step < n; step++) {
    const sweep = (((step + (trigger.euclidRot | 0)) % n) + n) % n;
    const sweepPhase = sweep / n;
    const sweepAngle = sweepPhase * Math.PI * 2 - Math.PI / 2;
    let strongest = 0;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target) continue;
      stepRadarTarget(target, motionPerStep, 1);
      const response = radarDetectionStrength(target.x, target.y, trigger, sweepAngle, 1);
      if (response > strongest) strongest = response;
    }
    let bit = strongest > threshold ? 1 : 0;
    if (bit && stepRandom01(trigger.seed ^ 0x7ac5, voiceId, step) < trigger.drop * 0.42) bit = 0;
    out[step] = bit;
  }
  return out;
}

function patternForMode(mode: Mode, trigger: TriggerModule, voiceId: string) {
  const modeId = mode as string;
  const normalizedMode = modeId === "step" ? "step-sequencer"
    : modeId === "euclid" ? "euclidean"
      : modeId === "ca" ? "cellular-automata"
        : mode;
  const generated =
    normalizedMode === "step-sequencer" ? genStepPattern(trigger)
      : normalizedMode === "euclidean" ? genEuclidPattern(trigger, voiceId)
        : normalizedMode === "cellular-automata" ? genCAPattern(trigger, voiceId)
          : normalizedMode === "fractal" ? genFractalPattern(trigger, voiceId)
            : normalizedMode === "non-euclidean" ? genNonEuclideanPattern(trigger, voiceId)
              : normalizedMode === "hybrid" ? genHybridPattern(trigger, voiceId)
                : normalizedMode === "markov-chains" ? genMarkovPattern(trigger, voiceId)
                  : normalizedMode === "l-systems" ? genLSystemsPattern(trigger, voiceId)
                    : normalizedMode === "xronomorph" ? genXronoMorphPattern(trigger, voiceId)
                      : normalizedMode === "genetic-algorithms" ? genGeneticPattern(trigger, voiceId)
                      : normalizedMode === "one-over-f-noise" ? genOneOverFPattern(trigger, voiceId)
                        : normalizedMode === "gear" ? createGearPattern(trigger, voiceId)
                          : normalizedMode === "radar" ? genRadarPattern(trigger, voiceId)
                            : genHybridPattern(trigger, voiceId);
  const live = trigger.liveState;
  if (!live || live.mode !== mode || live.steps !== generated.length || typeof live.pattern !== "string") return generated;
  const out = generated.slice();
  for (let i = 0; i < out.length; i++) out[i] = live.pattern[i] === "1" ? 1 : 0;
  return out;
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
  const modeId = (trigger.mode as string) === "step" ? "step-sequencer"
    : (trigger.mode as string) === "euclid" ? "euclidean"
      : (trigger.mode as string) === "ca" ? "cellular-automata"
        : trigger.mode;
  const subdiv = Math.max(1, trigger.subdiv | 0);
  const stepsPerBeat = 2 * subdiv;
  const firstStep = Math.ceil(startBeat * stepsPerBeat - EPS);
  const drop = clamp01(trigger.drop);
  const events: PatternEvent[] = [];
  const steps = Math.max(1, pattern.length);
  const normalizedStep = (idx: number) => (steps <= 1 ? 0.5 : idx / (steps - 1));
  const totalPulses = pattern.reduce((sum, bit) => sum + (bit ? 1 : 0), 0);

  function pulseIndexNormalized(stepIndex: number) {
    if (totalPulses <= 1) return 0.5;
    let pulseIndex = 0;
    for (let i = 0; i <= stepIndex; i += 1) {
      if (pattern[i % steps] === 1) pulseIndex += 1;
    }
    return Math.max(0, Math.min(1, (pulseIndex - 1) / (totalPulses - 1)));
  }

  function localDensity(stepIndex: number) {
    const radius = 2;
    let sum = 0;
    let count = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const idx = ((stepIndex + offset) % steps + steps) % steps;
      sum += pattern[idx] ? 1 : 0;
      count += 1;
    }
    return count > 0 ? sum / count : 0.5;
  }

  function velocitySignal(step: number, idx: number) {
    const stepNorm = normalizedStep(idx);
    if (modeId === "step-sequencer") return clamp01(0.35 + stepNorm * 0.45);
    if (modeId === "euclidean") return pulseIndexNormalized(idx);
    if (modeId === "markov-chains") return Math.max(0, Math.min(1, localDensity(idx) * 0.6 + stepNorm * 0.4));
    if (modeId === "cellular-automata") return localDensity(idx);
    if (modeId === "fractal") return Math.max(0, Math.min(1, 0.5 + (Math.sin((idx / steps) * Math.PI * 2) * 0.5)));
    if (modeId === "gear") return Math.max(0, Math.min(1, localDensity(idx) * 0.75 + pulseIndexNormalized(idx) * 0.25));
    if (modeId === "radar") return radarReturnStrengthAtStep(trigger, voiceId, idx, steps);
    if (modeId === "one-over-f-noise") return stepRandom01(trigger.seed ^ 0x5f3759df, voiceId, step);
    return stepNorm;
  }

  function normalizedVelocity(structuralVelocity: number) {
    const accentDepth = triggerAccentDepth(trigger);
    const activity = totalPulses / Math.max(1, steps);
    const targetActivity = modeId === "gear" ? 0.3 : modeId === "radar" ? 0.33 : 0.36;
    const activityComp = Math.sqrt(targetActivity / Math.max(0.06, activity));
    const modeCeiling = modeId === "gear" ? 0.78 : modeId === "radar" ? 0.82 : 0.9;
    const modeFloor = modeId === "gear" ? 0.2 : 0.16;
    const stabilized = structuralVelocity * Math.max(0.76, Math.min(1.16, activityComp));
    const neutralVelocity = 0.62;
    const expressive = Math.max(modeFloor, Math.min(modeCeiling, stabilized));
    const blended = neutralVelocity + (expressive - neutralVelocity) * accentDepth;
    return Math.max(modeFloor, Math.min(modeCeiling, blended));
  }

  function stepLane(step: number, idx: number) {
    if (modeId === "step-sequencer") {
      const laneCycle = [0, 2, 1, 3];
      return laneCycle[((step % laneCycle.length) + laneCycle.length) % laneCycle.length] ?? 0;
    }
    if (modeId === "gear") {
      const teeth = Math.max(2, Math.min(16, Math.round(trigger.length / 4)));
      return ((Math.floor((idx / Math.max(1, steps)) * teeth) + (trigger.euclidRot | 0)) % 4 + 4) % 4;
    }
    if (modeId === "radar") {
      return ((Math.floor((idx / Math.max(1, steps)) * 8) + Math.round(trigger.gravity * 3)) % 4 + 4) % 4;
    }
    if (modeId === "fractal") {
      return ((Math.floor(step / Math.max(1, trigger.subdiv | 0)) + Math.round(trigger.weird * 3)) % 4 + 4) % 4;
    }
    return ((idx + Math.round(trigger.gravity * 5)) % 4 + 4) % 4;
  }

  for (let step = firstStep; ; step++) {
    const beat = step / stepsPerBeat;
    if (beat >= endBeat - EPS) break;
    if (beat < startBeat - EPS) continue;
    const idx = pattern.length > 0 ? ((step % pattern.length) + pattern.length) % pattern.length : 0;
    if (pattern[idx] !== 1) continue;
    if (drop > 0 && stepRandom01(trigger.seed, voiceId, step) < drop) continue;
    events.push({
      voiceId,
      beatOffset: beat - startBeat,
      value: normalizedVelocity(velocitySignal(step, idx)),
      targetLane: stepLane(step, idx),
    });
  }

  return { startBeat, endBeat, events };
}

type RadarTargetState = { x: number; y: number; vx: number; vy: number };

function createRadarTargetState(trigger: TriggerModule, voiceId: string, index: number, fieldRadius: number): RadarTargetState {
  const anchor = stepRandom01(trigger.seed ^ 0x79e2, voiceId, index);
  const angle = anchor * Math.PI * 2 - Math.PI / 2;
  const bias = clamp01(trigger.gravity);
  const radialRand = stepRandom01(trigger.seed ^ 0x56a3, voiceId, 500 + index);
  const radiusNorm = Math.max(0.04, Math.min(1, Math.pow(radialRand, 0.55 + bias * 1.2)));
  const speedMin = 0.045 + clamp01(trigger.weird) * 0.05;
  const speed = speedMin + stepRandom01(trigger.seed ^ 0x1f2a, voiceId, 700 + index) * 0.16;
  const heading = stepRandom01(trigger.seed ^ 0x8bc7, voiceId, 900 + index) * Math.PI * 2;
  const radius = radiusNorm * fieldRadius;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    vx: Math.cos(heading) * speed,
    vy: Math.sin(heading) * speed,
  };
}

function stepRadarTarget(target: RadarTargetState, speedScale: number, fieldRadius: number) {
  target.x += target.vx * speedScale;
  target.y += target.vy * speedScale;
  if (target.x > fieldRadius) target.x = -fieldRadius;
  else if (target.x < -fieldRadius) target.x = fieldRadius;
  if (target.y > fieldRadius) target.y = -fieldRadius;
  else if (target.y < -fieldRadius) target.y = fieldRadius;
}

function radarDetectionStrength(x: number, y: number, trigger: TriggerModule, sweepAngle: number, fieldRadius: number) {
  const lock = clamp01(trigger.determinism);
  const bias = clamp01(trigger.gravity);
  const rangeNorm = Math.max(0, Math.min(1, Math.hypot(x, y) / Math.max(1e-6, fieldRadius * (0.34 + Math.max(0.08, Math.min(1, trigger.length / 128)) * 0.66))));
  const targetAngle = Math.atan2(y, x);
  const delta = Math.abs(Math.atan2(Math.sin(targetAngle - sweepAngle), Math.cos(targetAngle - sweepAngle)));
  const beamHalfWidth = 0.58 - lock * 0.44;
  const alignment = Math.max(0, Math.min(1, 1 - delta / Math.max(0.04, beamHalfWidth)));
  const proximity = Math.pow(1 - rangeNorm, 0.75);
  const biasFocus = Math.max(0.6, Math.min(1, 1 - Math.abs(rangeNorm - (1 - bias)) * 1.25));
  return alignment * proximity * biasFocus;
}

function radarReturnStrengthAtStep(trigger: TriggerModule, voiceId: string, stepIndex: number, steps: number) {
  const targetCount = Math.max(2, Math.min(12, 2 + Math.round(clamp01(trigger.density) * 9 + clamp01(trigger.gravity) * 2)));
  const targets = Array.from({ length: targetCount }, (_, i) => createRadarTargetState(trigger, voiceId, i, 1));
  const motionPerStep = 0.72 + clamp01(trigger.weird) * 0.66;
  const stepsSafe = Math.max(1, steps | 0);
  let strongest = 0;
  for (let step = 0; step <= stepIndex; step++) {
    const phase = (((step + (trigger.euclidRot | 0)) % stepsSafe) + stepsSafe) % stepsSafe / stepsSafe;
    const sweepAngle = phase * Math.PI * 2 - Math.PI / 2;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      if (!target) continue;
      stepRadarTarget(target, motionPerStep, 1);
      if (step !== stepIndex) continue;
      strongest = Math.max(strongest, radarDetectionStrength(target.x, target.y, trigger, sweepAngle, 1));
    }
  }
  return strongest;
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
