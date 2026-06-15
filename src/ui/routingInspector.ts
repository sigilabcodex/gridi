import type { Module, Patch, SoundModule } from "../patch";
import { planStaleRoutingCleanup, getModulationCapability, resolveParameterModulation, resolveVoiceEventRouting, validatePatchRouting, type RoutingValidationIssue, type RoutingValidationIssueCode, type StaleRoutingCleanupPlan } from "../routingGraph.ts";
import { resolveTriggerSourceLabelState, type RoutingLabelStatus } from "./routingLabels";

export type RoutingHealthCounts = {
  missingSources: number;
  invalidRoutes: number;
  staleConnections: number;
  staleModulations: number;
};

export type RoutingHealthSummary = {
  label: string;
  warningCount: number;
  counts: RoutingHealthCounts;
  issues: RoutingValidationIssue[];
  warnings: string[];
};

export type EventRoutingInspectorRow = {
  voiceId: string;
  voiceLabel: string;
  sourceId: string | null;
  sourceLabel: string;
  sourceStatus: RoutingLabelStatus;
  text: string;
};

export type ModulationRoutingInspectorRow = {
  targetId: string;
  targetLabel: string;
  parameter: string;
  parameterLabel: string;
  typedSourceId: string | null;
  typedSourceLabel: string;
  legacySourceId: string | null;
  legacySourceLabel: string;
  effectiveRuntimeSourceId: string | null;
  effectiveRuntimeSourceLabel: string;
  runtimeSupported: boolean;
  fallbackUsed: boolean;
  status: "none" | "typed-declaration" | "legacy-runtime" | "matching" | "conflict" | "unsupported" | "stale";
  text: string;
};

const INVALID_ROUTE_CODES = new Set<RoutingValidationIssueCode>([
  "route-invalid-record",
  "route-duplicate-id",
  "route-missing-source-module",
  "route-missing-target-module",
  "route-missing-source-bus",
  "route-missing-target-bus",
  "route-invalid-endpoint",
  "route-invalid-domain",
  "route-invalid-modulation-parameter",
]);

function isSoundModule(module: Module): module is SoundModule {
  return module.type === "drum" || module.type === "tonal";
}

function isModulationTarget(module: Module) {
  return module.type === "trigger" || module.type === "drum" || module.type === "tonal";
}

function modulationSourceLabel(modulesById: Map<string, Module>, sourceId: string | null) {
  if (!sourceId) return "None";
  const source = modulesById.get(sourceId);
  return source ? source.name : `Missing ${sourceId.slice(-4).toUpperCase()}`;
}

function modulationParametersForTarget(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }, target: Module) {
  const parameters = new Set<string>();
  if ("modulations" in target && target.modulations && typeof target.modulations === "object") {
    Object.keys(target.modulations).forEach((parameter) => parameters.add(parameter));
  }
  if (Array.isArray(patch.routes)) {
    for (const route of patch.routes) {
      if (!route || typeof route !== "object") continue;
      const candidate = route as { domain?: unknown; target?: unknown; metadata?: { parameter?: unknown } };
      if (candidate.domain !== "modulation") continue;
      const endpoint = candidate.target as { kind?: unknown; moduleId?: unknown } | undefined;
      if (endpoint?.kind !== "module" || endpoint.moduleId !== target.id) continue;
      const parameter = candidate.metadata?.parameter;
      if (typeof parameter === "string" && parameter.trim()) parameters.add(parameter);
    }
  }
  return [...parameters].sort();
}


function countIssues(issues: RoutingValidationIssue[]): RoutingHealthCounts {
  return issues.reduce<RoutingHealthCounts>((counts, issue) => {
    if (issue.code === "voice-missing-trigger-source" || issue.code === "voice-invalid-trigger-source") {
      counts.missingSources += 1;
    } else if (issue.code === "voice-ambiguous-primary-event-source") {
      counts.invalidRoutes += 1;
    } else if (INVALID_ROUTE_CODES.has(issue.code)) {
      counts.invalidRoutes += 1;
    } else if (issue.code.startsWith("connection-")) {
      counts.staleConnections += 1;
    } else if (issue.code.startsWith("modulation-")) {
      counts.staleModulations += 1;
    }
    return counts;
  }, { missingSources: 0, invalidRoutes: 0, staleConnections: 0, staleModulations: 0 });
}

export function buildRoutingHealthSummary(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }): RoutingHealthSummary {
  const validation = validatePatchRouting(patch);
  const warningCount = validation.issues.length;
  return {
    label: warningCount === 0 ? "Routing OK" : `${warningCount} routing warning${warningCount === 1 ? "" : "s"}`,
    warningCount,
    counts: countIssues(validation.issues),
    issues: validation.issues,
    warnings: validation.warnings,
  };
}

