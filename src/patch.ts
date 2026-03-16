// src/patch.ts
export type Mode = "hybrid" | "step" | "euclid" | "ca" | "fractal";

export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));

export type ModuleType = "drum" | "tonal" | "trigger" | "visual" | "terminal" | "effect" | "voice";

export type ModuleBase = {
  id: string;
  type: ModuleType;
  name: string;
  enabled: boolean;
  x?: number;
  y?: number;
};

export type SequencerParams = {
  mode: Mode;
  seed: number;
  determinism: number;
  gravity: number;
  density: number;
  subdiv: 1 | 2 | 4 | 8;
  length: number;
  drop: number;
  weird: number;
  euclidRot: number;
  caRule: number;
  caInit: number;
};

// Legacy shape kept for explicit migration support.
export type VoiceKind = "drum" | "tonal";
export type PatternSource = "self" | string;
export type VoiceModule = ModuleBase & { type: "voice"; kind: VoiceKind; patternSource: PatternSource } & SequencerParams & {
  amp: number;
  timbre: number;
  pan: number;
};

export type TriggerModule = ModuleBase & { type: "trigger" } & SequencerParams;

type SoundBase = ModuleBase & {
  triggerSource: string | null;
  amp: number;
  timbre: number;
  pan: number;
};

export type DrumModule = SoundBase & { type: "drum" };
export type TonalModule = SoundBase & { type: "tonal" };

export type SoundModule = DrumModule | TonalModule;

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

export type Module = SoundModule | TriggerModule | VisualModule | TerminalModule | EffectModule;
type AnyKnownModule = Module | VoiceModule;

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

export function isSound(m: AnyKnownModule): m is SoundModule {
  return m.type === "drum" || m.type === "tonal";
}

export function isTrigger(m: AnyKnownModule): m is TriggerModule {
  return m.type === "trigger";
}

export function isEffect(m: AnyKnownModule): m is EffectModule {
  return m.type === "effect";
}

export function isVisual(m: AnyKnownModule): m is VisualModule {
  return m.type === "visual";
}

export function getSoundModules(p: Patch): SoundModule[] {
  return p.modules.filter(isSound);
}

export function getTriggers(p: Patch): TriggerModule[] {
  return p.modules.filter(isTrigger);
}

const SOUND_NAMES = ["SUB", "BUZZHH", "ULTRATK", "PING", "BITSN", "AIRGAP", "RATTLE", "METAK"];
const SOUND_KINDS: Array<"drum" | "tonal"> = ["drum", "drum", "tonal", "drum", "drum", "drum", "drum", "tonal"];

function defaultSequencer(i: number): SequencerParams {
  return {
    mode: "hybrid",
    seed: 1000 + i * 77,
    determinism: 0.8,
    gravity: 0.6,
    density: 0.35,
    subdiv: 4,
    length: 16,
    drop: 0.12,
    weird: 0.5,
    euclidRot: 0,
    caRule: 90,
    caInit: 0.25,
  };
}

export function makeTrigger(i = 0, name = `TRG_${i + 1}`): TriggerModule {
  return {
    id: uid("trg"),
    type: "trigger",
    name,
    enabled: true,
    ...defaultSequencer(i),
  };
}

