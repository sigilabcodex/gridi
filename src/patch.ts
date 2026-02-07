// src/patch.ts
export type Mode = "hybrid" | "step" | "euclid" | "ca" | "fractal";

export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));

export type Voice = {
  name: string;
  enabled: boolean;
  mode: Mode;

  seed: number;
  determinism: number; // 0..1
  gravity: number;     // 0..1
  density: number;     // 0..1
  subdiv: 1 | 2 | 4 | 8; // 1=8ths,2=16ths,4=32nds,8=64ths
  length: number;      // 1..64
  drop: number;        // 0..1
  amp: number;         // 0..1
  weird: number;       // 0..1
  euclidRot: number;   // steps rotate
  caRule: number;      // 0..255
  caInit: number;      // 0..1

  // v0.2 additions
  timbre: number;      // 0..1
  pan: number;         // -1..1 (luego lo usamos)
};

export type Patch = {
  version: "0.2";
  bpm: number;
  macro: number;

  masterGain: number;  // 0..1
  masterMute: boolean;

  voices: Voice[];
};

const VOICE_NAMES = ["SUB","BUZZHH","ULTRATK","PING","BITSN","AIRGAP","RATTLE","METAK"];

export const defaultPatch = (): Patch => ({
  version: "0.2",
  bpm: 124,
  macro: 0.5,
  masterGain: 0.8,
  masterMute: false,
  voices: Array.from({ length: 8 }, (_, i) => ({
    name: VOICE_NAMES[i] ?? `V${i+1}`,
    enabled: true,
    mode: "hybrid",
    seed: 1000 + i * 77,
    determinism: 0.8,
    gravity: 0.6,
    density: 0.35,
    subdiv: 4,
    length: 16,
    drop: 0.12,
    amp: 0.12,
    weird: 0.5,
    euclidRot: 0,
    caRule: 90,
    caInit: 0.25,
    timbre: 0.5,
    pan: 0,
  })),
});

// útil para Reset sin structuredClone raro
export const DEFAULT_PATCH_V02: Patch = defaultPatch();
