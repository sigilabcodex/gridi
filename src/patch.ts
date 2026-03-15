// src/patch.ts
export type Mode = "hybrid" | "step" | "euclid" | "ca" | "fractal";

export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));

export type ModuleType = "voice" | "visual" | "terminal" | "effect";

export type ModuleBase = {
  id: string;
  type: ModuleType;
  name: string;
  enabled: boolean;
  x?: number;
  y?: number;
};

export type VoiceKind = "drum" | "tonal";
export type PatternSource = "self" | string;

export type VoiceModule = ModuleBase & {
  type: "voice";
  kind: VoiceKind;
  mode: Mode;
  patternSource: PatternSource;

  seed: number;
  determinism: number;
  gravity: number;
  density: number;
  subdiv: 1 | 2 | 4 | 8;
  length: number;
  drop: number;

  amp: number;
  timbre: number;
  pan: number;

  weird: number;
  euclidRot: number;
  caRule: number;
  caInit: number;
};

export type VisualKind = "scope" | "spectrum" | "pattern";

export type VisualModule = ModuleBase & {
  type: "visual";
  kind: VisualKind;
  fftSize?: 512 | 1024 | 2048 | 4096;
};

export type TerminalModule = ModuleBase & { type: "terminal" };

export type EffectKind = "gain";

export type EffectModule = ModuleBase & {
  type: "effect";
  kind: EffectKind;
  bypass: boolean;
  gain: number;
};

export type Module = VoiceModule | VisualModule | TerminalModule | EffectModule;

export type Bus = {
  id: string;
  name: string;
  gain: number;
  mute: boolean;
};

export type ConnectionTarget = {
  type: "module" | "bus" | "master";
  id?: string;
  port?: string;
};

export type Connection = {
  id: string;
  fromModuleId: string;
  fromPort: string;
  to: ConnectionTarget;
  gain: number;
  enabled: boolean;
};

export type Patch = {
  version: "0.3";
  bpm: number;
  macro: number;

  masterGain: number;
  masterMute: boolean;

  modules: Module[];
  buses: Bus[];
  connections: Connection[];
};

let _id = 0;
export function uid(prefix = "m") {
  _id++;
  return `${prefix}_${Date.now().toString(36)}_${_id.toString(36)}`;
}

export function isVoice(m: Module): m is VoiceModule {
  return m.type === "voice";
}

export function isEffect(m: Module): m is EffectModule {
  return m.type === "effect";
}

export function isVisual(m: Module): m is VisualModule {
  return m.type === "visual";
}
export function getVoices(p: Patch): VoiceModule[] {
  return p.modules.filter(isVoice);
}

// Defaults
const VOICE_NAMES = ["SUB", "BUZZHH", "ULTRATK", "PING", "BITSN", "AIRGAP", "RATTLE", "METAK"];
const VOICE_KINDS: VoiceKind[] = ["drum","drum","tonal","drum","drum","drum","drum","tonal"];

export function makeDefaultVoice(i: number): VoiceModule {
  return {
    id: uid("v"),
    type: "voice",
    name: VOICE_NAMES[i] ?? `V${i + 1}`,
    enabled: true,
    kind: VOICE_KINDS[i] ?? "drum",
    mode: "hybrid",
    patternSource: "self",

    seed: 1000 + i * 77,
    determinism: 0.8,
    gravity: 0.6,
    density: 0.35,
    subdiv: 4,
    length: 16,
    drop: 0.12,

    amp: 0.12,
    timbre: 0.5,
    pan: 0,

    weird: 0.5,
    euclidRot: 0,
    caRule: 90,
    caInit: 0.25,
  };
}

// NEW: create a new voice module (generic)
export function makeNewVoice(kind: VoiceKind): VoiceModule {
  const base = makeDefaultVoice(0);
  const n = uid("v");
  const name = kind === "drum" ? `DRM_${n.slice(-3).toUpperCase()}` : `TON_${n.slice(-3).toUpperCase()}`;

  return {
    ...base,
    id: n,
    name,
    kind,
    enabled: true,
    // small variations
    seed: Math.floor(Math.random() * 999999),
    amp: kind === "drum" ? 0.12 : 0.08,
    timbre: 0.5,
  };
}

