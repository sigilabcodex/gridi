import type { TriggerModule } from "../../patch";

const MAX_STEPS = 128;

export type GearRingModel = {
  length: number;
  rotation: number;
  phase: number;
  direction: 1 | -1;
  weight: number;
  pattern: Uint8Array;
};

export type GearModel = {
  steps: number;
  ringCount: number;
  rings: GearRingModel[];
  triggerPattern: Uint8Array;
};

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
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

function gcd(a: number, b: number): number {
  let x = Math.abs(a | 0);
  let y = Math.abs(b | 0);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function lcm(a: number, b: number) {
  if (!a || !b) return 1;
  return Math.min(MAX_STEPS, Math.max(1, Math.floor((a / gcd(a, b)) * b)));
}

export function gearRingCount(density: number) {
  return 2 + Math.round(clamp01(density) * 2);
}

function ringLength(baseLength: number, div: number, ring: number) {
  const base = Math.max(4, Math.min(MAX_STEPS, baseLength | 0));
  const scale = 0.85 + ((Math.max(1, Math.min(8, div | 0)) - 1) / 7) * 0.55;
  if (ring === 0) return base;
  if (ring === 1) return Math.max(3, Math.min(MAX_STEPS, Math.round(base * (0.66 + scale * 0.24))));
  if (ring === 2) return Math.max(3, Math.min(MAX_STEPS, Math.round(base * (1.2 - (scale - 1) * 0.18))));
  return Math.max(3, Math.min(MAX_STEPS, Math.round(base * (0.52 + scale * 0.22))));
}

function generateRingPattern(length: number, seed: number, voiceId: string, targetDensity: number) {
  const n = Math.max(1, length | 0);
  const pulses = Math.max(1, Math.min(n - 1, Math.round(n * clamp01(targetDensity))));
  const out = new Uint8Array(n);
  const phase = stepRandom01(seed ^ 0x17c9, voiceId, n);
  for (let hit = 0; hit < pulses; hit++) {
    const t = (hit + phase) / pulses;
    const center = Math.floor(t * n);
    const jitter = Math.round((stepRandom01(seed ^ 0x2f11, voiceId, hit) - 0.5) * (1 + targetDensity * 2));
    const idx = ((center + jitter) % n + n) % n;
    out[idx] = 1;
  }
  return out;
}

export function createGearModel(trigger: TriggerModule, voiceId: string): GearModel {
  const ringCount = Math.max(2, Math.min(4, gearRingCount(trigger.density)));
  const rings: GearRingModel[] = [];
  for (let ring = 0; ring < 4; ring++) {
    const length = ringLength(trigger.length, trigger.subdiv, ring);
    const density = clamp01(0.22 + trigger.gravity * 0.35 + (ring === 0 ? 0.24 : ring === 1 ? 0.12 : ring === 2 ? 0.08 : 0.05));
    const pattern = generateRingPattern(length, trigger.seed ^ (ring * 0x45d9f3b), voiceId, density);
    const direction: 1 | -1 = ring % 2 === 0 ? 1 : -1;
    const rotation = trigger.euclidRot + Math.round((ring - 1.5) * (1 + trigger.subdiv * 0.45));
    const phase = clamp01(trigger.weird) * (0.12 + ring * 0.09);
    const weight = clamp01(0.52 + trigger.gravity * 0.34 - ring * 0.07);
    rings.push({ length, rotation, phase, direction, weight, pattern });
  }

  let cycle = rings[0].length;
  for (let i = 1; i < ringCount; i++) cycle = lcm(cycle, rings[i].length);
  const steps = Math.max(8, Math.min(MAX_STEPS, cycle));

  const out = new Uint8Array(steps);
  const strictness = clamp01(trigger.determinism);
  const drift = clamp01(trigger.weird);

  for (let step = 0; step < steps; step++) {
    const a = rings[0];
    const b = rings[1];
    const c = rings[2];

    const idxA = ((Math.floor(step * a.direction + a.rotation + step * a.phase * drift) % a.length) + a.length) % a.length;
    const idxB = ((Math.floor(step * b.direction + b.rotation + step * b.phase * drift * 1.15) % b.length) + b.length) % b.length;
    const idxC = ((Math.floor(step * c.direction + c.rotation + step * c.phase * drift * 1.3) % c.length) + c.length) % c.length;
    const d = rings[3];
    const idxD = ((Math.floor(step * d.direction + d.rotation + step * d.phase * drift * 1.45) % d.length) + d.length) % d.length;

    const gateA = a.pattern[idxA] === 1;
    const gateB = ringCount >= 2 ? b.pattern[idxB] === 1 : true;
    const gateC = ringCount >= 3 ? c.pattern[idxC] === 1 : false;
    const gateD = ringCount >= 4 ? d.pattern[idxD] === 1 : false;

    if (!gateA || !gateB) continue;

    const meshWeight = clamp01(0.26 + strictness * 0.5 + b.weight * 0.22);
    const cLift = gateC ? 0.18 + c.weight * 0.32 : -0.08;
    const dLift = ringCount >= 4 ? (gateD ? 0.11 + d.weight * 0.2 : -0.06) : 0;
    const finalChance = clamp01(meshWeight + cLift + dLift - trigger.drop * 0.42);
    if (stepRandom01(trigger.seed ^ 0x7ac3, voiceId, step) <= finalChance) out[step] = 1;
  }

  return { steps, ringCount, rings, triggerPattern: out };
}

export function createGearPattern(trigger: TriggerModule, voiceId: string): Uint8Array {
  return createGearModel(trigger, voiceId).triggerPattern;
}
