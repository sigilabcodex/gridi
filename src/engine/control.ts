import type { ControlModule, Patch } from "../patch.ts";
import { clamp, getControls } from "../patch.ts";

const TAU = Math.PI * 2;

function fract(x: number) {
  return x - Math.floor(x);
}

function hash(x: number) {
  return fract(Math.sin(x * 127.1 + 311.7) * 43758.5453123);
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

export function sampleControlBipolar(control: ControlModule, timeSec: number): number {
  const amount = clamp(control.amount, 0, 1);

  if (control.kind === "lfo") {
    const hz = 0.03 + clamp(control.speed, 0, 1) * 12;
    const phase = fract(control.phase + timeSec * hz);
    let wave = 0;
    if (control.waveform === "sine") wave = Math.sin(phase * TAU);
    if (control.waveform === "triangle") wave = 1 - 4 * Math.abs(phase - 0.5);
    if (control.waveform === "square") wave = phase < 0.5 ? 1 : -1;
    if (control.waveform === "random") wave = hash(Math.floor(phase + timeSec * hz) + control.id.length * 17) * 2 - 1;
    return clamp(wave * amount, -1, 1);
  }

  if (control.kind === "drift") {
    const rate = 0.05 + clamp(control.rate, 0, 1) * 3;
    const phase = timeSec * rate + control.id.length * 0.173;
    const i = Math.floor(phase);
    const t = smoothstep(fract(phase));
    const a = hash(i + 10.31) * 2 - 1;
    const b = hash(i + 11.97) * 2 - 1;
    return clamp((a + (b - a) * t) * amount, -1, 1);
  }

  const rate = 0.1 + clamp(control.rate, 0, 1) * 10;
  const randomness = clamp(control.randomness, 0, 1);
  const step = Math.floor(timeSec * rate + control.id.length * 0.67);
  const stepped = ((step % 8) / 7) * 2 - 1;
  const rnd = hash(step + 99.1) * 2 - 1;
  return clamp((stepped * (1 - randomness) + rnd * randomness) * amount, -1, 1);
}

export function sampleControl01(control: ControlModule, timeSec: number): number {
  return clamp(0.5 + sampleControlBipolar(control, timeSec) * 0.5, 0, 1);
}

export function collectControlValues(patch: Patch, timeSec: number): Map<string, number> {
  const values = new Map<string, number>();
  for (const control of getControls(patch)) {
    if (!control.enabled) continue;
    values.set(control.id, sampleControl01(control, timeSec));
  }
  return values;
}
