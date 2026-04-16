// src/ui/env.ts
let controlStylePreference: "auto" | "knobs" | "sliders" = "auto";

export function setControlStylePreference(pref: "auto" | "knobs" | "sliders") {
  controlStylePreference = pref;
}

export function prefersSliders(): boolean {
  if (controlStylePreference === "knobs") return false;
  if (controlStylePreference === "sliders") return true;

  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;

  // Auto mode favors compact knobs on mobile/touch surfaces.
  if (mm("(max-width: 760px)")) return false;
  if (mm("(pointer: coarse)")) return false;

  return false;
}

export function prefersMobileParameterEditor(): boolean {
  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;
  return mm("(max-width: 760px)") || mm("(pointer: coarse)");
}