export function makeVisual(kind: VisualKind): VisualModule {
  return {
    id: uid("vis"),
    type: "visual",
    name: kind === "scope" ? "SCOPE" : kind === "spectrum" ? "SPECTRUM" : "VISUAL",
    enabled: true,
    kind,
    fftSize: 2048,
  };
}

export function makeEffect(kind: EffectKind = "gain"): EffectModule {
  return {
    id: uid("fx"),
    type: "effect",
    name: kind === "gain" ? "GAIN FX" : "EFFECT",
    enabled: true,
    kind,
    bypass: true,
    gain: 1,
  };
}

export const defaultPatch = (): Patch => ({
  version: "0.3",
  bpm: 124,
  macro: 0.5,
  masterGain: 0.8,
  masterMute: false,
  modules: [
    ...Array.from({ length: 8 }, (_, i) => makeDefaultVoice(i)),
    makeVisual("scope"),
  ],
  buses: [],
  connections: [],
});

function normalizePatternSource(raw: unknown): PatternSource {
  return typeof raw === "string" && raw.trim() ? raw : "self";
}

function migrateEffectModule(m: Module): Module {
  if (m.type !== "effect") return m;

  const kind = (m as any).kind === "gain" ? "gain" : "gain";
  const bypass = typeof (m as any).bypass === "boolean" ? (m as any).bypass : true;
  const gain = clamp(typeof (m as any).gain === "number" ? (m as any).gain : 1, 0, 2);

  return {
    ...m,
    kind,
    bypass,
    gain,
  } satisfies EffectModule;
}

function normalizeConnection(raw: unknown): Connection | null {
  if (!raw || typeof raw !== "object") return null;
  const conn = raw as Partial<Connection> & { to?: ConnectionTarget };
  if (typeof conn.fromModuleId !== "string" || !conn.fromModuleId.trim()) return null;

  const targetType = conn.to?.type;
  if (targetType !== "module" && targetType !== "bus" && targetType !== "master") return null;

  const target: ConnectionTarget = {
    type: targetType,
    id: typeof conn.to?.id === "string" ? conn.to.id : undefined,
    port: typeof conn.to?.port === "string" ? conn.to.port : "in",
  };

  if (target.type !== "master" && (!target.id || !target.id.trim())) return null;

  return {
    id: typeof conn.id === "string" && conn.id.trim() ? conn.id : uid("conn"),
    fromModuleId: conn.fromModuleId,
    fromPort: typeof conn.fromPort === "string" && conn.fromPort.trim() ? conn.fromPort : "main",
    to: target,
    gain: clamp(typeof conn.gain === "number" ? conn.gain : 1, 0, 2),
    enabled: conn.enabled !== false,
  };
}

export function migratePatch(patch: Patch): Patch {
  const modules = patch.modules.map((m) => {
    if (m.type !== "voice") return migrateEffectModule(m);
    return {
      ...m,
      patternSource: normalizePatternSource((m as any).patternSource),
    } satisfies VoiceModule;
  });

  const buses = Array.isArray((patch as any).buses)
    ? ((patch as any).buses as any[])
      .filter((bus) => bus && typeof bus.id === "string")
      .map((bus) => ({
        id: bus.id,
        name: typeof bus.name === "string" && bus.name.trim() ? bus.name : "BUS",
        gain: clamp(typeof bus.gain === "number" ? bus.gain : 1, 0, 2),
        mute: !!bus.mute,
      }))
    : [];

  const connections = Array.isArray((patch as any).connections)
    ? ((patch as any).connections as unknown[])
      .map((raw) => normalizeConnection(raw))
      .filter((c): c is Connection => !!c)
    : [];

  return {
    ...patch,
    modules,
    buses,
    connections,
  };
}
