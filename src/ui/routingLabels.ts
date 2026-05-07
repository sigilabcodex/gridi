import type { Module, Patch, SoundModule } from "../patch";

const UNASSIGNED_LABEL = "None";
const MISSING_PREFIX = "Missing";

export type RoutingLabelStatus = "none" | "ok" | "missing";

export type RoutingLabelState = {
  label: string;
  status: RoutingLabelStatus;
  missingId?: string;
};

function findModuleById(modules: Module[] | Map<string, Module>, moduleId: string): Module | null {
  if (Array.isArray(modules)) return modules.find((module) => module.id === moduleId) ?? null;
  return modules.get(moduleId) ?? null;
}

export function resolveTriggerSourceLabelState(modules: Module[] | Map<string, Module>, triggerSource: string | null | undefined): RoutingLabelState {
  if (!triggerSource) return { label: UNASSIGNED_LABEL, status: "none" };
  const source = findModuleById(modules, triggerSource);
  if (!source || source.type !== "trigger") {
    return {
      label: `${MISSING_PREFIX} ${triggerSource.slice(-4).toUpperCase()}`,
      status: "missing",
      missingId: triggerSource,
    };
  }
  return { label: source.name, status: "ok" };
}

export function resolveTriggerSourceLabel(modules: Module[] | Map<string, Module>, triggerSource: string | null | undefined): string {
  return resolveTriggerSourceLabelState(modules, triggerSource).label;
}

export function resolveVoiceRoutingLabel(modules: Module[] | Map<string, Module>, voice: Pick<SoundModule, "triggerSource">): string {
  return resolveTriggerSourceLabel(modules, voice.triggerSource);
}

export function resolveTriggerFollowerLabel(modules: Module[] | Map<string, Module>, voice: Pick<SoundModule, "triggerSource">): string {
  return resolveVoiceRoutingLabel(modules, voice);
}

export function resolveVoiceSourceToken(modules: Module[] | Map<string, Module>, voice: Pick<SoundModule, "triggerSource">): string {
  return `SRC ${resolveVoiceRoutingLabel(modules, voice).toUpperCase()}`;
}

export function resolvePatchVoiceSourceToken(patch: Pick<Patch, "modules">, voice: Pick<SoundModule, "triggerSource">): string {
  return resolveVoiceSourceToken(patch.modules, voice);
}
