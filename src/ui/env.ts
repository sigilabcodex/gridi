// src/ui/env.ts
let controlStylePreference: "auto" | "knobs" | "sliders" = "auto";

export function setControlStylePreference(pref: "auto" | "knobs" | "sliders") {
  controlStylePreference = pref;
}

export function prefersSliders(): boolean {
  if (controlStylePreference === "knobs") return false;
  if (controlStylePreference === "sliders") return true;

  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;

  // pantallas chicas o "dedo"
  if (mm("(max-width: 720px)")) return true;
  if (mm("(pointer: coarse)")) return true;

  return false;
}
