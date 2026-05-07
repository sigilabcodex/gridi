import type { Connection, Module, Patch, SoundModule } from "./patch.ts";

export type RouteDomain = "event" | "modulation" | "audio" | "midi";

export type RouteEndpoint =
  | { kind: "module"; moduleId: string; port: string }
  | { kind: "bus"; busId: string; port?: string }
  | { kind: "master"; port?: string }
  | { kind: "external"; externalType: "midi"; portId?: string; channel?: number };

export type PatchRouteMetadata = {
  createdFrom?: "legacy-triggerSource" | "legacy-modulations" | "legacy-connections" | "ui";
  parameter?: string;
  lane?: string;
  midiBaseNote?: number;
  midiGateMs?: number;
  midiOutputName?: string;
};

export type PatchRoute = {
  id: string;
  domain: RouteDomain;
  source: RouteEndpoint;
  target: RouteEndpoint;
  enabled: boolean;
  gain?: number;
  metadata?: PatchRouteMetadata;
};

export type CompiledRouting = {
  routes: PatchRoute[];
  warnings: string[];
  eventSourceBySoundId: Map<string, string>;
  triggerTargets: Map<string, string[]>;
  modulationIncomingByTarget: Map<string, Array<{ parameter: string; sourceId: string }>>;
  audioConnections: Connection[];
};

export type RoutingValidationIssueCode =
  | "voice-missing-trigger-source"
  | "voice-invalid-trigger-source"
  | "route-invalid-record"
  | "route-duplicate-id"
  | "route-missing-source-module"
  | "route-missing-target-module"
  | "route-missing-source-bus"
  | "route-missing-target-bus"
  | "route-invalid-endpoint"
  | "route-invalid-domain"
  | "route-invalid-modulation-parameter"
  | "connection-missing-source-module"
  | "connection-missing-target-module"
  | "connection-missing-target-bus"
  | "modulation-missing-source-module"
  | "modulation-invalid-source-module"
  | "modulation-invalid-target-parameter";

export type RoutingValidationIssue = {
  code: RoutingValidationIssueCode;
  message: string;
  routeId?: string;
  moduleId?: string;
  connectionId?: string;
  parameter?: string;
  refId?: string;
};

export type RoutingValidationResult = {
  issues: RoutingValidationIssue[];
  warnings: string[];
};

type NormalizeRouteResult = {
  routes: PatchRoute[];
  warnings: string[];
  hasTypedByDomain: Partial<Record<RouteDomain, boolean>>;
};

function isSoundModule(module: Module): module is SoundModule {
  return module.type === "drum" || module.type === "tonal";
}

function normalizeRouteEndpoint(raw: unknown, side: "source" | "target"): RouteEndpoint | null {
  if (!raw || typeof raw !== "object") return null;
  const endpoint = raw as Partial<RouteEndpoint>;

  if (endpoint.kind === "module") {
    if (typeof endpoint.moduleId !== "string" || !endpoint.moduleId.trim()) return null;
    const fallbackPort = side === "source" ? "out" : "in";
    const port = typeof endpoint.port === "string" && endpoint.port.trim() ? endpoint.port : fallbackPort;
    return { kind: "module", moduleId: endpoint.moduleId, port };
  }

  if (endpoint.kind === "bus") {
    if (typeof endpoint.busId !== "string" || !endpoint.busId.trim()) return null;
    const port = typeof endpoint.port === "string" && endpoint.port.trim() ? endpoint.port : undefined;
    return { kind: "bus", busId: endpoint.busId, port };
  }

  if (endpoint.kind === "master") {
    const port = typeof endpoint.port === "string" && endpoint.port.trim() ? endpoint.port : undefined;
    return { kind: "master", port };
  }

  if (endpoint.kind === "external") {
    const externalType = endpoint.externalType;
    if (externalType !== "midi") return null;
    const portId = typeof endpoint.portId === "string" && endpoint.portId.trim() ? endpoint.portId : undefined;
    const channel = typeof endpoint.channel === "number" ? endpoint.channel : undefined;
    return {
      kind: "external",
      externalType,
      portId,
      channel: typeof channel === "number" && channel >= 1 && channel <= 16 ? channel : undefined,
    };
  }

  return null;
}

