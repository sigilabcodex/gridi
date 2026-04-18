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

function normalizeRawRoute(raw: unknown): PatchRoute | null {
  if (!raw || typeof raw !== "object") return null;
  const route = raw as Partial<PatchRoute>;
  if (route.domain !== "event" && route.domain !== "modulation" && route.domain !== "audio" && route.domain !== "midi") return null;

  const source = normalizeRouteEndpoint(route.source, "source");
  const target = normalizeRouteEndpoint(route.target, "target");
  if (!source || !target) return null;

  return {
    id: typeof route.id === "string" && route.id.trim() ? route.id : `${route.domain}:${Math.random().toString(36).slice(2)}`,
    domain: route.domain,
    source,
    target,
    enabled: route.enabled !== false,
    gain: typeof route.gain === "number" ? route.gain : undefined,
    metadata: route.metadata && typeof route.metadata === "object"
      ? {
        createdFrom: route.metadata.createdFrom,
        parameter: typeof route.metadata.parameter === "string" && route.metadata.parameter.trim() ? route.metadata.parameter : undefined,
        lane: typeof route.metadata.lane === "string" && route.metadata.lane.trim() ? route.metadata.lane : undefined,
      }
      : undefined,
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

  return `${route.domain}|${route.source.kind}|${sourceId}|${sourcePort}|${route.target.kind}|${targetId}|${targetPort}|${route.metadata?.parameter ?? ""}|${route.metadata?.lane ?? ""}`;
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
    if (!targetModule || !(targetModule.type === "trigger" || isSoundModule(targetModule))) return "modulation route target must be trigger or sound module";
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
