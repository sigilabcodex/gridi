import type { ControlModule, DrumModule, Module, TonalModule, TriggerModule, VisualModule } from "../../patch.ts";
import { makeControl, makeSound, makeTrigger, makeVisual, uid } from "../../patch.ts";

export const MODULE_PRESET_STORAGE_KEY = "gridi.module-presets.v1";

type ModulePresetFamily = "trigger" | "drum" | "tonal" | "control" | "visual";

type TriggerPresetState = Pick<TriggerModule,
  | "enabled"
  | "mode"
  | "seed"
  | "determinism"
  | "gravity"
  | "density"
  | "subdiv"
  | "length"
  | "drop"
  | "weird"
  | "euclidRot"
  | "caRule"
  | "caInit"
>;

type DrumPresetState = Pick<DrumModule,
  | "enabled"
  | "amp"
  | "pan"
  | "panBias"
  | "stereoWidth"
  | "basePitch"
  | "attack"
  | "decay"
  | "transient"
  | "snap"
  | "noise"
  | "bodyTone"
  | "driveColor"
  | "pitchEnvAmt"
  | "pitchEnvDecay"
  | "bendDecay"
  | "tone"
  | "comp"
  | "compThreshold"
  | "compRatio"
  | "compAttack"
  | "compRelease"
  | "boost"
  | "boostTarget"
>;

type TonalPresetState = Pick<TonalModule,
  | "enabled"
  | "amp"
  | "pan"
  | "waveform"
  | "coarseTune"
  | "fineTune"
  | "attack"
  | "decay"
  | "sustain"
  | "release"
  | "cutoff"
  | "resonance"
  | "glide"
  | "modDepth"
  | "modRate"
>;

type ControlPresetState = Pick<ControlModule,
  | "enabled"
  | "kind"
  | "waveform"
  | "speed"
  | "amount"
  | "phase"
  | "rate"
  | "drift"
  | "randomness"
>;

type VisualPresetState = Pick<VisualModule,
  | "enabled"
  | "kind"
  | "fftSize"
>;

export type ModulePresetState = TriggerPresetState | DrumPresetState | TonalPresetState | ControlPresetState | VisualPresetState;

export type ModulePresetRecord = {
  id: string;
  code?: string;
  name: string;
  family: ModulePresetFamily;
  subtype: string;
  state: ModulePresetState;
  source?: "factory" | "user";
  createdAt: number;
  updatedAt: number;
};

export function formatModulePresetDisplayName(record: Pick<ModulePresetRecord, "name" | "code">) {
  const code = typeof record.code === "string" ? record.code.trim() : "";
  return code ? `${code} · ${record.name}` : record.name;
}