function endpointIdentity(endpoint: RouteEndpoint) {
  if (endpoint.kind === "module") return `module:${endpoint.moduleId}:${endpoint.port}`;
  if (endpoint.kind === "bus") return `bus:${endpoint.busId}:${endpoint.port ?? ""}`;
  if (endpoint.kind === "master") return `master:${endpoint.port ?? ""}`;
  return `external:${endpoint.externalType}:${endpoint.portId ?? ""}:${endpoint.channel ?? ""}`;
}

function fallbackRouteId(route: {
  domain: RouteDomain;
  source: RouteEndpoint;
  target: RouteEndpoint;
  enabled: boolean;
  gain?: number;
  metadata?: PatchRouteMetadata;
}) {
  return [
    route.domain,
    endpointIdentity(route.source),
    endpointIdentity(route.target),
    route.enabled ? "1" : "0",
    typeof route.gain === "number" ? String(route.gain) : "",
    route.metadata?.parameter ?? "",
    route.metadata?.lane ?? "",
    route.metadata?.createdFrom ?? "",
    route.metadata?.midiBaseNote ?? "",
    route.metadata?.midiGateMs ?? "",
    route.metadata?.midiOutputName ?? "",
  ].join("|");
}

function normalizeRawRoute(raw: unknown): PatchRoute | null {
  if (!raw || typeof raw !== "object") return null;
  const route = raw as Partial<PatchRoute>;
  if (route.domain !== "event" && route.domain !== "modulation" && route.domain !== "audio" && route.domain !== "midi") return null;

  const source = normalizeRouteEndpoint(route.source, "source");
  const target = normalizeRouteEndpoint(route.target, "target");
  if (!source || !target) return null;

  const metadata = route.metadata && typeof route.metadata === "object"
    ? {
      createdFrom: route.metadata.createdFrom,
      parameter: typeof route.metadata.parameter === "string" && route.metadata.parameter.trim() ? route.metadata.parameter : undefined,
      lane: typeof route.metadata.lane === "string" && route.metadata.lane.trim() ? route.metadata.lane : undefined,
      midiBaseNote: typeof route.metadata.midiBaseNote === "number" && Number.isFinite(route.metadata.midiBaseNote) ? Math.max(0, Math.min(127, Math.round(route.metadata.midiBaseNote))) : undefined,
      midiGateMs: typeof route.metadata.midiGateMs === "number" && Number.isFinite(route.metadata.midiGateMs) ? Math.max(1, Math.min(10000, Math.round(route.metadata.midiGateMs))) : undefined,
      midiOutputName: typeof route.metadata.midiOutputName === "string" && route.metadata.midiOutputName.trim() ? route.metadata.midiOutputName : undefined,
    }
    : undefined;

  const enabled = route.enabled !== false;
  const gain = typeof route.gain === "number" ? route.gain : undefined;
  const id = typeof route.id === "string" && route.id.trim()
    ? route.id
    : fallbackRouteId({
      domain: route.domain,
      source,
      target,
      enabled,
      gain,
      metadata,
    });

  return {
    id,
    domain: route.domain,
    source,
    target,
    enabled,
    gain,
    metadata,
  };
}

function routeIdentity(route: PatchRoute) {
  const sourceId = route.source.kind === "module"
    ? route.source.moduleId
    : route.source.kind === "bus"
      ? route.source.busId
      : route.source.kind === "external"
        ? `${route.source.externalType}:${route.source.portId ?? ""}:${route.source.channel ?? ""}`
        : "master";
  const sourcePort = "port" in route.source ? route.source.port ?? "" : "";

  const targetId = route.target.kind === "module"
    ? route.target.moduleId
    : route.target.kind === "bus"
      ? route.target.busId
      : route.target.kind === "external"
        ? `${route.target.externalType}:${route.target.portId ?? ""}:${route.target.channel ?? ""}`
        : "master";
  const targetPort = "port" in route.target ? route.target.port ?? "" : "";

  return `${route.domain}|${route.source.kind}|${sourceId}|${sourcePort}|${route.target.kind}|${targetId}|${targetPort}|${route.metadata?.parameter ?? ""}|${route.metadata?.lane ?? ""}|${route.metadata?.midiBaseNote ?? ""}|${route.metadata?.midiGateMs ?? ""}|${route.metadata?.midiOutputName ?? ""}`;
}

