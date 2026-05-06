import type { Patch, SoundModule, TriggerModule } from "../../patch.ts";
import { makeSound, makeTrigger, migratePatch, uid } from "../../patch.ts";
import { BANK_COUNT, loadState as loadLegacyBankState } from "./bankState.ts";

export const PRESET_STORAGE_KEY = "gridi.presets.v0_33";
const PRESET_EXPORT_VERSION = "0.33";

type PresetRecord = {
  id: string;
  name: string;
  patch: Patch;
  createdAt: number;
  updatedAt: number;
  source?: "factory" | "user";
};

export type PresetSession = {
  version: string;
  selectedPresetId: string;
  presets: PresetRecord[];
};

export type PresetExportPayload = {
  version: string;
  exportedAt: string;
  selectedPresetId: string;
  presets: PresetRecord[];
};

export type SinglePresetExportPayload = {
  version: string;
  exportedAt: string;
  preset: PresetRecord;
};

function safeParseJSON<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function isPatchLike(x: any): x is Patch {
  return x && typeof x === "object" && x.version === "0.3" && Array.isArray(x.modules);
}

function normalizePreset(input: any, fallbackName: string): PresetRecord | null {
  if (!input || typeof input !== "object" || !isPatchLike(input.patch)) return null;

  const now = Date.now();
  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id : uid("preset"),
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : fallbackName,
    patch: migratePatch(input.patch),
    createdAt: typeof input.createdAt === "number" ? input.createdAt : now,
    updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
    source: input.source === "factory" || input.source === "user" ? input.source : undefined,
  };
}

const FACTORY_CREATED_AT = Date.UTC(2026, 4, 6);

const patchShell = (modules: Patch["modules"], bpm = 124): Patch =>
  migratePatch({
    version: "0.3",
    bpm,
    macro: 0.5,
    masterGain: 0.8,
    masterMute: false,
    modules,
    buses: [],
    connections: [],
  });

const place = <T extends Patch["modules"][number]>(module: T, id: string, x: number, y: number, name?: string): T => {
  module.id = id;
  module.x = x;
  module.y = y;
  if (name) module.name = name;
  return module;
};

const tuneTrigger = (trigger: TriggerModule, params: Partial<TriggerModule>) => Object.assign(trigger, params);
const tuneSound = <T extends SoundModule>(sound: T, params: Partial<T>) => Object.assign(sound, params);

