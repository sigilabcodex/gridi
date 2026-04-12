import type { Mode, VoiceModule } from "../../patch.ts";
import { genStepPattern } from "./stepPatternModule.ts";

const MAX_PATTERN_STEPS = 128;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function xorshift32(seed: number) {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function bjorklund(steps: number, pulses: number) {
  steps = Math.max(1, steps | 0);
  pulses = Math.max(0, Math.min(steps, pulses | 0));
  if (pulses === 0) return new Uint8Array(steps);
  if (pulses === steps) return Uint8Array.from({ length: steps }, () => 1);

  const pattern: number[] = [];
  const counts: number[] = [];
  const remainders: number[] = [];
  let divisor = steps - pulses;
  remainders.push(pulses);
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

  const out = pattern.slice(0, steps);
  const firstOne = out.indexOf(1);
  const rot = firstOne > 0 ? firstOne : 0;
  const rotated = out.slice(rot).concat(out.slice(0, rot));
  return Uint8Array.from(rotated);
}

function rotatePattern(p: Uint8Array, rot: number) {
  const n = p.length;
  if (n <= 1) return p;
  rot = ((rot | 0) % n + n) % n;
  if (rot === 0) return p;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = p[(i - rot + n) % n];
  return out;
}

function genEuclidPattern(v: VoiceModule) {
  const n = Math.max(1, Math.min(MAX_PATTERN_STEPS, v.length | 0));
  const k = Math.round(clamp01(v.density) * n);
  const base = bjorklund(n, k);
  return rotatePattern(base, v.euclidRot | 0);
}

function genCAPattern(v: VoiceModule) {
  const n = Math.max(1, Math.min(MAX_PATTERN_STEPS, v.length | 0));
  const rule = (v.caRule | 0) & 255;
  const rnd = xorshift32(v.seed ^ 0x9e3779b9);

  const row = new Uint8Array(n);
  const initProb = clamp01(v.caInit);
  for (let i = 0; i < n; i++) row[i] = rnd() < initProb ? 1 : 0;

  const iters = 6 + Math.floor(clamp01(v.gravity) * 10);
  let cur = row;
  let next = new Uint8Array(n);

  for (let t = 0; t < iters; t++) {
    for (let i = 0; i < n; i++) {
      const L = cur[(i - 1 + n) % n];
      const C = cur[i];
      const R = cur[(i + 1) % n];
      const idx = (L << 2) | (C << 1) | R;
      next[i] = (rule >> idx) & 1;
    }
    const tmp = cur;
    cur = next;
    next = tmp;
  }
  return cur;
}

function genHybridPattern(v: VoiceModule) {
  const a = genEuclidPattern(v);
  const b = genStepPattern(v);
  const n = Math.min(a.length, b.length);
  const out = new Uint8Array(n);
  const det = clamp01(v.determinism);
  const rnd = xorshift32((v.seed + 1337) | 0);

  for (let i = 0; i < n; i++) {
    const noise = (rnd() - 0.5) * 0.6 * clamp01(v.weird);
    const w = clamp01(det + noise);
    out[i] = (w >= 0.5 ? a[i] : b[i]) ? 1 : 0;
  }
  return out;
}

function patternForLegacyMode(mode: Mode, voice: VoiceModule): Uint8Array {
  if (mode === "step-sequencer") return genStepPattern(voice);
  if (mode === "euclidean") return genEuclidPattern(voice);
  if (mode === "cellular-automata") return genCAPattern(voice);
  if (mode === "fractal") return genCAPattern({ ...voice, seed: voice.seed ^ 0xabcdef });
  if (mode === "non-euclidean") return genHybridPattern(voice);
  return genHybridPattern(voice);
}

/**
 * Legacy renderer used by scheduler-owned sequencing modes.
 * TODO(v0.32): move mode-specific pattern rendering behind PatternModule implementations.
 */
export function renderLegacyVoicePattern(voice: VoiceModule): Uint8Array {
  const base = patternForLegacyMode(voice.mode, voice);
  if (voice.mode === "step-sequencer") return base;

  const drop = clamp01(voice.drop);
  if (drop <= 0) return base;

  const rnd = xorshift32(voice.seed ^ 0x1234567);
  const out = new Uint8Array(base.length);
  for (let i = 0; i < base.length; i++) out[i] = base[i] && rnd() >= drop ? 1 : 0;
  return out;
}