function validateRoute(
  route: PatchRoute,
  patch: Pick<Patch, "modules" | "buses">,
  knownIds: Set<string>,
): string | null {
  if (knownIds.has(route.id)) return `duplicate route id: ${route.id}`;
  knownIds.add(route.id);

  const modulesById = new Map(patch.modules.map((m) => [m.id, m]));
  const busesById = new Set((patch.buses ?? []).map((b) => b.id));

  const resolveEndpointModule = (endpoint: RouteEndpoint): Module | null => {
    if (endpoint.kind !== "module") return null;
    return modulesById.get(endpoint.moduleId) ?? null;
  };

  if (route.source.kind === "module" && !modulesById.has(route.source.moduleId)) return `missing source module: ${route.source.moduleId}`;
  if (route.target.kind === "module" && !modulesById.has(route.target.moduleId)) return `missing target module: ${route.target.moduleId}`;
  if (route.source.kind === "bus" && !busesById.has(route.source.busId)) return `missing source bus: ${route.source.busId}`;
  if (route.target.kind === "bus" && !busesById.has(route.target.busId)) return `missing target bus: ${route.target.busId}`;

  const sourceModule = resolveEndpointModule(route.source);
  const targetModule = resolveEndpointModule(route.target);

  if (route.domain === "event") {
    if (route.source.kind !== "module" || route.target.kind !== "module") return "event routes must use module->module endpoints";
    if (!sourceModule || sourceModule.type !== "trigger") return "event route source must be trigger module";
    if (!targetModule || !isSoundModule(targetModule)) return "event route target must be sound module";
    return null;
  }

  if (route.domain === "modulation") {
    if (route.source.kind !== "module" || route.target.kind !== "module") return "modulation routes must use module->module endpoints";
    if (!sourceModule || sourceModule.type !== "control") return "modulation route source must be control module";
    if (!targetModule || !(targetModule.type === "trigger" || targetModule.type === "control" || targetModule.type === "visual" || isSoundModule(targetModule))) {
      return "modulation route target must be trigger|sound|control|visual module";
    }
    if (sourceModule.id === targetModule.id) return "modulation route cannot target source module (self-modulation blocked)";
    if (!route.metadata?.parameter) return "modulation route requires metadata.parameter";
    return null;
  }

  if (route.domain === "audio") {
    if (route.source.kind !== "module") return "audio route source must be module";
    if (!(route.target.kind === "module" || route.target.kind === "bus" || route.target.kind === "master")) {
      return "audio route target must be module|bus|master";
    }
    return null;
  }

  if (route.domain === "midi") {
    return null;
  }

  return "invalid route domain";
}


function moduleHasNumericParameter(module: Module, parameter: string): boolean {
  return Object.prototype.hasOwnProperty.call(module, parameter) && typeof (module as unknown as Record<string, unknown>)[parameter] === "number";
}

