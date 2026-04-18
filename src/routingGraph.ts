import type { Connection, Module, Patch, SoundModule } from "./patch.ts";

export type RouteDomain = "event" | "modulation" | "audio";

export type PatchRoute = {
  id: string;
  domain: RouteDomain;
  from: { moduleId: string; port: string };
  to: { type: "module" | "bus" | "master"; id?: string; port?: string };
  enabled: boolean;
  parameter?: string;
  lane?: string;
  gain?: number;
};

export type CompiledRouting = {
  routes: PatchRoute[];
  eventSourceBySoundId: Map<string, string>;
  triggerTargets: Map<string, string[]>;
  modulationIncomingByTarget: Map<string, Array<{ parameter: string; sourceId: string }>>;
  audioConnections: Connection[];
};

function isSoundModule(module: Module): module is SoundModule {
  return module.type === "drum" || module.type === "tonal";
}

function normalizeRoute(raw: unknown): PatchRoute | null {
  if (!raw || typeof raw !== "object") return null;
  const route = raw as Partial<PatchRoute>;
  if (route.domain !== "event" && route.domain !== "modulation" && route.domain !== "audio") return null;
  if (!route.from || typeof route.from.moduleId !== "string" || !route.from.moduleId.trim()) return null;
  const fromPort = typeof route.from.port === "string" && route.from.port.trim()
    ? route.from.port
    : route.domain === "audio" ? "main" : "out";
  if (!route.to || (route.to.type !== "module" && route.to.type !== "bus" && route.to.type !== "master")) return null;
  const toId = typeof route.to.id === "string" ? route.to.id : undefined;
  if (route.to.type !== "master" && !toId) return null;
  const toPort = typeof route.to.port === "string" && route.to.port.trim()
    ? route.to.port
    : route.domain === "audio" ? "in" : "in";

  return {
    id: typeof route.id === "string" && route.id.trim()
      ? route.id
      : `${route.domain}:${route.from.moduleId}:${fromPort}:${route.to.type}:${toId ?? "master"}:${toPort}`,
    domain: route.domain,
    from: { moduleId: route.from.moduleId, port: fromPort },
    to: { type: route.to.type, id: toId, port: toPort },
    enabled: route.enabled !== false,
    parameter: typeof route.parameter === "string" && route.parameter.trim() ? route.parameter : undefined,
    lane: typeof route.lane === "string" && route.lane.trim() ? route.lane : undefined,
    gain: typeof route.gain === "number" ? route.gain : undefined,
  };
}

function routeIdentity(route: PatchRoute) {
  return `${route.domain}|${route.from.moduleId}|${route.from.port}|${route.to.type}|${route.to.id ?? ""}|${route.to.port ?? ""}|${route.parameter ?? ""}|${route.lane ?? ""}`;
}

/**
 * Transitional canonical route synthesis.
 * - route records are treated as patch-owned canonical routing data.
 * - triggerSource/modulations/connections remain compatibility source material.
 */
export function normalizePatchRoutes(patch: Pick<Patch, "modules" | "connections"> & { routes?: unknown }): PatchRoute[] {
  const modulesById = new Map(patch.modules.map((m) => [m.id, m]));
  const dedup = new Map<string, PatchRoute>();

  const include = (route: PatchRoute) => {
    const identity = routeIdentity(route);
    if (!dedup.has(identity)) dedup.set(identity, route);
  };

  if (Array.isArray(patch.routes)) {
    for (const raw of patch.routes) {
      const route = normalizeRoute(raw);
      if (!route || !route.enabled) continue;
      if (!modulesById.has(route.from.moduleId)) continue;
      if (route.to.type === "module" && (!route.to.id || !modulesById.has(route.to.id))) continue;
      include(route);
    }
  }

  for (const module of patch.modules) {
    if (!isSoundModule(module) || !module.triggerSource) continue;
    const trigger = modulesById.get(module.triggerSource);
    if (!trigger || trigger.type !== "trigger") continue;
    include({
      id: `event:${trigger.id}:${module.id}`,
      domain: "event",
      from: { moduleId: trigger.id, port: "trigger-out" },
      to: { type: "module", id: module.id, port: "trigger-in" },
      enabled: true,
    });
  }

  for (const module of patch.modules) {
    const modulations = "modulations" in module && module.modulations && typeof module.modulations === "object"
      ? module.modulations
      : {};
    const entries = Object.entries(modulations);
    for (const [parameter, sourceId] of entries) {
      if (!sourceId || typeof sourceId !== "string") continue;
      const source = modulesById.get(sourceId);
      if (!source || source.type !== "control") continue;
      include({
        id: `mod:${sourceId}:${module.id}:${parameter}`,
        domain: "modulation",
        from: { moduleId: sourceId, port: "cv-out" },
        to: { type: "module", id: module.id, port: "cv-in" },
        enabled: true,
        parameter,
      });
    }
  }

  for (const connection of patch.connections) {
    if (!connection.enabled) continue;
    include({
      id: `audio:${connection.id}`,
      domain: "audio",
      from: { moduleId: connection.fromModuleId, port: connection.fromPort },
      to: { type: connection.to.type, id: connection.to.id, port: connection.to.port },
      enabled: true,
      gain: connection.gain,
    });
  }

  return [...dedup.values()];
}

export function compileRoutingGraph(patch: Pick<Patch, "modules" | "connections"> & { routes?: unknown }): CompiledRouting {
  const routes = normalizePatchRoutes(patch);
  const modulesById = new Map(patch.modules.map((m) => [m.id, m]));

  const eventSourceBySoundId = new Map<string, string>();
  const triggerTargets = new Map<string, string[]>();
  const modulationIncomingByTarget = new Map<string, Array<{ parameter: string; sourceId: string }>>();
  const audioConnections: Connection[] = [];

  for (const route of routes) {
    if (route.domain === "event") {
      if (route.to.type !== "module" || !route.to.id) continue;
      const source = modulesById.get(route.from.moduleId);
      const target = modulesById.get(route.to.id);
      if (!source || source.type !== "trigger" || !target || !isSoundModule(target)) continue;
      if (!eventSourceBySoundId.has(target.id)) eventSourceBySoundId.set(target.id, source.id);
      const targets = triggerTargets.get(source.id) ?? [];
      if (!targets.includes(target.id)) targets.push(target.id);
      triggerTargets.set(source.id, targets);
      continue;
    }

    if (route.domain === "modulation") {
      if (route.to.type !== "module" || !route.to.id || !route.parameter) continue;
      const source = modulesById.get(route.from.moduleId);
      const target = modulesById.get(route.to.id);
      if (!source || source.type !== "control" || !target) continue;
      const incoming = modulationIncomingByTarget.get(target.id) ?? [];
      incoming.push({ parameter: route.parameter, sourceId: source.id });
      modulationIncomingByTarget.set(target.id, incoming);
      continue;
    }

    audioConnections.push({
      id: route.id,
      fromModuleId: route.from.moduleId,
      fromPort: route.from.port,
      to: { type: route.to.type, id: route.to.id, port: route.to.port },
      gain: typeof route.gain === "number" ? route.gain : 1,
      enabled: route.enabled !== false,
    });
  }

  return {
    routes,
    eventSourceBySoundId,
    triggerTargets,
    modulationIncomingByTarget,
    audioConnections,
  };
}