export function factoryExamplePatches(): { name: string; patch: Patch }[] {
  const basicGen = place(makeTrigger(0, "GEN · Pulse Clock"), "factory-basic-gen", 0, 0);
  tuneTrigger(basicGen, {
    mode: "euclidean",
    presetName: "Sparse Euclid",
    density: 0.5,
    accent: 0.62,
    determinism: 0.92,
    gravity: 0.5,
    subdiv: 4,
    length: 16,
    drop: 0.04,
    weird: 0.18,
    euclidRot: 0,
  });
  const basicKick = tuneSound(place(makeSound("drum", 0, basicGen.id), "factory-basic-kick", 1, 1, "DRUM · Kick Pulse"), {
    presetName: "Deep Kick",
    drumChannel: "01",
    amp: 0.18,
    basePitch: 0.28,
    decay: 0.32,
    transient: 0.72,
    snap: 0.22,
    noise: 0.08,
    bodyTone: 0.42,
    tone: 0.38,
  });
  const basicSnare = tuneSound(place(makeSound("drum", 1, basicGen.id), "factory-basic-snare", 2, 1, "DRUM · Backbeat Snap"), {
    presetName: "Deep Kick",
    drumChannel: "02",
    amp: 0.13,
    basePitch: 0.54,
    decay: 0.22,
    transient: 0.76,
    snap: 0.72,
    noise: 0.5,
    bodyTone: 0.34,
    tone: 0.58,
    pan: 0.08,
  });
  const basicBass = tuneSound(place(makeSound("tonal", 0, basicGen.id), "factory-basic-bass", 3, 1, "SYNTH · Mono Bass"), {
    reception: "mono",
    amp: 0.1,
    waveform: 0.18,
    coarseTune: -12,
    attack: 0.01,
    decay: 0.24,
    sustain: 0.52,
    release: 0.28,
    cutoff: 0.42,
    resonance: 0.16,
    glide: 0.05,
  });

  const lowGen = place(makeTrigger(0, "GEN 1 · Low Drums"), "factory-dual-low-gen", 0, 0);
  tuneTrigger(lowGen, { mode: "euclidean", density: 0.42, accent: 0.68, determinism: 0.9, gravity: 0.62, subdiv: 4, length: 16, drop: 0.06, weird: 0.16 });
  const highGen = place(makeTrigger(1, "GEN 2 · Hats + Perc"), "factory-dual-high-gen", 0, 2);
  tuneTrigger(highGen, { mode: "step-sequencer", density: 0.68, accent: 0.5, determinism: 0.86, gravity: 0.38, subdiv: 4, length: 16, drop: 0.08, weird: 0.22, euclidRot: 3 });
  const dualKick = tuneSound(place(makeSound("drum", 0, lowGen.id), "factory-dual-kick", 1, 0, "DRUM · Kick"), { drumChannel: "01", amp: 0.18, basePitch: 0.26, decay: 0.34, transient: 0.75, noise: 0.06, tone: 0.36 });
  const dualSnare = tuneSound(place(makeSound("drum", 1, lowGen.id), "factory-dual-snare", 2, 0, "DRUM · Snare"), { drumChannel: "02", amp: 0.14, basePitch: 0.55, decay: 0.24, transient: 0.8, snap: 0.76, noise: 0.52, tone: 0.62 });
  const dualHatClosed = tuneSound(place(makeSound("drum", 2, highGen.id), "factory-dual-hat-closed", 1, 2, "DRUM · Closed Hat"), { drumChannel: "03", amp: 0.08, basePitch: 0.78, decay: 0.12, transient: 0.82, snap: 0.64, noise: 0.76, bodyTone: 0.18, tone: 0.82, pan: -0.14 });
  const dualHatOpen = tuneSound(place(makeSound("drum", 3, highGen.id), "factory-dual-hat-open", 2, 2, "DRUM · Open Hat"), { drumChannel: "04", amp: 0.07, basePitch: 0.72, decay: 0.44, transient: 0.58, snap: 0.48, noise: 0.82, bodyTone: 0.16, tone: 0.78, pan: 0.16 });
  const dualPerc = tuneSound(place(makeSound("drum", 4, highGen.id), "factory-dual-perc", 3, 2, "DRUM · Perc Tick"), { drumChannel: "05", amp: 0.09, basePitch: 0.64, decay: 0.18, transient: 0.7, snap: 0.58, noise: 0.34, bodyTone: 0.28, tone: 0.66, pan: 0.24 });

  const radarGen = place(makeTrigger(0, "GEN 1 · RADAR Sweep"), "factory-field-radar-gen", 0, 0);
  tuneTrigger(radarGen, { mode: "radar", density: 0.36, accent: 0.6, determinism: 0.82, gravity: 0.5, subdiv: 4, length: 16, drop: 0.1, weird: 0.42 });
  const gearGen = place(makeTrigger(1, "GEN 2 · Gear Clock"), "factory-field-gear-gen", 0, 2);
  tuneTrigger(gearGen, { mode: "gear", density: 0.48, accent: 0.54, determinism: 0.88, gravity: 0.45, subdiv: 4, length: 16, drop: 0.08, weird: 0.32 });
  const markovGen = place(makeTrigger(2, "GEN 3 · Markov Notes"), "factory-field-markov-gen", 0, 4);
  tuneTrigger(markovGen, { mode: "markov-chains", density: 0.44, accent: 0.5, determinism: 0.74, gravity: 0.52, subdiv: 4, length: 16, drop: 0.12, weird: 0.36 });
  const fieldKick = tuneSound(place(makeSound("drum", 0, gearGen.id), "factory-field-kick", 1, 2, "DRUM · Soft Kick"), { drumChannel: "01", amp: 0.15, basePitch: 0.31, decay: 0.38, transient: 0.58, noise: 0.08, tone: 0.42 });
  const fieldNoise = tuneSound(place(makeSound("drum", 1, radarGen.id), "factory-field-noise", 2, 0, "DRUM · Radar Tick"), { drumChannel: "03", amp: 0.08, basePitch: 0.7, decay: 0.16, transient: 0.68, snap: 0.58, noise: 0.64, bodyTone: 0.22, tone: 0.72, pan: -0.18 });
  const fieldBass = tuneSound(place(makeSound("tonal", 0, gearGen.id), "factory-field-bass", 2, 2, "SYNTH · Gear Bass"), { reception: "mono", amp: 0.09, waveform: 0.22, coarseTune: -12, cutoff: 0.38, resonance: 0.2, glide: 0.08 });
  const fieldBell = tuneSound(place(makeSound("tonal", 1, markovGen.id), "factory-field-bell", 2, 4, "SYNTH · Markov Bell"), { reception: "mono", amp: 0.075, waveform: 0.66, coarseTune: 0, attack: 0.015, decay: 0.42, sustain: 0.35, release: 0.58, cutoff: 0.68, resonance: 0.28, modDepth: 0.22, modRate: 0.34, pan: 0.2 });

  return [
    { name: "Example 01 · Basic Pulse", patch: patchShell([basicGen, basicKick, basicSnare, basicBass], 124) },
    { name: "Example 02 · Dual Generators", patch: patchShell([lowGen, dualKick, dualSnare, highGen, dualHatClosed, dualHatOpen, dualPerc], 124) },
    { name: "Example 03 · Experimental Field", patch: patchShell([radarGen, fieldNoise, gearGen, fieldKick, fieldBass, markovGen, fieldBell], 118) },
  ];
}

