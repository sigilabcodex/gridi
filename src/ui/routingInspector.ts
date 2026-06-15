import type { Module, Patch, SoundModule } from "../patch";
import { compileRoutingGraph, planStaleRoutingCleanup, validatePatchRouting, type RoutingValidationIssue, type RoutingValidationIssueCode, type StaleRoutingCleanupPlan } from "../routingGraph.ts";
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

function countIssues(issues: RoutingValidationIssue[]): RoutingHealthCounts {
  return issues.reduce<RoutingHealthCounts>((counts, issue) => {
    if (issue.code === "voice-missing-trigger-source" || issue.code === "voice-invalid-trigger-source") {
      counts.missingSources += 1;
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
  const compiled = compileRoutingGraph(patch);

  return patch.modules
    .filter(isSoundModule)
    .map((voice) => {
      const sourceId = compiled.eventSourceBySoundId.get(voice.id) ?? voice.triggerSource ?? null;
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