export function makeSound(kind: "drum" | "tonal", i = 0, triggerSource: string | null = null): SoundModule {
  const id = uid(kind === "drum" ? "drm" : "ton");
  return {
    id,
    type: kind,
    name: SOUND_NAMES[i] ?? `${kind.toUpperCase()}_${id.slice(-3).toUpperCase()}`,
    enabled: true,
    triggerSource,
    amp: kind === "drum" ? 0.12 : 0.08,
    timbre: 0.5,
    pan: 0,
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

export const defaultPatch = (): Patch => {
  const modules: Module[] = [];
  for (let i = 0; i < 8; i++) {
    const trg = makeTrigger(i, `TRG_${i + 1}`);
    const sound = makeSound(SOUND_KINDS[i] ?? "drum", i, trg.id);
    modules.push(sound, trg);
  }
  modules.push(makeVisual("scope"));

  return {
    version: "0.3",
    bpm: 124,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules,
    buses: [],
    connections: [],
  };
};

function normalizeSequencer(raw: any, fallbackIndex = 0): SequencerParams {
  const base = defaultSequencer(fallbackIndex);
  return {
    mode: ["hybrid", "step", "euclid", "ca", "fractal"].includes(raw?.mode) ? raw.mode : base.mode,
    seed: typeof raw?.seed === "number" ? raw.seed | 0 : base.seed,
    determinism: clamp(typeof raw?.determinism === "number" ? raw.determinism : base.determinism, 0, 1),
    gravity: clamp(typeof raw?.gravity === "number" ? raw.gravity : base.gravity, 0, 1),
    density: clamp(typeof raw?.density === "number" ? raw.density : base.density, 0, 1),
    subdiv: ([1, 2, 4, 8].includes(raw?.subdiv) ? raw.subdiv : base.subdiv) as 1 | 2 | 4 | 8,
    length: clamp(typeof raw?.length === "number" ? raw.length : base.length, 1, 128) | 0,
    drop: clamp(typeof raw?.drop === "number" ? raw.drop : base.drop, 0, 1),
    weird: clamp(typeof raw?.weird === "number" ? raw.weird : base.weird, 0, 1),
    euclidRot: typeof raw?.euclidRot === "number" ? raw.euclidRot | 0 : base.euclidRot,
    caRule: clamp(typeof raw?.caRule === "number" ? raw.caRule : base.caRule, 0, 255) | 0,
    caInit: clamp(typeof raw?.caInit === "number" ? raw.caInit : base.caInit, 0, 1),
  };
}

function migrateEffectModule(m: AnyKnownModule): AnyKnownModule {
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
  const migrated: Module[] = [];
  const legacyVoiceToTrigger = new Map<string, string>();
  const unresolvedTriggerRef = new Map<string, string | null>();

  for (let i = 0; i < patch.modules.length; i++) {
    const moduleAny = migrateEffectModule(patch.modules[i] as AnyKnownModule);

    if ((moduleAny as any).type === "voice") {
      const legacy = moduleAny as VoiceModule;
      const trigger = {
        id: uid("trg"),
        type: "trigger",
        name: `${legacy.name} TRG`,
        enabled: legacy.enabled !== false,
        ...normalizeSequencer(legacy, i),
      } satisfies TriggerModule;

      const sound = {
        id: legacy.id,
        type: legacy.kind,
        name: legacy.name,
        enabled: legacy.enabled !== false,
        triggerSource: trigger.id,
        amp: clamp(typeof legacy.amp === "number" ? legacy.amp : 0.12, 0, 1),
        timbre: clamp(typeof legacy.timbre === "number" ? legacy.timbre : 0.5, 0, 1),
        pan: clamp(typeof legacy.pan === "number" ? legacy.pan : 0, -1, 1),
      } satisfies SoundModule;

      legacyVoiceToTrigger.set(legacy.id, trigger.id);
      unresolvedTriggerRef.set(sound.id, typeof legacy.patternSource === "string" ? legacy.patternSource : "self");
      migrated.push(sound, trigger);
      continue;
    }

    if (moduleAny.type === "drum" || moduleAny.type === "tonal") {
      migrated.push({
        ...moduleAny,
        triggerSource: typeof (moduleAny as any).triggerSource === "string" ? (moduleAny as any).triggerSource : null,
        amp: clamp(typeof (moduleAny as any).amp === "number" ? (moduleAny as any).amp : 0.12, 0, 1),
        timbre: clamp(typeof (moduleAny as any).timbre === "number" ? (moduleAny as any).timbre : 0.5, 0, 1),
        pan: clamp(typeof (moduleAny as any).pan === "number" ? (moduleAny as any).pan : 0, -1, 1),
      } as SoundModule);
      continue;
    }

    if (moduleAny.type === "trigger") {
      migrated.push({
        ...moduleAny,
        ...normalizeSequencer(moduleAny, i),
      } as TriggerModule);
      continue;
    }

    migrated.push(moduleAny as Module);
  }

  // Explicit legacy patternSource->triggerSource resolution.
  for (const module of migrated) {
    if (!isSound(module)) continue;
    const rawRef = unresolvedTriggerRef.get(module.id);
    if (!rawRef || rawRef === "self") continue;
    module.triggerSource = legacyVoiceToTrigger.get(rawRef) ?? null;
  }

  const triggerIds = new Set(migrated.filter(isTrigger).map((m) => m.id));
  for (const module of migrated) {
    if (!isSound(module)) continue;
    if (module.triggerSource && !triggerIds.has(module.triggerSource)) module.triggerSource = null;
  }

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
    modules: migrated,
    buses,
    connections,
  };
}
