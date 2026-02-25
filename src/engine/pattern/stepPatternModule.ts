import type { VoiceModule } from "../../patch";

export type StepPatternParams = Pick<VoiceModule, "length" | "seed" | "density">;

function xorshift32(seed: number) {
  let x = seed | 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function genStepPattern(params: StepPatternParams): Uint8Array {
  const n = Math.max(1, Math.min(128, params.length | 0));
  const rnd = xorshift32(params.seed | 0);
  const prob = clamp01(params.density);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = rnd() < prob ? 1 : 0;
  return out;
}
