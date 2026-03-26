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
  | "basePitch"
  | "decay"
  | "transient"
  | "snap"
  | "noise"
  | "bodyTone"
  | "pitchEnvAmt"
  | "pitchEnvDecay"
  | "tone"
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
  name: string;
  family: ModulePresetFamily;
  subtype: string;
  state: ModulePresetState;
  createdAt: number;
  updatedAt: number;
};

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
      basePitch: module.basePitch,
      decay: module.decay,
      transient: module.transient,
      snap: module.snap,
      noise: module.noise,
      bodyTone: module.bodyTone,
      pitchEnvAmt: module.pitchEnvAmt,
      pitchEnvDecay: module.pitchEnvDecay,
      tone: module.tone,
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
    name: sanitizeModulePresetName(typeof input.name === "string" ? input.name : "", `Preset ${index + 1}`),
    family,
    subtype: normalizedSubtype,
    state,
    createdAt: typeof input.createdAt === "number" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
  } satisfies ModulePresetRecord;
}

function starterModulePresets() {
  return [
    buildPresetRecord(makeTrigger(0), "Sparse Euclid"),
    buildPresetRecord(makeSound("drum", 0), "Deep Kick"),
    buildPresetRecord(makeSound("tonal", 0), "Rubber Bass"),
    buildPresetRecord(makeControl("lfo", 0), "Sine LFO"),
    buildPresetRecord(makeControl("drift", 0), "Warm Drift"),
    buildPresetRecord(makeControl("stepped", 0), "Stepped Motion"),
    buildPresetRecord(makeVisual("scope", 0), "Scope Default"),
    buildPresetRecord(makeVisual("spectrum", 0), "Spectrum Default"),
    buildPresetRecord(makeVisual("pattern", 0), "Pattern Default"),
  ].filter((record): record is ModulePresetRecord => Boolean(record));
}

export function loadModulePresetLibrary() {
  const raw = localStorage.getItem(MODULE_PRESET_STORAGE_KEY);
  if (!raw) return starterModulePresets();

  const parsed = safeParseJSON<any>(raw);
  if (!Array.isArray(parsed)) return starterModulePresets();

  const records = parsed
    .map((item, index) => normalizePresetRecord(item, index))
    .filter((record): record is ModulePresetRecord => Boolean(record));

  return records.length ? records : starterModulePresets();
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
  if (!linkedId) return null;
  const linked = records.find((record) => record.id === linkedId) ?? null;
  return linked && listModulePresetsForModule(records, module).some((record) => record.id === linked.id) ? linked : null;
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
  };
  return true;
}

export function saveModulePresetFromModule(records: ModulePresetRecord[], module: Module, params: { name: string; overwritePresetId?: string | null }) {
  const cleanName = sanitizeModulePresetName(params.name, module.presetName ?? `${getModulePresetFamilyLabel(module)} Preset`);
  const nextState = snapshotModulePresetState(module);
  const family = getModulePresetFamily(module);
  if (!nextState || !family) return null;

  const overwrite = params.overwritePresetId
    ? records.find((record) => record.id === params.overwritePresetId)
    : null;

  if (overwrite && listModulePresetsForModule([overwrite], module).length > 0) {
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
  };
  return { preset: created, records };
}
