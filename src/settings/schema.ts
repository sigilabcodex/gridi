// src/settings/schema.ts

import type { SettingDef } from "./types"

export const SETTINGS_VERSION = 1

export const settingsSchema: SettingDef[] = [
  {
    key: "ui.theme",
    section: "Interaction",
    label: "Theme",
    type: "select",
    default: "dark",
    options: [
      { label: "Dark", value: "dark" },
      { label: "Light", value: "light" }
    ]
  },
  {
    key: "ui.controlStyle",
    section: "Interaction",
    label: "Control style",
    type: "select",
    default: "auto",
    options: [
      { label: "Auto", value: "auto" },
      { label: "Knobs", value: "knobs" },
      { label: "Sliders", value: "sliders" }
    ]
  },
  {
    key: "ui.customCss",
    section: "Developer / Advanced",
    label: "Custom CSS",
    type: "textarea",
    default: ""
  },
  {
    key: "ui.reduceMotion",
    section: "Interaction",
    label: "Reduce Motion",
    type: "boolean",
    default: false
  },
  {
    key: "ui.experimental",
    section: "Experimental",
    label: "Experimental mode",
    type: "boolean",
    default: false
  },
  {
    key: "ui.hideWelcome",
    section: "Global Behavior",
    label: "Hide welcome screen on load",
    type: "boolean",
    default: false
  },
  {
    key: "audio.masterGain",
    section: "Audio / MIDI",
    label: "Master Gain",
    type: "number",
    default: 1,
    min: 0,
    max: 2,
    step: 0.01
  },
  {
    key: "audio.limiterEnabled",
    section: "Audio / MIDI",
    label: "Limiter",
    type: "boolean",
    default: false
  },
  {
    key: "data.autosave",
    section: "Global Behavior",
    label: "Autosave",
    type: "boolean",
    default: true
  },
  {
    key: "ux.tooltips",
    section: "Interaction",
    label: "Show tooltips",
    type: "boolean",
    default: true
  }
]