export function factoryExamplePresets(): PresetRecord[] {
  return factoryExamplePatches().map((example, idx) => ({
    id: `factory-example-${String(idx + 1).padStart(2, "0")}`,
    name: example.name,
    patch: example.patch,
    createdAt: FACTORY_CREATED_AT,
    updatedAt: FACTORY_CREATED_AT,
    source: "factory",
  }));
}

export function firstFactoryExamplePatch(): Patch {
  return structuredClone(factoryExamplePatches()[0].patch);
}

export function restoreMissingFactoryExamples(session: PresetSession): PresetSession {
  const existingIds = new Set(session.presets.map((preset) => preset.id));
  const missing = factoryExamplePresets().filter((preset) => !existingIds.has(preset.id));
  if (!missing.length) {
    return {
      ...session,
      selectedPresetId: session.presets.some((preset) => preset.id === session.selectedPresetId)
        ? session.selectedPresetId
        : session.presets[0]?.id ?? factoryExamplePresets()[0].id,
    };
  }

  const presets = [...session.presets, ...missing];
  return {
    ...session,
    selectedPresetId: presets.some((preset) => preset.id === session.selectedPresetId)
      ? session.selectedPresetId
      : presets[0].id,
    presets,
  };
}

export function resetPresetSessionToFactoryExamples(): PresetSession {
  return defaultPresetSession();
}

function withMissingFactoryExamples(presets: PresetRecord[]): PresetRecord[] {
  return restoreMissingFactoryExamples({
    version: PRESET_EXPORT_VERSION,
    selectedPresetId: presets[0]?.id ?? factoryExamplePresets()[0].id,
    presets,
  }).presets;
}

export function defaultPresetSession(): PresetSession {
  const presets = factoryExamplePresets();

  return {
    version: PRESET_EXPORT_VERSION,
    selectedPresetId: presets[0].id,
    presets,
  };
}

function migrateLegacyBankSession(): PresetSession | null {
  const legacy = loadLegacyBankState();
  if (!legacy) return null;

  const now = Date.now();
  const presets = legacy.banks.slice(0, BANK_COUNT).map((patch, idx) => ({
    id: uid("preset"),
    name: `Bank ${idx + 1}`,
    patch: migratePatch(patch),
    createdAt: now,
    updatedAt: now,
  }));

  if (!presets.length) return null;

  return {
    version: PRESET_EXPORT_VERSION,
    selectedPresetId: presets[Math.min(legacy.bank, presets.length - 1)].id,
    presets: withMissingFactoryExamples(presets),
  };
}

