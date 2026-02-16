// src/ui/env.ts
export function prefersSliders(): boolean {
  const mm = (q: string) => window.matchMedia?.(q).matches ?? false;

  // pantallas chicas o "dedo"
  if (mm("(max-width: 720px)")) return true;
  if (mm("(pointer: coarse)")) return true;

  return false;
}
