import { sampleControl01 } from "../engine/control";
import type { ControlModule, Patch } from "../patch";

export function resolveControlModule(patch: Patch, controlId: string | null | undefined): ControlModule | null {
  if (!controlId) return null;
  const found = patch.modules.find((module) => module.id === controlId);
  if (!found || found.type !== "control" || !found.enabled) return null;
  return found;
}

export function sampleControlValue01(patch: Patch, controlId: string | null | undefined, nowSec: number): number | null {
  const control = resolveControlModule(patch, controlId);
  if (!control) return null;
  return sampleControl01(control, nowSec);
}

export function applyCenteredModulation(base: number, modValue01: number | null, depth: number, min: number, max: number) {
  if (modValue01 == null) return base;
  const next = base + ((modValue01 - 0.5) * depth);
  return Math.min(max, Math.max(min, next));
}
