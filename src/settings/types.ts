// src/settings/types.ts

export type AppSettings = {
  version: number
  ui: {
  hideWelcome: boolean
  experimental: boolean
  customCss: string
  theme: "dark" | "light"
  reduceMotion: boolean
  }

  audio: {
    masterGain: number
    limiterEnabled: boolean
  }
  data: {
    autosave: boolean
  }
  ux: {
    tooltips: boolean
  }
}

export type SettingType =
  | "boolean"
  | "number"
  | "select"
  | "textarea"
  | "button"

export type SettingDef = {
  key: string              // "audio.masterGain"
  section: string          // "Audio"
  label: string
  type: SettingType
  default: any
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: any }[]
  help?: string
  advanced?: boolean
}
//
