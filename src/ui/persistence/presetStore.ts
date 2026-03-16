import type { Patch } from "../../patch.ts";
import { defaultPatch, migratePatch, uid } from "../../patch.ts";
import { BANK_COUNT, loadState as loadLegacyBankState } from "./bankState.ts";

export const PRESET_STORAGE_KEY = "gridi.presets.v0_33";
const PRESET_EXPORT_VERSION = "0.33";

type PresetRecord = {
  id: string;
  name: string;
  patch: Patch;
  createdAt: number;
  updatedAt: number;
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
  };
}

export function defaultPresetSession(): PresetSession {
  const now = Date.now();
  const preset: PresetRecord = {
    id: uid("preset"),
    name: "Starter Session",
    patch: defaultPatch(),
    createdAt: now,
    updatedAt: now,
  };

  return {
    version: PRESET_EXPORT_VERSION,
    selectedPresetId: preset.id,
    presets: [preset],
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
    presets,
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
          typeof parsed.selectedPresetId === "string" && presets.some((p) => p.id === parsed.selectedPresetId)
            ? parsed.selectedPresetId
            : presets[0].id;

        return {
          version: PRESET_EXPORT_VERSION,
          selectedPresetId,
          presets,
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
      typeof parsed.selectedPresetId === "string" && presets.some((p) => p.id === parsed.selectedPresetId)
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
