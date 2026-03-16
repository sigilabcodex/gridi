import type { TriggerModule } from "../../patch.ts";

export type StepPatternParams = Pick<TriggerModule, "length" | "seed" | "density" | "determinism" | "gravity" | "weird">;

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function stepNoise(seed: number, index: number) {
  let x = (seed | 0) ^ Math.imul(index | 0, 0x9e3779b1);
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967296;
}

function motifLength(length: number, determinism: number) {
  const det = clamp01(determinism);
  const candidates = [2, 4, 8, 16, 32];
  const pick = candidates[Math.min(candidates.length - 1, Math.floor(det * candidates.length))];
  return Math.max(1, Math.min(length, pick));
}

export function genStepPattern(params: StepPatternParams): Uint8Array {
  const n = Math.max(1, Math.min(128, params.length | 0));
  const density = clamp01(params.density);
  const det = clamp01(params.determinism);
  const gravity = clamp01(params.gravity);
  const weird = clamp01(params.weird);

  const motif = motifLength(n, det);
  const motifBits = new Uint8Array(motif);

  for (let i = 0; i < motif; i++) {
    const downbeatBias = i % 4 === 0 ? 0.25 + gravity * 0.5 : (i % 2 === 0 ? 0.1 * gravity : -0.05 * gravity);
    const syncopation = weird * (i % 4 === 3 ? 0.2 : 0);
    const threshold = clamp01(density + downbeatBias + syncopation - 0.2);
    motifBits[i] = stepNoise(params.seed ^ 0x13572468, i) < threshold ? 1 : 0;
  }

  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let bit = motifBits[i % motif];
    if (det < 0.95 && stepNoise(params.seed ^ 0x24681357, i) < (1 - det) * weird * 0.35) bit = bit ? 0 : 1;
    out[i] = bit;
  }

  return out;
}
