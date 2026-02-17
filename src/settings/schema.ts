// src/settings/schema.ts

import type { SettingDef } from "./types"

export const SETTINGS_VERSION = 1

export const settingsSchema: SettingDef[] = [
  {
    key: "ui.theme",
    section: "General",
    label: "Theme",
    type: "select",
    default: "dark",
    options: [
      { label: "Dark", value: "dark" },
      { label: "Light", value: "light" }
    ]
  },
  {
    key: "ui.customCss",
    section: "General",
    label: "Custom CSS",
    type: "textarea",
    default: ""
  },
  {
    key: "ui.reduceMotion",
    section: "General",
    label: "Reduce Motion",
    type: "boolean",
    default: false
  },
  {
    key: "ui.experimental",
    section: "General",
    label: "Experimental mode",
    type: "boolean",
    default: false
  },
  {
    key: "ui.hideWelcome",
    section: "General",
    label: "Hide welcome screen on load",
    type: "boolean",
    default: false
  },
  {
    key: "audio.masterGain",
    section: "Audio",
    label: "Master Gain",
    type: "number",
    default: 1,
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: "audio.limiterEnabled",
    section: "Audio",
    label: "Limiter",
    type: "boolean",
    default: false
  },
  {
    key: "data.autosave",
    section: "Data",
    label: "Autosave",
    type: "boolean",
    default: true
  },
  {
    key: "ux.tooltips",
    section: "UX",
    label: "Tooltips",
    type: "boolean",
    default: true
  }
]