function routeValidationIssueFromError(route: PatchRoute, error: string): RoutingValidationIssue {
  if (error.startsWith("duplicate route id:")) {
    return { code: "route-duplicate-id", message: `Route ${route.id} has a duplicate id`, routeId: route.id };
  }
  if (error.startsWith("missing source module:")) {
    const refId = error.slice("missing source module:".length).trim();
    return { code: "route-missing-source-module", message: `Route ${route.id} references missing source module ${refId}`, routeId: route.id, refId };
  }
  if (error.startsWith("missing target module:")) {
    const refId = error.slice("missing target module:".length).trim();
    return { code: "route-missing-target-module", message: `Route ${route.id} references missing target module ${refId}`, routeId: route.id, refId };
  }
  if (error.startsWith("missing source bus:")) {
    const refId = error.slice("missing source bus:".length).trim();
    return { code: "route-missing-source-bus", message: `Route ${route.id} references missing source bus ${refId}`, routeId: route.id, refId };
  }
  if (error.startsWith("missing target bus:")) {
    const refId = error.slice("missing target bus:".length).trim();
    return { code: "route-missing-target-bus", message: `Route ${route.id} references missing target bus ${refId}`, routeId: route.id, refId };
  }
  if (error === "invalid route domain") {
    return { code: "route-invalid-domain", message: `Route ${route.id} has an invalid domain`, routeId: route.id };
  }
  return { code: "route-invalid-endpoint", message: `Route ${route.id} is invalid: ${error}`, routeId: route.id };
}

export function validatePatchRouting(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }): RoutingValidationResult {
  const modulesById = new Map(patch.modules.map((module) => [module.id, module]));
  const busesById = new Set((patch.buses ?? []).map((bus) => bus.id));
  const routeIds = new Set<string>();
  const issues: RoutingValidationIssue[] = [];

  const push = (issue: RoutingValidationIssue) => issues.push(issue);

  for (const module of patch.modules) {
    if (isSoundModule(module) && module.triggerSource) {
      const source = modulesById.get(module.triggerSource);
      if (!source) {
        push({
          code: "voice-missing-trigger-source",
          message: `Voice ${module.id} references missing trigger source ${module.triggerSource}`,
          moduleId: module.id,
          refId: module.triggerSource,
        });
      } else if (source.type !== "trigger") {
        push({
          code: "voice-invalid-trigger-source",
          message: `Voice ${module.id} trigger source ${module.triggerSource} is not a generator`,
          moduleId: module.id,
          refId: module.triggerSource,
        });
      }
    }

    const modulations = "modulations" in module && module.modulations && typeof module.modulations === "object"
      ? module.modulations
      : {};
    for (const [parameter, sourceId] of Object.entries(modulations)) {
      if (!sourceId || typeof sourceId !== "string") continue;
      const source = modulesById.get(sourceId);
      if (!source) {
        push({
          code: "modulation-missing-source-module",
          message: `Module ${module.id} parameter ${parameter} references missing modulation source ${sourceId}`,
          moduleId: module.id,
          parameter,
          refId: sourceId,
        });
      } else if (source.type !== "control") {
        push({
          code: "modulation-invalid-source-module",
          message: `Module ${module.id} parameter ${parameter} modulation source ${sourceId} is not a controller`,
          moduleId: module.id,
          parameter,
          refId: sourceId,
        });
      }
      if (!moduleHasNumericParameter(module, parameter)) {
        push({
          code: "modulation-invalid-target-parameter",
          message: `Module ${module.id} has unknown modulation target parameter ${parameter}`,
          moduleId: module.id,
          parameter,
          refId: sourceId,
        });
      }
    }
  }

  if (Array.isArray(patch.routes)) {
    for (const raw of patch.routes) {
      const route = normalizeRawRoute(raw);
      if (!route) {
        push({ code: "route-invalid-record", message: "Patch contains an invalid typed route record" });
        continue;
      }
      const error = validateRoute(route, patch, routeIds);
      if (error) {
        push(routeValidationIssueFromError(route, error));
        continue;
      }
      if (route.domain === "modulation") {
        const target = route.target.kind === "module" ? modulesById.get(route.target.moduleId) : null;
        const parameter = route.metadata?.parameter;
        if (target && parameter && !moduleHasNumericParameter(target, parameter)) {
          push({
            code: "route-invalid-modulation-parameter",
            message: `Route ${route.id} targets unknown modulation parameter ${parameter} on ${target.id}`,
            routeId: route.id,
            moduleId: target.id,
            parameter,
          });
        }
      }
    }
  }

  for (const connection of patch.connections) {
    if (!modulesById.has(connection.fromModuleId)) {
      push({
        code: "connection-missing-source-module",
        message: `Connection ${connection.id} references missing source module ${connection.fromModuleId}`,
        connectionId: connection.id,
        refId: connection.fromModuleId,
      });
    }
    if (connection.to.type === "module" && connection.to.id && !modulesById.has(connection.to.id)) {
      push({
        code: "connection-missing-target-module",
        message: `Connection ${connection.id} references missing target module ${connection.to.id}`,
        connectionId: connection.id,
        refId: connection.to.id,
      });
    }
    if (connection.to.type === "bus" && connection.to.id && !busesById.has(connection.to.id)) {
      push({
        code: "connection-missing-target-bus",
        message: `Connection ${connection.id} references missing target bus ${connection.to.id}`,
        connectionId: connection.id,
        refId: connection.to.id,
      });
    }
  }

  return { issues, warnings: issues.map((issue) => issue.message) };
}