export function buildEventRoutingInspectorRows(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }): EventRoutingInspectorRow[] {
  const modulesById = new Map(patch.modules.map((module) => [module.id, module]));

  return patch.modules
    .filter(isSoundModule)
    .map((voice) => {
      const resolution = resolveVoiceEventRouting(patch, voice.id);
      if (resolution.state === "ambiguous") {
        const sourceLabel = "Ambiguous source";
        return {
          voiceId: voice.id,
          voiceLabel: voice.name,
          sourceId: resolution.schedulerEffectiveSourceId,
          sourceLabel,
          sourceStatus: "ambiguous",
          text: `${sourceLabel} → ${voice.name}`,
        };
      }

      const sourceId = resolution.schedulerEffectiveSourceId ?? resolution.legacyTriggerSourceId ?? null;
      const state = resolveTriggerSourceLabelState(modulesById, sourceId);
      const sourceLabel = state.status === "none"
        ? "Unassigned"
        : state.status === "missing"
          ? "Missing source"
          : state.label;
      return {
        voiceId: voice.id,
        voiceLabel: voice.name,
        sourceId,
        sourceLabel,
        sourceStatus: state.status,
        text: `${sourceLabel} → ${voice.name}`,
      };
    });
}


function cleanupLine(label: string, count: number) {
  return count > 0 ? `- ${label}: ${count}` : null;
}

export function buildStaleRoutingCleanupSummary(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }): StaleRoutingCleanupPlan {
  return planStaleRoutingCleanup(patch);
}

export function formatStaleRoutingCleanupConfirmation(plan: StaleRoutingCleanupPlan) {
  if (plan.totalRemovals === 0) return "No stale routing references were found.";
  const lines = [
    "Clean stale routing refs?",
    "",
    "This will remove only references whose module or bus no longer exists:",
    cleanupLine("legacy triggerSource refs", plan.legacyTriggerSources.length),
    cleanupLine("legacy modulation assignments", plan.legacyModulations.length),
    cleanupLine("legacy audio connections", plan.legacyConnections.length),
    cleanupLine("typed Patch.routes entries", plan.typedRoutes.length),
    "",
    "Valid legacy and typed routes will be preserved.",
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n");
}


export function buildModulationRoutingInspectorRows(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }): ModulationRoutingInspectorRow[] {
  const modulesById = new Map(patch.modules.map((module) => [module.id, module]));
  const rows: ModulationRoutingInspectorRow[] = [];

  for (const target of patch.modules) {
    if (!isModulationTarget(target)) continue;
    for (const parameter of modulationParametersForTarget(patch, target)) {
      const resolution = resolveParameterModulation(patch, target.id, parameter);
      const capability = getModulationCapability(target.type, parameter);
      const typedSourceLabel = modulationSourceLabel(modulesById, resolution.typedSourceId);
      const legacySourceLabel = modulationSourceLabel(modulesById, resolution.legacySourceId);
      const effectiveRuntimeSourceLabel = modulationSourceLabel(modulesById, resolution.effectiveRuntimeSourceId);
      const stale = resolution.state === "stale-typed" || resolution.state === "stale-legacy";
      const status: ModulationRoutingInspectorRow["status"] = stale
        ? "stale"
        : !resolution.runtimeSupported && (resolution.typedSourceId || resolution.legacySourceId)
          ? "unsupported"
          : resolution.typedAndLegacyConflict
            ? "conflict"
            : resolution.typedAndLegacyMatch
              ? "matching"
              : resolution.effectiveRuntimeSourceId
                ? "legacy-runtime"
                : resolution.typedSourceId
                  ? "typed-declaration"
                  : "none";
      const targetLabel = modulesById.get(target.id)?.name ?? target.id;
      const parameterLabel = capability?.parameter ?? parameter;
      rows.push({
        targetId: target.id,
        targetLabel,
        parameter,
        parameterLabel,
        typedSourceId: resolution.typedSourceId,
        typedSourceLabel,
        legacySourceId: resolution.legacySourceId,
        legacySourceLabel,
        effectiveRuntimeSourceId: resolution.effectiveRuntimeSourceId,
        effectiveRuntimeSourceLabel,
        runtimeSupported: resolution.runtimeSupported,
        fallbackUsed: resolution.fallbackUsed,
        status,
        text: `${targetLabel} · ${parameter}: typed ${typedSourceLabel}, legacy ${legacySourceLabel}, runtime ${effectiveRuntimeSourceLabel}${resolution.runtimeSupported ? "" : " (unsupported)"}`,
      });
    }
  }

  return rows;
}