function safeParseJSON<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function sanitizeModulePresetName(name: string, fallback: string) {
  const cleaned = name.replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

export function getModulePresetFamily(module: Module): ModulePresetFamily | null {
  if (module.type === "trigger" || module.type === "drum" || module.type === "tonal" || module.type === "control" || module.type === "visual") {
    return module.type;
  }
  return null;
}

export function getModulePresetSubtype(module: Module) {
  if (module.type === "control") return module.kind;
  if (module.type === "visual") return module.kind;
  return module.type;
}

export function isModulePresetSubtypeCompatible(record: Pick<ModulePresetRecord, "family" | "subtype" | "state">, module: Module) {
  if (record.family !== getModulePresetFamily(module)) return false;

  if (module.type === "control") {
    const recordSubtype = String(record.subtype || "").trim();
    const stateKind = (record.state as Partial<ControlPresetState>).kind;
    return recordSubtype === module.kind || stateKind === module.kind;
  }

  if (module.type === "visual") {
    const recordSubtype = String(record.subtype || "").trim();
    const stateKind = (record.state as Partial<VisualPresetState>).kind;
    return recordSubtype === module.kind || stateKind === module.kind;
  }

  return true;
}

export function getModulePresetFamilyLabel(module: Module) {
  if (module.type === "tonal") return "Synth";
  return module.type.charAt(0).toUpperCase() + module.type.slice(1);
}

export function getModulePresetSubtypeLabel(record: Pick<ModulePresetRecord, "family" | "subtype">) {
  if (record.family === "control") return record.subtype.toUpperCase();
  if (record.family === "visual") return record.subtype.toUpperCase();
  if (record.family === "tonal") return "Synth";
  return record.subtype.toUpperCase();
}

function snapshotModulePresetState(module: Module): ModulePresetState | null {
  if (module.type === "trigger") {
    const state: TriggerPresetState = {
      enabled: module.enabled,
      mode: module.mode,
      seed: module.seed,
      determinism: module.determinism,
      gravity: module.gravity,
      density: module.density,
      subdiv: module.subdiv,
      length: module.length,
      drop: module.drop,
      weird: module.weird,
      euclidRot: module.euclidRot,
      caRule: module.caRule,
      caInit: module.caInit,
    };
    return state;
  }

  if (module.type === "drum") {
    const state: DrumPresetState = {
      enabled: module.enabled,
      amp: module.amp,
      pan: module.pan,
      panBias: module.panBias,
      stereoWidth: module.stereoWidth,
      basePitch: module.basePitch,
      attack: module.attack,
      decay: module.decay,
      transient: module.transient,
      snap: module.snap,
      noise: module.noise,
      bodyTone: module.bodyTone,
      driveColor: module.driveColor,
      pitchEnvAmt: module.pitchEnvAmt,
      pitchEnvDecay: module.pitchEnvDecay,
      bendDecay: module.bendDecay,
      tone: module.tone,
      comp: module.comp,
      compThreshold: module.compThreshold,
      compRatio: module.compRatio,
      compAttack: module.compAttack,
      compRelease: module.compRelease,
      boost: module.boost,
      boostTarget: module.boostTarget,
    };
    return state;
  }

  if (module.type === "tonal") {
    const state: TonalPresetState = {
      enabled: module.enabled,
      amp: module.amp,
      pan: module.pan,
      waveform: module.waveform,
      coarseTune: module.coarseTune,
      fineTune: module.fineTune,
      attack: module.attack,
      decay: module.decay,
      sustain: module.sustain,
      release: module.release,
      cutoff: module.cutoff,
      resonance: module.resonance,
      glide: module.glide,
      modDepth: module.modDepth,
      modRate: module.modRate,
    };
    return state;
  }

  if (module.type === "control") {
    const state: ControlPresetState = {
      enabled: module.enabled,
      kind: module.kind,
      waveform: module.waveform,
      speed: module.speed,
      amount: module.amount,
      phase: module.phase,
      rate: module.rate,
      drift: module.drift,
      randomness: module.randomness,
    };
    return state;
  }

  if (module.type === "visual") {
    const state: VisualPresetState = {
      enabled: module.enabled,
      kind: module.kind,
      fftSize: module.fftSize,
    };
    return state;
  }

  return null;
}

function buildPresetRecord(module: Module, name: string, now = Date.now()): ModulePresetRecord | null {
  const family = getModulePresetFamily(module);
  const state = snapshotModulePresetState(module);
  if (!family || !state) return null;

  return {
    id: uid("modulepreset"),
    name: sanitizeModulePresetName(name, module.presetName ?? `${getModulePresetFamilyLabel(module)} Preset`),
    family,
    subtype: getModulePresetSubtype(module),
    state,
    source: "user",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizePresetRecord(input: any, index: number): ModulePresetRecord | null {
  if (!input || typeof input !== "object") return null;
  const family = input.family;
  if (!["trigger", "drum", "tonal", "control", "visual"].includes(family)) return null;
  if (!input.state || typeof input.state !== "object") return null;

  const now = Date.now();
  const state = structuredClone(input.state);
  const normalizedSubtype = typeof input.subtype === "string" && input.subtype.trim()
    ? input.subtype
    : family === "control" || family === "visual"
      ? String((state as Partial<ControlPresetState | VisualPresetState>).kind ?? family)
      : family;

  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id : uid("modulepreset"),
    code: typeof input.code === "string" && input.code.trim() ? input.code.trim() : undefined,
    name: sanitizeModulePresetName(typeof input.name === "string" ? input.name : "", `Preset ${index + 1}`),
    family,
    subtype: normalizedSubtype,
    state,
    source: input.source === "factory" ? "factory" : "user",
    createdAt: typeof input.createdAt === "number" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
  } satisfies ModulePresetRecord;
}

function buildFactoryPreset(
  id: string,
  code: string,
  module: Module,
  name: string,
  stateOverrides: Record<string, unknown>,
  timestamp: number,
): ModulePresetRecord | null {
  const family = getModulePresetFamily(module);
  const state = snapshotModulePresetState(module);
  if (!family || !state) return null;

  Object.assign(state as Record<string, unknown>, stateOverrides);
  return {
    id,
    code,
    name,
    family,
    subtype: getModulePresetSubtype(module),
    state,
    source: "factory",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function starterModulePresets() {
  const factoryTimestamp = Date.UTC(2026, 3, 14, 0, 0, 0);
  const buildCodedStarter = (code: string, module: Module, name: string) => {
    const record = buildPresetRecord(module, name);
    if (!record) return null;
    return { ...record, code, source: "factory" as const, createdAt: factoryTimestamp, updatedAt: factoryTimestamp };
  };

  const drumFactory: Array<ModulePresetRecord | null> = [
    buildFactoryPreset("factory-drum-deep-kick", "DRUM001", makeSound("drum", 0), "Deep Kick", { amp: 0.2, basePitch: 0.23, attack: 0.12, decay: 0.52, transient: 0.46, snap: 0.18, noise: 0.06, bodyTone: 0.34, driveColor: 0.34, pitchEnvAmt: 0.68, pitchEnvDecay: 0.24, bendDecay: 0.32, tone: 0.3, comp: 0.38, boost: 0.4, boostTarget: "body", stereoWidth: 0.22 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-soft-kick", "DRUM002",makeSound("drum", 0), "Soft Kick", { amp: 0.16, basePitch: 0.33, attack: 0.24, decay: 0.38, transient: 0.3, snap: 0.12, noise: 0.04, bodyTone: 0.45, driveColor: 0.25, pitchEnvAmt: 0.42, pitchEnvDecay: 0.4, bendDecay: 0.48, tone: 0.44, comp: 0.22, boost: 0.12, boostTarget: "body", stereoWidth: 0.18 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-punch-kick", "DRUM003",makeSound("drum", 0), "Punch Kick", { amp: 0.2, basePitch: 0.4, attack: 0.1, decay: 0.3, transient: 0.84, snap: 0.62, noise: 0.11, bodyTone: 0.58, driveColor: 0.6, pitchEnvAmt: 0.56, pitchEnvDecay: 0.2, bendDecay: 0.26, tone: 0.56, comp: 0.52, compThreshold: 0.38, compRatio: 0.72, compAttack: 0.12, compRelease: 0.34, boost: 0.34, boostTarget: "attack", stereoWidth: 0.24 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-click-kick", "DRUM004",makeSound("drum", 0), "Click Kick", { amp: 0.18, basePitch: 0.5, attack: 0.03, decay: 0.24, transient: 0.92, snap: 0.88, noise: 0.15, bodyTone: 0.44, driveColor: 0.68, pitchEnvAmt: 0.48, pitchEnvDecay: 0.14, bendDecay: 0.18, tone: 0.62, comp: 0.58, boost: 0.5, boostTarget: "attack", stereoWidth: 0.2 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-sub-kick", "DRUM005",makeSound("drum", 0), "Sub Kick", { amp: 0.24, basePitch: 0.12, attack: 0.22, decay: 0.6, transient: 0.22, snap: 0.08, noise: 0.02, bodyTone: 0.26, driveColor: 0.2, pitchEnvAmt: 0.24, pitchEnvDecay: 0.54, bendDecay: 0.58, tone: 0.2, comp: 0.22, boost: 0.52, boostTarget: "body", stereoWidth: 0.12 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-noisy-kick", "DRUM006",makeSound("drum", 0), "Noisy Kick", { amp: 0.19, basePitch: 0.46, attack: 0.08, decay: 0.42, transient: 0.7, snap: 0.62, noise: 0.55, bodyTone: 0.52, driveColor: 0.76, pitchEnvAmt: 0.5, pitchEnvDecay: 0.24, bendDecay: 0.28, tone: 0.64, comp: 0.46, boost: 0.36, boostTarget: "air", stereoWidth: 0.42 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-tom-like", "DRUM007",makeSound("drum", 0), "Tom Like", { amp: 0.18, basePitch: 0.56, attack: 0.18, decay: 0.48, transient: 0.36, snap: 0.22, noise: 0.08, bodyTone: 0.7, driveColor: 0.4, pitchEnvAmt: 0.34, pitchEnvDecay: 0.46, bendDecay: 0.52, tone: 0.62, comp: 0.28, boost: 0.18, boostTarget: "body", stereoWidth: 0.3 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-snare-like", "DRUM008",makeSound("drum", 0), "Snare Like", { amp: 0.16, basePitch: 0.62, attack: 0.06, decay: 0.44, transient: 0.78, snap: 0.66, noise: 0.72, bodyTone: 0.58, driveColor: 0.64, pitchEnvAmt: 0.24, pitchEnvDecay: 0.32, bendDecay: 0.34, tone: 0.56, comp: 0.5, boost: 0.4, boostTarget: "attack", stereoWidth: 0.58 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-hat-like", "DRUM009",makeSound("drum", 0), "Hat Like", { amp: 0.11, basePitch: 0.82, attack: 0.02, decay: 0.14, transient: 0.82, snap: 0.78, noise: 0.94, bodyTone: 0.78, driveColor: 0.74, pitchEnvAmt: 0.12, pitchEnvDecay: 0.12, bendDecay: 0.16, tone: 0.8, comp: 0.34, boost: 0.44, boostTarget: "air", stereoWidth: 0.86 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-metallic-tick", "DRUM010",makeSound("drum", 0), "Metallic Tick", { amp: 0.12, basePitch: 0.9, attack: 0.01, decay: 0.1, transient: 0.94, snap: 0.86, noise: 0.6, bodyTone: 0.84, driveColor: 0.9, pitchEnvAmt: 0.2, pitchEnvDecay: 0.1, bendDecay: 0.1, tone: 0.9, comp: 0.4, boost: 0.6, boostTarget: "air", stereoWidth: 0.72 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-pop-perc", "DRUM011",makeSound("drum", 0), "Pop Perc", { amp: 0.15, basePitch: 0.68, attack: 0.04, decay: 0.2, transient: 0.82, snap: 0.68, noise: 0.32, bodyTone: 0.62, driveColor: 0.56, pitchEnvAmt: 0.66, pitchEnvDecay: 0.18, bendDecay: 0.22, tone: 0.68, comp: 0.4, boost: 0.24, boostTarget: "attack", stereoWidth: 0.44 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-distorted-perc", "DRUM012",makeSound("drum", 0), "Distorted Perc", { amp: 0.14, basePitch: 0.74, attack: 0.04, decay: 0.28, transient: 0.74, snap: 0.7, noise: 0.48, bodyTone: 0.66, driveColor: 0.96, pitchEnvAmt: 0.32, pitchEnvDecay: 0.18, bendDecay: 0.2, tone: 0.76, comp: 0.68, compThreshold: 0.32, compRatio: 0.8, compAttack: 0.1, compRelease: 0.28, boost: 0.7, boostTarget: "air", stereoWidth: 0.5 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-tight-snare", "DRUM013", makeSound("drum", 0), "Tight Snare", { amp: 0.16, basePitch: 0.66, attack: 0.03, decay: 0.3, transient: 0.86, snap: 0.78, noise: 0.68, bodyTone: 0.5, driveColor: 0.54, pitchEnvAmt: 0.18, pitchEnvDecay: 0.2, bendDecay: 0.24, tone: 0.58, comp: 0.46, boost: 0.34, boostTarget: "attack", stereoWidth: 0.44 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-closed-hat", "DRUM014", makeSound("drum", 0), "Closed Hat", { amp: 0.1, basePitch: 0.88, attack: 0.006, decay: 0.08, transient: 0.9, snap: 0.84, noise: 0.96, bodyTone: 0.82, driveColor: 0.62, pitchEnvAmt: 0.08, pitchEnvDecay: 0.08, bendDecay: 0.1, tone: 0.86, comp: 0.28, boost: 0.38, boostTarget: "air", stereoWidth: 0.76 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-low-conga", "DRUM015", makeSound("drum", 0), "Low Conga", { amp: 0.15, basePitch: 0.48, attack: 0.08, decay: 0.36, transient: 0.5, snap: 0.28, noise: 0.12, bodyTone: 0.76, driveColor: 0.36, pitchEnvAmt: 0.26, pitchEnvDecay: 0.34, bendDecay: 0.38, tone: 0.54, comp: 0.24, boost: 0.18, boostTarget: "body", stereoWidth: 0.34 }, factoryTimestamp),
    buildFactoryPreset("factory-drum-dust-rim", "DRUM016", makeSound("drum", 0), "Dust Rim", { amp: 0.11, basePitch: 0.78, attack: 0.012, decay: 0.18, transient: 0.88, snap: 0.8, noise: 0.82, bodyTone: 0.68, driveColor: 0.88, pitchEnvAmt: 0.16, pitchEnvDecay: 0.12, bendDecay: 0.14, tone: 0.74, comp: 0.5, boost: 0.54, boostTarget: "air", stereoWidth: 0.62 }, factoryTimestamp),
  ];

  const synthFactory: Array<ModulePresetRecord | null> = [
    buildFactoryPreset("factory-synth-rubber-bass", "SYNTH001",makeSound("tonal", 0), "Rubber Bass", { amp: 0.14, waveform: 0.24, coarseTune: 0.16, fineTune: 0.44, attack: 0.01, decay: 0.32, sustain: 0.52, release: 0.28, cutoff: 0.42, resonance: 0.24, glide: 0.14, modDepth: 0.22, modRate: 0.3 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-soft-bass", "SYNTH002",makeSound("tonal", 0), "Soft Bass", { amp: 0.13, waveform: 0.34, coarseTune: 0.12, fineTune: 0.5, attack: 0.06, decay: 0.42, sustain: 0.58, release: 0.5, cutoff: 0.34, resonance: 0.16, glide: 0.1, modDepth: 0.12, modRate: 0.2 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-bright-pluck", "SYNTH003",makeSound("tonal", 0), "Bright Pluck", { amp: 0.12, waveform: 0.74, coarseTune: 0.2, fineTune: 0.56, attack: 0.002, decay: 0.22, sustain: 0.2, release: 0.16, cutoff: 0.82, resonance: 0.52, glide: 0.02, modDepth: 0.18, modRate: 0.56 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-muted-pluck", "SYNTH004",makeSound("tonal", 0), "Muted Pluck", { amp: 0.12, waveform: 0.44, coarseTune: 0.18, fineTune: 0.48, attack: 0.004, decay: 0.2, sustain: 0.14, release: 0.12, cutoff: 0.32, resonance: 0.36, glide: 0.03, modDepth: 0.16, modRate: 0.42 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-lead", "SYNTH005",makeSound("tonal", 0), "Lead", { amp: 0.15, waveform: 0.68, coarseTune: 0.6, fineTune: 0.5, attack: 0.01, decay: 0.3, sustain: 0.68, release: 0.34, cutoff: 0.68, resonance: 0.34, glide: 0.2, modDepth: 0.22, modRate: 0.48 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-hollow-lead", "SYNTH006",makeSound("tonal", 0), "Hollow Lead", { amp: 0.13, waveform: 0.9, coarseTune: 0.66, fineTune: 0.46, attack: 0.02, decay: 0.28, sustain: 0.6, release: 0.4, cutoff: 0.56, resonance: 0.62, glide: 0.24, modDepth: 0.28, modRate: 0.4 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-drone", "SYNTH007",makeSound("tonal", 0), "Drone", { amp: 0.11, waveform: 0.36, coarseTune: 0.08, fineTune: 0.54, attack: 0.22, decay: 0.64, sustain: 0.86, release: 0.82, cutoff: 0.28, resonance: 0.24, glide: 0.42, modDepth: 0.38, modRate: 0.12 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-airy-pad", "SYNTH008",makeSound("tonal", 0), "Airy Pad", { amp: 0.1, waveform: 0.62, coarseTune: 0.24, fineTune: 0.58, attack: 0.26, decay: 0.56, sustain: 0.78, release: 0.88, cutoff: 0.62, resonance: 0.22, glide: 0.34, modDepth: 0.2, modRate: 0.18 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-glass-tone", "SYNTH009",makeSound("tonal", 0), "Glass Tone", { amp: 0.12, waveform: 0.96, coarseTune: 0.28, fineTune: 0.62, attack: 0.01, decay: 0.36, sustain: 0.44, release: 0.36, cutoff: 0.84, resonance: 0.74, glide: 0.06, modDepth: 0.3, modRate: 0.58 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-noisy-tone", "SYNTH010",makeSound("tonal", 0), "Noisy Tone", { amp: 0.11, waveform: 0.82, coarseTune: 0.88, fineTune: 0.64, attack: 0.02, decay: 0.4, sustain: 0.46, release: 0.42, cutoff: 0.72, resonance: 0.46, glide: 0.12, modDepth: 0.56, modRate: 0.52 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-fm-like-tone", "SYNTH011",makeSound("tonal", 0), "FM-like Tone", { amp: 0.12, waveform: 0.56, coarseTune: 0.7, fineTune: 0.5, attack: 0.006, decay: 0.34, sustain: 0.4, release: 0.3, cutoff: 0.66, resonance: 0.48, glide: 0.08, modDepth: 0.74, modRate: 0.82 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-wide-stereo-tone", "SYNTH012",makeSound("tonal", 0), "Wide Stereo Tone", { amp: 0.11, pan: 0.18, waveform: 0.66, coarseTune: 0.32, fineTune: 0.52, attack: 0.03, decay: 0.44, sustain: 0.62, release: 0.5, cutoff: 0.6, resonance: 0.34, glide: 0.82, modDepth: 0.26, modRate: 0.36 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-sub-sine-bass", "SYNTH013", makeSound("tonal", 0), "Sub Sine Bass", { amp: 0.14, waveform: 0.08, coarseTune: 0.1, fineTune: 0.5, attack: 0.02, decay: 0.38, sustain: 0.72, release: 0.34, cutoff: 0.26, resonance: 0.12, glide: 0.12, modDepth: 0.06, modRate: 0.18 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-square-lead", "SYNTH014", makeSound("tonal", 0), "Square Lead", { amp: 0.14, waveform: 0.76, coarseTune: 0.58, fineTune: 0.5, attack: 0.008, decay: 0.24, sustain: 0.64, release: 0.24, cutoff: 0.72, resonance: 0.36, glide: 0.16, modDepth: 0.18, modRate: 0.46 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-warm-pad", "SYNTH015", makeSound("tonal", 0), "Warm Pad", { amp: 0.1, waveform: 0.42, coarseTune: 0.24, fineTune: 0.52, attack: 0.34, decay: 0.6, sustain: 0.82, release: 0.9, cutoff: 0.48, resonance: 0.18, glide: 0.28, modDepth: 0.16, modRate: 0.16 }, factoryTimestamp),
    buildFactoryPreset("factory-synth-noise-sweep", "SYNTH016", makeSound("tonal", 0), "Noise Sweep", { amp: 0.1, waveform: 0.92, coarseTune: 0.74, fineTune: 0.6, attack: 0.18, decay: 0.7, sustain: 0.54, release: 0.74, cutoff: 0.86, resonance: 0.7, glide: 0.58, modDepth: 0.68, modRate: 0.64 }, factoryTimestamp),
  ];

  return [
    buildCodedStarter("GEN001", makeTrigger(0), "Sparse Euclid"),
    buildCodedStarter("CTRL001", makeControl("lfo", 0), "Sine LFO"),
    buildCodedStarter("CTRL002", makeControl("drift", 0), "Warm Drift"),
    buildCodedStarter("CTRL003", makeControl("stepped", 0), "Stepped Motion"),
    buildCodedStarter("VIS001", makeVisual("scope", 0), "Scope Default"),
    buildCodedStarter("VIS002", makeVisual("spectrum", 0), "Spectrum Default"),
    buildCodedStarter("VIS003", makeVisual("vectorscope", 0), "Vectorscope Default"),
    buildCodedStarter("VIS004", makeVisual("spectral-depth", 0), "Spectral Depth Default"),
    buildCodedStarter("VIS005", makeVisual("flow", 0), "Flow Default"),
    buildCodedStarter("VIS006", makeVisual("ritual", 0), "Ritual Default"),
    buildCodedStarter("VIS007", makeVisual("glitch", 0), "Glitch Default"),
    buildCodedStarter("VIS008", makeVisual("cymat", 0), "Cymat Default"),
    ...drumFactory,
    ...synthFactory,
  ].filter((record): record is ModulePresetRecord => Boolean(record));
}

export function loadModulePresetLibrary() {
  const factoryRecords = starterModulePresets();
  const raw = localStorage.getItem(MODULE_PRESET_STORAGE_KEY);
  if (!raw) return factoryRecords;

  const parsed = safeParseJSON<any>(raw);
  if (!Array.isArray(parsed)) return factoryRecords;

  const records = parsed
    .map((item, index) => normalizePresetRecord(item, index))
    .filter((record): record is ModulePresetRecord => Boolean(record));

  const existingIds = new Set(records.map((record) => record.id));
  for (const factory of factoryRecords) {
    if (existingIds.has(factory.id)) continue;
    records.push(factory);
  }

  return records.length ? records : factoryRecords;
}

export function saveModulePresetLibrary(records: ModulePresetRecord[]) {
  localStorage.setItem(MODULE_PRESET_STORAGE_KEY, JSON.stringify(records));
}

export function listModulePresetsForModule(records: ModulePresetRecord[], module: Module) {
  const family = getModulePresetFamily(module);
  if (!family) return [];

  return records.filter((record) => {
    if (record.family !== family) return false;
    if (module.type === "drum" || module.type === "tonal") return record.family === module.type;
    return isModulePresetSubtypeCompatible(record, module);
  });
}

export function findLinkedModulePreset(records: ModulePresetRecord[], module: Module) {
  const linkedId = typeof module.presetMeta?.modulePresetId === "string" ? module.presetMeta.modulePresetId : null;
  const compat = listModulePresetsForModule(records, module);
  if (linkedId) {
    const linked = records.find((record) => record.id === linkedId) ?? null;
    if (linked && compat.some((record) => record.id === linked.id)) return linked;
  }

  if (!module.presetName) return null;
  const byName = compat.find((record) => record.name.toLowerCase() === module.presetName?.toLowerCase());
  return byName ?? null;
}

function presetStatesEqual(a: ModulePresetState, b: ModulePresetState) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export type ModulePresetProvenance = {
  linkedPreset: ModulePresetRecord | null;
  matchedPreset: ModulePresetRecord | null;
  isStateLinked: boolean;
  isStateModified: boolean;
  source: "factory" | "user" | "none";
};

export function getModulePresetProvenance(records: ModulePresetRecord[], module: Module): ModulePresetProvenance {
  const linkedById = (() => {
    const linkedId = typeof module.presetMeta?.modulePresetId === "string" ? module.presetMeta.modulePresetId : null;
    if (!linkedId) return null;
    const record = records.find((entry) => entry.id === linkedId) ?? null;
    if (!record) return null;
    const compatible = listModulePresetsForModule([record], module).length > 0;
    return compatible ? record : null;
  })();

  const fallbackMatch = linkedById ? null : findLinkedModulePreset(records, module);
  const matchedPreset = linkedById ?? fallbackMatch;
  const source = matchedPreset?.source ?? "none";
  if (!matchedPreset) {
    return {
      linkedPreset: null,
      matchedPreset: null,
      isStateLinked: false,
      isStateModified: false,
      source,
    };
  }

  const moduleState = snapshotModulePresetState(module);
  const isStateLinked = Boolean(moduleState) && presetStatesEqual(moduleState as ModulePresetState, matchedPreset.state);
  return {
    linkedPreset: linkedById,
    matchedPreset,
    isStateLinked,
    isStateModified: !isStateLinked,
    source,
  };
}

export function applyModulePreset(module: Module, preset: ModulePresetRecord) {
  const allowed = listModulePresetsForModule([preset], module).length > 0;
  if (!allowed) return false;

  if (module.type === "trigger" && preset.family === "trigger") {
    Object.assign(module, preset.state);
  } else if (module.type === "drum" && preset.family === "drum") {
    Object.assign(module, preset.state);
  } else if (module.type === "tonal" && preset.family === "tonal") {
    Object.assign(module, preset.state);
  } else if (module.type === "control" && preset.family === "control") {
    Object.assign(module, preset.state);
  } else if (module.type === "visual" && preset.family === "visual") {
    Object.assign(module, preset.state);
  } else {
    return false;
  }

  module.presetName = preset.name;
  module.presetMeta = {
    ...(module.presetMeta ?? {}),
    modulePresetId: preset.id,
    modulePresetFamily: preset.family,
    modulePresetSubtype: preset.subtype,
    modulePresetUpdatedAt: preset.updatedAt,
    modulePresetSource: preset.source ?? "user",
    ...(preset.code ? { modulePresetCode: preset.code } : {}),
  };
  return true;
}

function isControlKind(value: string): value is ControlModule["kind"] {
  return value === "lfo" || value === "drift" || value === "stepped";
}

function isVisualKind(value: string): value is VisualModule["kind"] {
  return value === "scope" || value === "spectrum" || value === "vectorscope" || value === "spectral-depth" || value === "flow" || value === "ritual" || value === "glitch" || value === "cymat";
}

export function createModuleFromModulePreset(record: ModulePresetRecord, index = 0): Module | null {
  const module = (() => {
    if (record.family === "trigger") return makeTrigger(index);
    if (record.family === "drum") return makeSound("drum", index);
    if (record.family === "tonal") return makeSound("tonal", index);
    if (record.family === "control") {
      const subtype = String(record.subtype || "");
      return isControlKind(subtype) ? makeControl(subtype, index) : null;
    }
    if (record.family === "visual") {
      const subtype = String(record.subtype || "");
      return isVisualKind(subtype) ? makeVisual(subtype, index) : null;
    }
    return null;
  })();

  if (!module) return null;
  return applyModulePreset(module, record) ? module : null;
}

export function saveModulePresetFromModule(records: ModulePresetRecord[], module: Module, params: { name: string; overwritePresetId?: string | null }) {
  const cleanName = sanitizeModulePresetName(params.name, module.presetName ?? `${getModulePresetFamilyLabel(module)} Preset`);
  const nextState = snapshotModulePresetState(module);
  const family = getModulePresetFamily(module);
  if (!nextState || !family) return null;

  const overwrite = params.overwritePresetId
    ? records.find((record) => record.id === params.overwritePresetId)
    : null;

  if (overwrite && listModulePresetsForModule([overwrite], module).length > 0 && overwrite.source !== "factory") {
    overwrite.name = cleanName;
    overwrite.subtype = getModulePresetSubtype(module);
    overwrite.state = nextState;
    overwrite.updatedAt = Date.now();
    module.presetName = overwrite.name;
    module.presetMeta = {
      ...(module.presetMeta ?? {}),
      modulePresetId: overwrite.id,
      modulePresetFamily: overwrite.family,
      modulePresetSubtype: overwrite.subtype,
      modulePresetUpdatedAt: overwrite.updatedAt,
      modulePresetSource: overwrite.source ?? "user",
      ...(overwrite.code ? { modulePresetCode: overwrite.code } : {}),
    };
    return { preset: overwrite, records };
  }

  const created = buildPresetRecord(module, cleanName);
  if (!created) return null;
  records.push(created);
  module.presetName = created.name;
  module.presetMeta = {
    ...(module.presetMeta ?? {}),
    modulePresetId: created.id,
    modulePresetFamily: created.family,
    modulePresetSubtype: created.subtype,
    modulePresetUpdatedAt: created.updatedAt,
    modulePresetSource: created.source ?? "user",
    ...(created.code ? { modulePresetCode: created.code } : {}),
  };
  return { preset: created, records };
}
