import { settingsSchema, SETTINGS_VERSION } from "./schema";
import type { AppSettings } from "./types";

const STORAGE_KEY = "gridi.settings";

type LooseObject = Record<string, unknown>;

function buildDefaults(): AppSettings {
  const base: LooseObject = { version: SETTINGS_VERSION };

  for (const def of settingsSchema) {
    const parts = def.key.split(".");
    let ref: LooseObject = base;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const maybe = ref[key];
      if (!maybe || typeof maybe !== "object") {
        ref[key] = {};
      }
      ref = ref[key] as LooseObject;
    }

    ref[parts[parts.length - 1]] = def.default;
  }

  return base as AppSettings;
}

function migrate(raw: unknown): AppSettings {
  const defaults = buildDefaults();

  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  return {
    ...defaults,
    ...(raw as Partial<AppSettings>),
    version: SETTINGS_VERSION,
  };
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaults();

    return migrate(JSON.parse(raw));
  } catch {
    return buildDefaults();
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
