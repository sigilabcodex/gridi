// src/patch.ts
import { normalizeModuleGridPositions, setModuleGridPosition, slotIndexToGridPosition } from "./workspacePlacement.ts";

export type Mode =
  | "step-sequencer"
  | "cellular-automata"
  | "euclidean"
  | "non-euclidean"
  | "fractal"
  | "hybrid"
  | "markov-chains"
  | "l-systems"
  | "xronomorph"
  | "genetic-algorithms"
  | "one-over-f-noise"
  | "gear";
export type ModuleEngine = "trigger" | "drum" | "synth" | "visual" | "control";

export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));

export type ModuleType = "drum" | "tonal" | "trigger" | "visual" | "terminal" | "effect" | "voice" | "control";

export type ModulationMap = Partial<Record<string, string>>;

export type ModuleBase = {
  id: string;
  type: ModuleType;
  engine?: ModuleEngine;
  name: string;
  presetName?: string;
  presetMeta?: Record<string, unknown>;
  enabled: boolean;
  x: number;
  y: number;
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

export type TriggerLiveState = {
  mode: Mode;
  steps: number;
  pattern: string;
  revision: number;
};

export type TriggerModule = ModuleBase & {
  type: "trigger";
  modulations?: ModulationMap;
  liveState?: TriggerLiveState;
} & SequencerParams;

type SoundBase = ModuleBase & {
  triggerSource: string | null;
  amp: number;
  pan: number;
  modulations?: ModulationMap;
};

export type ControlKind = "lfo" | "drift" | "stepped";
export type LfoWaveform = "sine" | "triangle" | "square" | "saw" | "ramp" | "random";

export type ControlModule = ModuleBase & {
  type: "control";
  engine: "control";
  kind: ControlKind;
  waveform: LfoWaveform;
  speed: number;
  amount: number;
  phase: number;
  rate: number;
  drift: number;
  randomness: number;
};

export type DrumSynthModule = SoundBase & {
  type: "drum";
  basePitch: number;
  attack: number;
  decay: number;
  transient: number;
  snap: number;
  noise: number;
  bodyTone: number;
  driveColor: number;
  pitchEnvAmt: number;
  pitchEnvDecay: number;
  bendDecay: number;
  tone: number;
  comp: number;
  compThreshold: number;
  compRatio: number;
  compAttack: number;
  compRelease: number;
  boost: number;
  boostTarget: "body" | "attack" | "air";
  stereoWidth: number;
  panBias: number;
};

export type TonalSynthModule = SoundBase & {
  type: "tonal";
  waveform: number;
  coarseTune: number;
  fineTune: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  cutoff: number;
  resonance: number;
  glide: number;
  modDepth: number;
  modRate: number;
};

export type DrumModule = DrumSynthModule;
export type TonalModule = TonalSynthModule;

export type SoundModule = DrumModule | TonalModule;

export type VisualKind = "scope" | "spectrum" | "vectorscope" | "spectral-depth" | "flow" | "ritual" | "glitch" | "cymat";

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

export type Module = SoundModule | TriggerModule | VisualModule | TerminalModule | EffectModule | ControlModule;
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

export function isControl(m: AnyKnownModule): m is ControlModule {
  return m.type === "control";
}

export function getSoundModules(p: Patch): SoundModule[] {
  return p.modules.filter(isSound);
}

export function getTriggers(p: Patch): TriggerModule[] {
  return p.modules.filter(isTrigger);
}

export function getControls(p: Patch): ControlModule[] {
  return p.modules.filter(isControl);
}

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

export function makeTrigger(i = 0, name = `Generator ${i + 1}`): TriggerModule {
  return {
    id: uid("trg"),
    type: "trigger",
    engine: "trigger",
    name,
    presetName: "Sparse Euclid",
    enabled: true,
    x: 0,
    y: 0,
    ...defaultSequencer(i),
  };
}

export function makeControl(kind: ControlKind, i = 0): ControlModule {
  return {
    id: uid("ctl"),
    type: "control",
    engine: "control",
    name: `Control ${i + 1}`,
    presetName: kind === "lfo" ? "Sine LFO" : kind === "drift" ? "Warm Drift" : "Stepped Motion",
    enabled: true,
    x: 0,
    y: 0,
    kind,
    waveform: "sine",
    speed: 0.3,
    amount: 0.55,
    phase: 0,
    rate: kind === "stepped" ? 0.5 : 0.35,
    drift: kind === "drift" ? 0.45 : 0.2,
    randomness: kind === "stepped" ? 0.45 : 0.3,
  };
}

export function makeSound(kind: "drum" | "tonal", i = 0, triggerSource: string | null = null): SoundModule {
  const id = uid(kind === "drum" ? "drm" : "ton");
  if (kind === "drum") {
    return {
      id,
      type: "drum",
      engine: "drum",
      name: `Drum ${i + 1}`,
      presetName: "Deep Kick",
      enabled: true,
      x: 0,
      y: 0,
      triggerSource,
      amp: 0.15,
      pan: 0,
      panBias: 0,
      stereoWidth: 0.72,
      basePitch: 0.42,
      attack: 0.18,
      decay: 0.35,
      transient: 0.65,
      snap: 0.3,
      noise: 0.2,
      bodyTone: 0.5,
      driveColor: 0.5,
      pitchEnvAmt: 0.55,
      pitchEnvDecay: 0.25,
      bendDecay: 0.25,
      tone: 0.45,
      comp: 0.32,
      compThreshold: 0.45,
      compRatio: 0.5,
      compAttack: 0.2,
      compRelease: 0.42,
      boost: 0.24,
      boostTarget: "body",
    };
  }

  return {
    id,
    type: "tonal",
    engine: "synth",
    name: `Synth ${i + 1}`,
    presetName: "Rubber Bass",
    enabled: true,
    x: 0,
    y: 0,
    triggerSource,
    amp: 0.11,
    pan: 0,
    waveform: 0.25,
    coarseTune: 0,
    fineTune: 0,
    attack: 0.02,
    decay: 0.3,
    sustain: 0.6,
    release: 0.5,
    cutoff: 0.55,
    resonance: 0.2,
    glide: 0.08,
    modDepth: 0.15,
    modRate: 0.25,
  };
}

export function makeVisual(kind: VisualKind, i = 0): VisualModule {
  const presetNameByKind: Record<VisualKind, string> = {
    scope: "Scope Default",
    spectrum: "Spectrum Default",
    vectorscope: "Vectorscope Default",
    "spectral-depth": "Spectral Depth Default",
    flow: "Flow Default",
    ritual: "Ritual Default",
    glitch: "Glitch Default",
    cymat: "Cymat Default",
  };
  return {
    id: uid("vis"),
    type: "visual",
    engine: "visual",
    name: `Scope ${i + 1}`,
    presetName: presetNameByKind[kind],
    enabled: true,
    x: 0,
    y: 0,
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
    x: 0,
    y: 0,
    kind,
    bypass: true,
    gain: 1,
  };
}

export const defaultPatch = (): Patch => {
  const trigA = makeTrigger(0);
  const trigB = makeTrigger(1);
  const drumA = makeSound("drum", 0, trigA.id);
  const drumB = makeSound("drum", 1, trigB.id);
  const synth = makeSound("tonal", 0, trigA.id);
  const control = makeControl("lfo", 0);
  const scope = makeVisual("scope", 0);

  const modules = [trigA, drumA, trigB, drumB, synth, control, scope];
  modules.forEach((module, index) => setModuleGridPosition(module, slotIndexToGridPosition(index)));

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


const LEGACY_MODE_ALIASES: Record<string, Mode> = {
  step: "step-sequencer",
  euclid: "euclidean",
  ca: "cellular-automata",
};

const SUPPORTED_MODES = new Set<Mode>([
  "step-sequencer",
  "cellular-automata",
  "euclidean",
  "non-euclidean",
  "fractal",
  "hybrid",
  "markov-chains",
  "l-systems",
  "xronomorph",
  "genetic-algorithms",
  "one-over-f-noise",
  "gear",
]);

function normalizeMode(raw: unknown, fallback: Mode): Mode {
  if (typeof raw !== "string") return fallback;
  const aliased = LEGACY_MODE_ALIASES[raw] ?? raw;
  return SUPPORTED_MODES.has(aliased as Mode) ? (aliased as Mode) : fallback;
}

function normalizeSequencer(raw: any, fallbackIndex = 0): SequencerParams {
  const base = defaultSequencer(fallbackIndex);
  return {
    mode: normalizeMode(raw?.mode, base.mode),
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


function normalizeDrumModule(raw: any): DrumModule {
  const legacyTimbre = clamp(typeof raw?.timbre === "number" ? raw.timbre : 0.5, 0, 1);
  return {
    ...raw,
    type: "drum",
    engine: "drum",
    presetName: typeof raw?.presetName === "string" && raw.presetName.trim() ? raw.presetName : "Deep Kick",
    triggerSource: typeof raw?.triggerSource === "string" ? raw.triggerSource : null,
    amp: clamp(typeof raw?.amp === "number" ? raw.amp : 0.15, 0, 1),
    pan: clamp(typeof raw?.pan === "number" ? raw.pan : 0, -1, 1),
    panBias: clamp(typeof raw?.panBias === "number" ? raw.panBias : (typeof raw?.pan === "number" ? raw.pan : 0), -1, 1),
    stereoWidth: clamp(typeof raw?.stereoWidth === "number" ? raw.stereoWidth : 0.72, 0, 1),
    basePitch: clamp(typeof raw?.basePitch === "number" ? raw.basePitch : legacyTimbre, 0, 1),
    attack: clamp(typeof raw?.attack === "number" ? raw.attack : 0.15 + (1 - legacyTimbre) * 0.2, 0, 1),
    decay: clamp(typeof raw?.decay === "number" ? raw.decay : 0.28 + legacyTimbre * 0.42, 0, 1),
    transient: clamp(typeof raw?.transient === "number" ? raw.transient : 0.45 + (1 - legacyTimbre) * 0.4, 0, 1),
    snap: clamp(typeof raw?.snap === "number" ? raw.snap : legacyTimbre * 0.6, 0, 1),
    noise: clamp(typeof raw?.noise === "number" ? raw.noise : 0.1 + legacyTimbre * 0.3, 0, 1),
    bodyTone: clamp(typeof raw?.bodyTone === "number" ? raw.bodyTone : 0.2 + legacyTimbre * 0.6, 0, 1),
    driveColor: clamp(typeof raw?.driveColor === "number" ? raw.driveColor : 0.5, 0, 1),
    pitchEnvAmt: clamp(typeof raw?.pitchEnvAmt === "number" ? raw.pitchEnvAmt : 0.3 + legacyTimbre * 0.4, 0, 1),
    pitchEnvDecay: clamp(typeof raw?.pitchEnvDecay === "number" ? raw.pitchEnvDecay : 0.2 + legacyTimbre * 0.3, 0, 1),
    bendDecay: clamp(typeof raw?.bendDecay === "number" ? raw.bendDecay : (typeof raw?.pitchEnvDecay === "number" ? raw.pitchEnvDecay : 0.2 + legacyTimbre * 0.3), 0, 1),
    tone: clamp(typeof raw?.tone === "number" ? raw.tone : legacyTimbre, 0, 1),
    comp: clamp(typeof raw?.comp === "number" ? raw.comp : 0.32, 0, 1),
    compThreshold: clamp(typeof raw?.compThreshold === "number" ? raw.compThreshold : 0.45, 0, 1),
    compRatio: clamp(typeof raw?.compRatio === "number" ? raw.compRatio : 0.5, 0, 1),
    compAttack: clamp(typeof raw?.compAttack === "number" ? raw.compAttack : 0.2, 0, 1),
    compRelease: clamp(typeof raw?.compRelease === "number" ? raw.compRelease : 0.42, 0, 1),
    boost: clamp(typeof raw?.boost === "number" ? raw.boost : 0.24, 0, 1),
    boostTarget: raw?.boostTarget === "attack" || raw?.boostTarget === "air" ? raw.boostTarget : "body",
    modulations: typeof raw?.modulations === "object" && raw.modulations ? raw.modulations : {},
  };
}

function normalizeTonalModule(raw: any): TonalModule {
  const legacyTimbre = clamp(typeof raw?.timbre === "number" ? raw.timbre : 0.5, 0, 1);
  return {
    ...raw,
    type: "tonal",
    engine: "synth",
    presetName: typeof raw?.presetName === "string" && raw.presetName.trim() ? raw.presetName : "Rubber Bass",
    triggerSource: typeof raw?.triggerSource === "string" ? raw.triggerSource : null,
    amp: clamp(typeof raw?.amp === "number" ? raw.amp : 0.11, 0, 1),
    pan: clamp(typeof raw?.pan === "number" ? raw.pan : 0, -1, 1),
    waveform: clamp(typeof raw?.waveform === "number" ? raw.waveform : legacyTimbre, 0, 1),
    coarseTune: clamp(typeof raw?.coarseTune === "number" ? raw.coarseTune : 0, -24, 24),
    fineTune: clamp(typeof raw?.fineTune === "number" ? raw.fineTune : 0, -1, 1),
    attack: clamp(typeof raw?.attack === "number" ? raw.attack : 0.005 + (1 - legacyTimbre) * 0.08, 0, 1),
    decay: clamp(typeof raw?.decay === "number" ? raw.decay : 0.15 + legacyTimbre * 0.5, 0, 1),
    sustain: clamp(typeof raw?.sustain === "number" ? raw.sustain : 0.2 + legacyTimbre * 0.6, 0, 1),
    release: clamp(typeof raw?.release === "number" ? raw.release : 0.18 + legacyTimbre * 0.7, 0, 1),
    cutoff: clamp(typeof raw?.cutoff === "number" ? raw.cutoff : legacyTimbre, 0, 1),
    resonance: clamp(typeof raw?.resonance === "number" ? raw.resonance : 0.18, 0, 1),
    glide: clamp(typeof raw?.glide === "number" ? raw.glide : 0.04, 0, 1),
    modDepth: clamp(typeof raw?.modDepth === "number" ? raw.modDepth : 0.1 + legacyTimbre * 0.2, 0, 1),
    modRate: clamp(typeof raw?.modRate === "number" ? raw.modRate : 0.22, 0, 1),
    modulations: typeof raw?.modulations === "object" && raw.modulations ? raw.modulations : {},
  };
}

function normalizeControlModule(raw: any): ControlModule {
  const kind: ControlKind = raw?.kind === "drift" || raw?.kind === "stepped" ? raw.kind : "lfo";
  const waveform: LfoWaveform = raw?.waveform === "triangle" || raw?.waveform === "square" || raw?.waveform === "saw" || raw?.waveform === "ramp" || raw?.waveform === "random"
    ? raw.waveform
    : "sine";
  return {
    ...raw,
    type: "control",
    engine: "control",
    name: typeof raw?.name === "string" && raw.name.trim() ? raw.name : "Control",
    presetName: typeof raw?.presetName === "string" && raw.presetName.trim() ? raw.presetName : "Sine LFO",
    enabled: raw?.enabled !== false,
    kind,
    waveform,
    speed: clamp(typeof raw?.speed === "number" ? raw.speed : 0.3, 0, 1),
    amount: clamp(typeof raw?.amount === "number" ? raw.amount : 0.55, 0, 1),
    phase: clamp(typeof raw?.phase === "number" ? raw.phase : 0, 0, 1),
    rate: clamp(typeof raw?.rate === "number" ? raw.rate : 0.35, 0, 1),
    drift: clamp(typeof raw?.drift === "number" ? raw.drift : kind === "drift" ? 0.45 : 0.2, 0, 1),
    randomness: clamp(typeof raw?.randomness === "number" ? raw.randomness : 0.3, 0, 1),
  };
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

function normalizeVisualKind(raw: unknown): VisualKind {
  if (raw === "scope" || raw === "spectrum" || raw === "vectorscope" || raw === "spectral-depth" || raw === "flow" || raw === "ritual" || raw === "glitch" || raw === "cymat") {
    return raw;
  }
  if (raw === "pattern") return "ritual";
  return "scope";
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
        engine: "trigger",
        name: `Generator ${i + 1}`,
        presetName: "Sparse Euclid",
        enabled: legacy.enabled !== false,
        x: 0,
        y: 0,
        ...normalizeSequencer(legacy, i),
      } satisfies TriggerModule;

      const soundSeed = {
        id: legacy.id,
        type: legacy.kind,
        engine: legacy.kind === "drum" ? "drum" : "synth",
        name: legacy.kind === "drum" ? `Drum ${i + 1}` : `Synth ${i + 1}`,
        presetName: legacy.kind === "drum" ? "Deep Kick" : "Rubber Bass",
        enabled: legacy.enabled !== false,
        x: 0,
        y: 0,
        triggerSource: trigger.id,
        amp: clamp(typeof legacy.amp === "number" ? legacy.amp : 0.12, 0, 1),
        timbre: clamp(typeof legacy.timbre === "number" ? legacy.timbre : 0.5, 0, 1),
        pan: clamp(typeof legacy.pan === "number" ? legacy.pan : 0, -1, 1),
      };
      const sound = legacy.kind === "drum" ? normalizeDrumModule(soundSeed) : normalizeTonalModule(soundSeed);

      legacyVoiceToTrigger.set(legacy.id, trigger.id);
      unresolvedTriggerRef.set(sound.id, typeof legacy.patternSource === "string" ? legacy.patternSource : "self");
      migrated.push(sound, trigger);
      continue;
    }

    if (moduleAny.type === "drum" || moduleAny.type === "tonal") {
      migrated.push(moduleAny.type === "drum" ? normalizeDrumModule(moduleAny) : normalizeTonalModule(moduleAny));
      continue;
    }

    if (moduleAny.type === "trigger") {
      migrated.push({
        ...moduleAny,
        engine: "trigger",
        presetName: typeof (moduleAny as any).presetName === "string" && (moduleAny as any).presetName.trim()
          ? (moduleAny as any).presetName
          : "Sparse Euclid",
        ...normalizeSequencer(moduleAny, i),
        modulations: typeof (moduleAny as any)?.modulations === "object" && (moduleAny as any).modulations
          ? (moduleAny as any).modulations
          : {},
      } as TriggerModule);
      continue;
    }

    if (moduleAny.type === "control") {
      migrated.push(normalizeControlModule(moduleAny));
      continue;
    }

    if (moduleAny.type === "visual") {
      migrated.push({
        ...moduleAny,
        engine: "visual",
        kind: normalizeVisualKind((moduleAny as any).kind),
        presetName: typeof (moduleAny as any).presetName === "string" && (moduleAny as any).presetName.trim()
          ? (moduleAny as any).presetName
          : "Scope Default",
      } as VisualModule);
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

  normalizeModuleGridPositions(migrated);

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
