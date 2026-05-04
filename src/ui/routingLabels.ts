import type { Module, Patch, SoundModule } from "../patch";

const UNASSIGNED_LABEL = "None";
const MISSING_PREFIX = "Missing";

function findModuleById(modules: Module[] | Map<string, Module>, moduleId: string): Module | null {
  if (Array.isArray(modules)) return modules.find((module) => module.id === moduleId) ?? null;
  return modules.get(moduleId) ?? null;
}

export function resolveTriggerSourceLabel(modules: Module[] | Map<string, Module>, triggerSource: string | null | undefined): string {
  if (!triggerSource) return UNASSIGNED_LABEL;
  const source = findModuleById(modules, triggerSource);
  if (!source || source.type !== "trigger") return `${MISSING_PREFIX} ${triggerSource.slice(-4).toUpperCase()}`;
  return source.name;
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