function makeLegacyEventRoute(sourceId: string, targetId: string): PatchRoute {
  return {
    id: `event:${sourceId}:${targetId}`,
    domain: "event",
    source: { kind: "module", moduleId: sourceId, port: "trigger-out" },
    target: { kind: "module", moduleId: targetId, port: "trigger-in" },
    enabled: true,
    metadata: { createdFrom: "legacy-triggerSource" },
  };
}

function makeLegacyModulationRoute(sourceId: string, targetId: string, parameter: string): PatchRoute {
  return {
    id: `mod:${sourceId}:${targetId}:${parameter}`,
    domain: "modulation",
    source: { kind: "module", moduleId: sourceId, port: "cv-out" },
    target: { kind: "module", moduleId: targetId, port: "cv-in" },
    enabled: true,
    metadata: { createdFrom: "legacy-modulations", parameter },
  };
}

function makeLegacyAudioRoute(connection: Connection): PatchRoute {
  const target: RouteEndpoint = connection.to.type === "module" && connection.to.id
    ? { kind: "module", moduleId: connection.to.id, port: connection.to.port ?? "in" }
    : connection.to.type === "bus" && connection.to.id
      ? { kind: "bus", busId: connection.to.id, port: connection.to.port }
      : { kind: "master", port: connection.to.port };

  return {
    id: `audio:${connection.id}`,
    domain: "audio",
    source: { kind: "module", moduleId: connection.fromModuleId, port: connection.fromPort },
    target,
    enabled: true,
    gain: connection.gain,
    metadata: { createdFrom: "legacy-connections" },
  };
}

/**
 * Hybrid routing resolver policy:
 * - When valid typed routes exist for a domain, they are canonical for that domain.
 * - Otherwise, legacy structures are backfilled into typed routes for that domain.
 */
function normalizePatchRoutesInternal(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }): NormalizeRouteResult {
  const modulesById = new Map(patch.modules.map((m) => [m.id, m]));
  const dedup = new Map<string, PatchRoute>();
  const warnings: string[] = [];
  const hasTypedByDomain: Partial<Record<RouteDomain, boolean>> = {};
  const routeIds = new Set<string>();

  const include = (route: PatchRoute) => {
    const identity = routeIdentity(route);
    if (!dedup.has(identity)) dedup.set(identity, route);
  };

  if (Array.isArray(patch.routes)) {
    for (const raw of patch.routes) {
      const route = normalizeRawRoute(raw);
      if (!route) {
        warnings.push("ignored invalid typed route record");
        continue;
      }
      if (!route.enabled) continue;

      const error = validateRoute(route, patch, routeIds);
      if (error) {
        warnings.push(`ignored route ${route.id}: ${error}`);
        continue;
      }

      hasTypedByDomain[route.domain] = true;
      include(route);
    }
  }

  if (!hasTypedByDomain.event) {
    for (const module of patch.modules) {
      if (!isSoundModule(module) || !module.triggerSource) continue;
      const trigger = modulesById.get(module.triggerSource);
      if (!trigger || trigger.type !== "trigger") continue;
      include(makeLegacyEventRoute(trigger.id, module.id));
    }
  }

  if (!hasTypedByDomain.modulation) {
    for (const module of patch.modules) {
      const modulations = "modulations" in module && module.modulations && typeof module.modulations === "object"
        ? module.modulations
        : {};
      for (const [parameter, sourceId] of Object.entries(modulations)) {
        if (!sourceId || typeof sourceId !== "string") continue;
        const source = modulesById.get(sourceId);
        if (!source || source.type !== "control") continue;
        include(makeLegacyModulationRoute(sourceId, module.id, parameter));
      }
    }
  }

  if (!hasTypedByDomain.audio) {
    for (const connection of patch.connections) {
      if (!connection.enabled) continue;
      include(makeLegacyAudioRoute(connection));
    }
  }

  return { routes: [...dedup.values()], warnings, hasTypedByDomain };
}

