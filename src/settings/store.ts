// src/settings/store.ts

import { settingsSchema, SETTINGS_VERSION } from "./schema"
import type { AppSettings } from "./types"

const STORAGE_KEY = "gridi.settings"

function buildDefaults(): AppSettings {
  const base: any = { version: SETTINGS_VERSION }

  for (const def of settingsSchema) {
    const parts = def.key.split(".")
    let ref = base

    for (let i = 0; i < parts.length - 1; i++) {
      if (!ref[parts[i]]) ref[parts[i]] = {}
      ref = ref[parts[i]]
    }

    ref[parts[parts.length - 1]] = def.default
  }

  return base as AppSettings
}

function migrate(raw: any): AppSettings {
  const defaults = buildDefaults()

  if (!raw || typeof raw !== "object") {
    return defaults
  }

  return {
    ...defaults,
    ...raw,
    version: SETTINGS_VERSION
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildDefaults()

    return migrate(JSON.parse(raw))
  } catch {
    return buildDefaults()
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