export function loadPresetSession(): PresetSession {
  const raw = localStorage.getItem(PRESET_STORAGE_KEY);
  if (raw) {
    const parsed = safeParseJSON<any>(raw);
    if (parsed && Array.isArray(parsed.presets)) {
      const presets = parsed.presets
        .map((p: any, idx: number) => normalizePreset(p, `Preset ${idx + 1}`))
        .filter((p: PresetRecord | null): p is PresetRecord => Boolean(p));

      if (presets.length) {
        const selectedPresetId =
          typeof parsed.selectedPresetId === "string" && presets.some((p: PresetRecord) => p.id === parsed.selectedPresetId)
            ? parsed.selectedPresetId
            : presets[0].id;

        return {
          version: PRESET_EXPORT_VERSION,
          selectedPresetId,
          presets: withMissingFactoryExamples(presets),
        };
      }
    }
  }

  return migrateLegacyBankSession() ?? defaultPresetSession();
}

export function savePresetSession(session: PresetSession) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(session));
}

export function sanitizePresetName(name: string, fallback: string) {
  const cleaned = name.replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

export function makePresetExportPayload(session: PresetSession): PresetExportPayload {
  return {
    version: PRESET_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    selectedPresetId: session.selectedPresetId,
    presets: session.presets,
  };
}

export function isFactoryPreset(preset: PresetRecord): boolean {
  return preset.source === "factory";
}

export function makeSelectedPresetExportPayload(session: PresetSession, presetIds: Iterable<string>): PresetExportPayload | null {
  const selectedIds = new Set(presetIds);
  const presets = session.presets.filter((preset) => selectedIds.has(preset.id));
  if (!presets.length) return null;

  return {
    version: PRESET_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    selectedPresetId: presets.some((preset) => preset.id === session.selectedPresetId) ? session.selectedPresetId : presets[0].id,
    presets,
  };
}

export type DeleteSelectedPresetsResult = {
  session: PresetSession;
  deletedCount: number;
  protectedCount: number;
};

export function deleteSelectedUserPresets(session: PresetSession, presetIds: Iterable<string>): DeleteSelectedPresetsResult {
  const selectedIds = new Set(presetIds);
  if (!selectedIds.size) return { session, deletedCount: 0, protectedCount: 0 };

  const deletedIds = new Set<string>();
  let protectedCount = 0;
  const remaining = session.presets.filter((preset) => {
    if (!selectedIds.has(preset.id)) return true;
    if (isFactoryPreset(preset)) {
      protectedCount += 1;
      return true;
    }
    deletedIds.add(preset.id);
    return false;
  });

  if (!deletedIds.size) return { session, deletedCount: 0, protectedCount };

  const restored = restoreMissingFactoryExamples({
    ...session,
    presets: remaining,
    selectedPresetId: remaining.some((preset) => preset.id === session.selectedPresetId)
      ? session.selectedPresetId
      : remaining[0]?.id ?? factoryExamplePresets()[0].id,
  });

  return {
    session: restored,
    deletedCount: deletedIds.size,
    protectedCount,
  };
}

export function makeSinglePresetExportPayload(preset: PresetRecord): SinglePresetExportPayload {
  return {
    version: PRESET_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    preset,
  };
}

export function parsePresetImportPayload(raw: string): PresetSession | null {
  const parsed = safeParseJSON<any>(raw);
  if (!parsed || typeof parsed !== "object") return null;

  if (Array.isArray(parsed.presets)) {
    const presets = parsed.presets
      .map((p: any, idx: number) => normalizePreset(p, `Imported Preset ${idx + 1}`))
      .filter((p: PresetRecord | null): p is PresetRecord => Boolean(p));

    if (!presets.length) return null;

    const selectedPresetId =
      typeof parsed.selectedPresetId === "string" && presets.some((p: PresetRecord) => p.id === parsed.selectedPresetId)
        ? parsed.selectedPresetId
        : presets[0].id;

    return {
      version: PRESET_EXPORT_VERSION,
      selectedPresetId,
      presets,
    };
  }

  const single = normalizePreset(parsed.preset ?? parsed, "Imported Preset");
  if (!single) return null;

  return {
    version: PRESET_EXPORT_VERSION,
    selectedPresetId: single.id,
    presets: [single],
  };
}

export type { PresetRecord };