export function normalizePatchRoutes(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }): PatchRoute[] {
  return normalizePatchRoutesInternal(patch).routes;
}

export function compileRoutingGraph(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }): CompiledRouting {
  const { routes, warnings } = normalizePatchRoutesInternal(patch);
  const modulesById = new Map(patch.modules.map((m) => [m.id, m]));

  const eventSourceBySoundId = new Map<string, string>();
  const triggerTargets = new Map<string, string[]>();
  const modulationIncomingByTarget = new Map<string, Array<{ parameter: string; sourceId: string }>>();
  const modulationOwnerByTargetParam = new Map<string, string>();
  const audioConnections: Connection[] = [];

  for (const route of routes) {
    if (route.domain === "event") {
      if (route.source.kind !== "module" || route.target.kind !== "module") continue;
      const source = modulesById.get(route.source.moduleId);
      const target = modulesById.get(route.target.moduleId);
      if (!source || source.type !== "trigger" || !target || !isSoundModule(target)) continue;
      if (!eventSourceBySoundId.has(target.id)) eventSourceBySoundId.set(target.id, source.id);
      const targets = triggerTargets.get(source.id) ?? [];
      if (!targets.includes(target.id)) targets.push(target.id);
      triggerTargets.set(source.id, targets);
      continue;
    }

    if (route.domain === "modulation") {
      if (route.source.kind !== "module" || route.target.kind !== "module") continue;
      const parameter = route.metadata?.parameter;
      if (!parameter) continue;
      const source = modulesById.get(route.source.moduleId);
      const target = modulesById.get(route.target.moduleId);
      if (!source || source.type !== "control" || !target) continue;
      if (source.id === target.id) {
        warnings.push(`ignored route ${route.id}: modulation route cannot target source module (self-modulation blocked)`);
        continue;
      }
      const claimKey = `${target.id}:${parameter}`;
      const existingOwner = modulationOwnerByTargetParam.get(claimKey);
      if (existingOwner && existingOwner !== source.id) {
        warnings.push(`ignored route ${route.id}: parameter "${parameter}" on ${target.id} already controlled by ${existingOwner}`);
        continue;
      }
      modulationOwnerByTargetParam.set(claimKey, source.id);
      const incoming = modulationIncomingByTarget.get(target.id) ?? [];
      incoming.push({ parameter, sourceId: source.id });
      modulationIncomingByTarget.set(target.id, incoming);
      continue;
    }

    if (route.domain === "audio") {
      if (route.source.kind !== "module") continue;
      let to: { type: "module" | "bus" | "master"; id?: string; port?: string };
      if (route.target.kind === "module") {
        to = { type: "module", id: route.target.moduleId, port: route.target.port ?? "in" };
      } else if (route.target.kind === "bus") {
        to = { type: "bus", id: route.target.busId, port: route.target.port ?? "in" };
      } else if (route.target.kind === "master") {
        to = { type: "master", port: route.target.port ?? "in" };
      } else {
        continue;
      }

      audioConnections.push({
        id: route.id,
        fromModuleId: route.source.moduleId,
        fromPort: route.source.port,
        to,
        gain: typeof route.gain === "number" ? route.gain : 1,
        enabled: route.enabled !== false,
      });
    }
  }

  return {
    routes,
    warnings,
    eventSourceBySoundId,
    triggerTargets,
    modulationIncomingByTarget,
    audioConnections,
  };
}
