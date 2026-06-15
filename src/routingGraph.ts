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
  | "voice-ambiguous-primary-event-source"
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

export type StaleRoutingCleanupPlan = {
  legacyTriggerSources: Array<{ moduleId: string; refId: string }>;
  legacyModulations: Array<{ moduleId: string; parameter: string; refId: string }>;
  legacyConnections: Array<{ connectionId: string; refId: string; reason: "missing-source-module" | "missing-target-module" | "missing-target-bus" }>;
  typedRoutes: Array<{ routeIndex: number; routeId: string; refId: string; reason: "missing-source-module" | "missing-target-module" | "missing-source-bus" | "missing-target-bus" }>;
  totalRemovals: number;
};

export type RoutingCleanupConfirm = (plan: StaleRoutingCleanupPlan) => boolean;

export type VoiceEventRoutingState =
  | "legacy-only"
  | "typed-only"
  | "matching-hybrid"
  | "conflicting-hybrid"
  | "missing"
  | "stale"
  | "ambiguous";

export type VoiceEventRouteCandidate = {
  routeIndex: number;
  routeId: string;
  sourceId: string | null;
  enabled: boolean;
  inputRole: string;
  isPrimary: boolean;
  sourceExists: boolean;
  targetExists: boolean;
};

export type VoiceEventRoutingResolution = {
  voiceId: string;
  compiledCanonicalSourceId: string | null;
  legacyTriggerSourceId: string | null;
  schedulerEffectiveSourceId: string | null;
  typedEventRouteCandidates: VoiceEventRouteCandidate[];
  state: VoiceEventRoutingState;
};

export type ModulationRuntimeOwner = "scheduler" | "audio" | null;

export type ModulationRoutingState =
  | "none"
  | "legacy-only"
  | "typed-only"
  | "matching-hybrid"
  | "conflicting-hybrid"
  | "stale-typed"
  | "stale-legacy"
  | "unsupported";

export type ModulationRouteCandidate = {
  routeIndex: number;
  routeId: string;
  sourceId: string | null;
  enabled: boolean;
  sourceExists: boolean;
  targetExists: boolean;
};

export type ModulationRoutingResolution = {
  targetId: string;
  parameter: string;
  typedSourceId: string | null;
  legacySourceId: string | null;
  effectiveRuntimeSourceId: string | null;
  typedAndLegacyMatch: boolean;
  typedAndLegacyConflict: boolean;
  runtimeSupported: boolean;
  runtimeOwner: ModulationRuntimeOwner;
  fallbackUsed: boolean;
  typedCandidates: ModulationRouteCandidate[];
  state: ModulationRoutingState;
};

export type ModulationCapability = {
  moduleType: "trigger" | "drum" | "tonal";
  parameter: string;
  assignableInUi: boolean;
  representedInTypedRouting: boolean;
  visibleInInspector: boolean;
  consumedByRuntime: ModulationRuntimeOwner;
  knownLimitations: string;
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

function eventRouteInputRole(route: PatchRoute) {
  const metadata = route.metadata as (PatchRouteMetadata & { role?: unknown }) | undefined;
  const role = typeof metadata?.role === "string" && metadata.role.trim() ? metadata.role.trim() : "primary";
  return role;
}

function rawEventRouteInputRole(raw: unknown, route: PatchRoute) {
  if (!raw || typeof raw !== "object") return eventRouteInputRole(route);
  const rawMetadata = (raw as { metadata?: unknown }).metadata;
  if (!rawMetadata || typeof rawMetadata !== "object") return eventRouteInputRole(route);
  const role = (rawMetadata as { role?: unknown }).role;
  return typeof role === "string" && role.trim() ? role.trim() : eventRouteInputRole(route);
}


function isRawPrimaryEventRoute(raw: unknown, route: PatchRoute) {
  return route.domain === "event" && rawEventRouteInputRole(raw, route) === "primary";
}

function uniqueRouteId(base: string, routes: PatchRoute[]) {
  const ids = new Set(routes.map((route) => route.id));
  if (!ids.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}:${i}`;
    if (!ids.has(candidate)) return candidate;
  }
}

function makePrimaryEventRoute(sourceId: string, voiceId: string, existingRoutes: PatchRoute[]): PatchRoute {
  return {
    id: uniqueRouteId(`event:primary:${sourceId}:${voiceId}`, existingRoutes),
    domain: "event",
    source: { kind: "module", moduleId: sourceId, port: "trigger-out" },
    target: { kind: "module", moduleId: voiceId, port: "trigger-in" },
    enabled: true,
    metadata: { createdFrom: "ui" },
  };
}

export function resolveVoiceEventRouting(
  patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown },
  voiceId: string,
): VoiceEventRoutingResolution {
  const modulesById = new Map(patch.modules.map((module) => [module.id, module]));
  const triggerIds = new Set(patch.modules.filter((module) => module.type === "trigger").map((module) => module.id));
  const voice = modulesById.get(voiceId);
  const legacyTriggerSourceId = voice && isSoundModule(voice) ? voice.triggerSource ?? null : null;
  const typedEventRouteCandidates: VoiceEventRouteCandidate[] = [];

  if (Array.isArray(patch.routes)) {
    for (let routeIndex = 0; routeIndex < patch.routes.length; routeIndex += 1) {
      const route = normalizeRawRoute(patch.routes[routeIndex]);
      if (!route || route.domain !== "event") continue;
      if (route.target.kind !== "module" || route.target.moduleId !== voiceId) continue;
      const sourceId = route.source.kind === "module" ? route.source.moduleId : null;
      typedEventRouteCandidates.push({
        routeIndex,
        routeId: route.id,
        sourceId,
        enabled: route.enabled !== false,
        inputRole: rawEventRouteInputRole(patch.routes[routeIndex], route),
        isPrimary: isRawPrimaryEventRoute(patch.routes[routeIndex], route),
        sourceExists: !!sourceId && triggerIds.has(sourceId),
        targetExists: modulesById.has(voiceId),
      });
    }
  }

  const compiled = compileRoutingGraph(patch);
  const compiledCanonicalSourceId = compiled.eventSourceBySoundId.get(voiceId) ?? null;
  const activePrimaryCandidates = typedEventRouteCandidates.filter((candidate) => (
    candidate.enabled && candidate.isPrimary && candidate.sourceExists && candidate.targetExists
  ));
  const hasStaleReference = !!(legacyTriggerSourceId && !triggerIds.has(legacyTriggerSourceId))
    || typedEventRouteCandidates.some((candidate) => candidate.enabled && candidate.isPrimary && (!candidate.sourceExists || !candidate.targetExists));
  const legacyValid = !!(legacyTriggerSourceId && triggerIds.has(legacyTriggerSourceId));
  const typedSourceId = activePrimaryCandidates.length === 1 ? activePrimaryCandidates[0].sourceId : null;
  const schedulerCandidateId = compiledCanonicalSourceId ?? legacyTriggerSourceId;
  const schedulerEffectiveSourceId = schedulerCandidateId && triggerIds.has(schedulerCandidateId) ? schedulerCandidateId : null;

  let state: VoiceEventRoutingState;
  if (activePrimaryCandidates.length > 1) state = "ambiguous";
  else if (hasStaleReference) state = "stale";
  else if (typedSourceId && legacyValid) state = typedSourceId === legacyTriggerSourceId ? "matching-hybrid" : "conflicting-hybrid";
  else if (typedSourceId) state = "typed-only";
  else if (legacyValid) state = "legacy-only";
  else state = "missing";

  return {
    voiceId,
    compiledCanonicalSourceId,
    legacyTriggerSourceId,
    schedulerEffectiveSourceId,
    typedEventRouteCandidates,
    state,
  };
}

const MODULATION_UI_PARAMETERS: Record<"trigger" | "drum" | "tonal", string[]> = {
  trigger: ["density", "length", "subdiv", "drop", "determinism", "gravity", "weird", "accent", "euclidRot", "caRule", "caInit"],
  drum: ["attack", "decay", "amp", "basePitch", "tone", "bodyTone", "noise", "snap", "pitchEnvAmt", "pan", "stereoWidth", "panBias", "comp", "compThreshold", "compRatio", "boost"],
  tonal: ["attack", "decay", "sustain", "release", "amp", "cutoff", "resonance", "waveform", "modDepth", "modRate", "coarseTune", "fineTune", "glide", "pan"],
};

function modulationRuntimeOwner(module: Module | null | undefined, parameter: string): ModulationRuntimeOwner {
  if (!module) return null;
  if (module.type === "trigger" && parameter === "density") return "scheduler";
  if (module.type === "drum" && parameter === "basePitch") return "audio";
  if (module.type === "tonal" && parameter === "cutoff") return "audio";
  return null;
}

function typedModulationRouteTargets(route: PatchRoute, targetId: string, parameter: string) {
  return route.domain === "modulation"
    && route.target.kind === "module"
    && route.target.moduleId === targetId
    && route.metadata?.parameter === parameter;
}

function makeModulationRoute(sourceId: string, targetId: string, parameter: string, existingRoutes: PatchRoute[]): PatchRoute {
  return {
    id: uniqueRouteId(`mod:${sourceId}:${targetId}:${parameter}`, existingRoutes),
    domain: "modulation",
    source: { kind: "module", moduleId: sourceId, port: "cv-out" },
    target: { kind: "module", moduleId: targetId, port: "cv-in" },
    enabled: true,
    metadata: { createdFrom: "ui", parameter },
  };
}

export function getModulationCapability(moduleType: Module["type"], parameter: string): ModulationCapability | null {
  if (moduleType !== "trigger" && moduleType !== "drum" && moduleType !== "tonal") return null;
  const consumedByRuntime = moduleType === "trigger" && parameter === "density"
    ? "scheduler"
    : moduleType === "drum" && parameter === "basePitch"
      ? "audio"
      : moduleType === "tonal" && parameter === "cutoff"
        ? "audio"
        : null;
  const assignableInUi = MODULATION_UI_PARAMETERS[moduleType].includes(parameter);
  return {
    moduleType,
    parameter,
    assignableInUi,
    representedInTypedRouting: true,
    visibleInInspector: true,
    consumedByRuntime,
    knownLimitations: consumedByRuntime
      ? "Runtime currently consumes the legacy target-owned modulations map; typed routes are declarations until authority changes."
      : "Assignable/representable, but not currently consumed by scheduler or audio runtime.",
  };
}

export function getModulationCapabilityMatrix(): ModulationCapability[] {
  return (Object.entries(MODULATION_UI_PARAMETERS) as Array<["trigger" | "drum" | "tonal", string[]]>).flatMap(([moduleType, parameters]) => (
    parameters.map((parameter) => getModulationCapability(moduleType, parameter) as ModulationCapability)
  ));
}

export function resolveParameterModulation(
  patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown },
  targetId: string,
  parameter: string,
): ModulationRoutingResolution {
  const modulesById = new Map(patch.modules.map((module) => [module.id, module]));
  const target = modulesById.get(targetId);
  const controlIds = new Set(patch.modules.filter((module) => module.type === "control").map((module) => module.id));
  const legacySourceId = target && "modulations" in target && target.modulations && typeof target.modulations === "object"
    ? target.modulations[parameter] ?? null
    : null;
  const typedCandidates: ModulationRouteCandidate[] = [];

  if (Array.isArray(patch.routes)) {
    for (let routeIndex = 0; routeIndex < patch.routes.length; routeIndex += 1) {
      const route = normalizeRawRoute(patch.routes[routeIndex]);
      if (!route || !typedModulationRouteTargets(route, targetId, parameter)) continue;
      const sourceId = route.source.kind === "module" ? route.source.moduleId : null;
      typedCandidates.push({
        routeIndex,
        routeId: route.id,
        sourceId,
        enabled: route.enabled !== false,
        sourceExists: !!sourceId && controlIds.has(sourceId),
        targetExists: modulesById.has(targetId),
      });
    }
  }

  const activeTypedCandidates = typedCandidates.filter((candidate) => candidate.enabled && candidate.sourceExists && candidate.targetExists);
  const typedSourceId = activeTypedCandidates[0]?.sourceId ?? null;
  const legacySourceValid = !!(legacySourceId && controlIds.has(legacySourceId));
  const typedHasStale = typedCandidates.some((candidate) => candidate.enabled && (!candidate.sourceExists || !candidate.targetExists));
  const runtimeOwner = modulationRuntimeOwner(target, parameter);
  const runtimeSupported = runtimeOwner !== null;
  const effectiveRuntimeSourceId = runtimeSupported && legacySourceValid ? legacySourceId : null;
  const typedAndLegacyMatch = !!(typedSourceId && legacySourceId && typedSourceId === legacySourceId);
  const typedAndLegacyConflict = !!(typedSourceId && legacySourceId && typedSourceId !== legacySourceId);
  const fallbackUsed = !!(typedSourceId && legacySourceId && runtimeSupported);

  let state: ModulationRoutingState;
  if (typedHasStale) state = "stale-typed";
  else if (legacySourceId && !legacySourceValid) state = "stale-legacy";
  else if (!runtimeSupported && (typedSourceId || legacySourceId)) state = "unsupported";
  else if (typedAndLegacyConflict) state = "conflicting-hybrid";
  else if (typedAndLegacyMatch) state = "matching-hybrid";
  else if (typedSourceId) state = "typed-only";
  else if (legacySourceValid) state = "legacy-only";
  else state = "none";

  return {
    targetId,
    parameter,
    typedSourceId,
    legacySourceId,
    effectiveRuntimeSourceId,
    typedAndLegacyMatch,
    typedAndLegacyConflict,
    runtimeSupported,
    runtimeOwner,
    fallbackUsed,
    typedCandidates,
    state,
  };
}

export function setParameterModulationSource(patch: Patch, targetId: string, parameter: string, sourceId: string | null): ModulationRoutingResolution {
  const target = patch.modules.find((module) => module.id === targetId);
  if (!target || !("modulations" in target)) return resolveParameterModulation(patch, targetId, parameter);

  const source = sourceId
    ? patch.modules.find((module) => module.id === sourceId && module.type === "control")
    : null;
  const nextSourceId = source ? source.id : null;

  target.modulations = target.modulations ?? {};
  if (nextSourceId) target.modulations[parameter] = nextSourceId;
  else delete target.modulations[parameter];

  const existingRoutes = Array.isArray(patch.routes) ? patch.routes : [];
  const keptRoutes: PatchRoute[] = [];
  for (const rawRoute of existingRoutes) {
    const route = normalizeRawRoute(rawRoute);
    if (route && typedModulationRouteTargets(route, targetId, parameter)) continue;
    keptRoutes.push(rawRoute as PatchRoute);
  }

  if (nextSourceId) keptRoutes.push(makeModulationRoute(nextSourceId, targetId, parameter, keptRoutes));
  if (Array.isArray(patch.routes) || keptRoutes.length > 0) patch.routes = keptRoutes;

  return resolveParameterModulation(patch, targetId, parameter);
}

export function setVoicePrimaryEventSource(patch: Patch, voiceId: string, sourceId: string | null): VoiceEventRoutingResolution {
  const voice = patch.modules.find((module): module is SoundModule => module.id === voiceId && isSoundModule(module));
  if (!voice) return resolveVoiceEventRouting(patch, voiceId);

  const source = sourceId
    ? patch.modules.find((module) => module.id === sourceId && module.type === "trigger")
    : null;
  const nextSourceId = source ? source.id : null;
  voice.triggerSource = nextSourceId;

  const existingRoutes = Array.isArray(patch.routes) ? patch.routes : [];
  const keptRoutes: PatchRoute[] = [];
  for (const rawRoute of existingRoutes) {
    const route = normalizeRawRoute(rawRoute);
    const targetsVoicePrimary = route
      && route.domain === "event"
      && route.target.kind === "module"
      && route.target.moduleId === voiceId
      && isRawPrimaryEventRoute(rawRoute, route);
    if (!targetsVoicePrimary) keptRoutes.push(rawRoute as PatchRoute);
  }

  if (nextSourceId) keptRoutes.push(makePrimaryEventRoute(nextSourceId, voiceId, keptRoutes));
  if (Array.isArray(patch.routes) || keptRoutes.length > 0) patch.routes = keptRoutes;

  return resolveVoiceEventRouting(patch, voiceId);
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

  for (const module of patch.modules) {
    if (!isSoundModule(module)) continue;
    const resolution = resolveVoiceEventRouting(patch, module.id);
    if (resolution.state === "ambiguous") {
      push({
        code: "voice-ambiguous-primary-event-source",
        message: `Voice ${module.id} has multiple primary event routes`,
        moduleId: module.id,
      });
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

function emptyStaleRoutingCleanupPlan(): StaleRoutingCleanupPlan {
  return {
    legacyTriggerSources: [],
    legacyModulations: [],
    legacyConnections: [],
    typedRoutes: [],
    totalRemovals: 0,
  };
}

function routeMissingEndpoint(
  route: PatchRoute,
  modulesById: Set<string>,
  busesById: Set<string>,
): Omit<StaleRoutingCleanupPlan["typedRoutes"][number], "routeIndex"> | null {
  if (route.source.kind === "module" && !modulesById.has(route.source.moduleId)) {
    return { routeId: route.id, refId: route.source.moduleId, reason: "missing-source-module" };
  }
  if (route.target.kind === "module" && !modulesById.has(route.target.moduleId)) {
    return { routeId: route.id, refId: route.target.moduleId, reason: "missing-target-module" };
  }
  if (route.source.kind === "bus" && !busesById.has(route.source.busId)) {
    return { routeId: route.id, refId: route.source.busId, reason: "missing-source-bus" };
  }
  if (route.target.kind === "bus" && !busesById.has(route.target.busId)) {
    return { routeId: route.id, refId: route.target.busId, reason: "missing-target-bus" };
  }
  return null;
}

export function planStaleRoutingCleanup(patch: Pick<Patch, "modules" | "connections" | "buses"> & { routes?: unknown }): StaleRoutingCleanupPlan {
  const plan = emptyStaleRoutingCleanupPlan();
  const modulesById = new Set(patch.modules.map((module) => module.id));
  const busesById = new Set((patch.buses ?? []).map((bus) => bus.id));

  for (const module of patch.modules) {
    if (isSoundModule(module) && module.triggerSource && !modulesById.has(module.triggerSource)) {
      plan.legacyTriggerSources.push({ moduleId: module.id, refId: module.triggerSource });
    }

    const modulations = "modulations" in module && module.modulations && typeof module.modulations === "object"
      ? module.modulations
      : {};
    for (const [parameter, sourceId] of Object.entries(modulations)) {
      if (!sourceId || typeof sourceId !== "string") continue;
      if (!modulesById.has(sourceId)) {
        plan.legacyModulations.push({ moduleId: module.id, parameter, refId: sourceId });
      }
    }
  }

  for (const connection of patch.connections) {
    if (!modulesById.has(connection.fromModuleId)) {
      plan.legacyConnections.push({ connectionId: connection.id, refId: connection.fromModuleId, reason: "missing-source-module" });
      continue;
    }
    if (connection.to.type === "module" && connection.to.id && !modulesById.has(connection.to.id)) {
      plan.legacyConnections.push({ connectionId: connection.id, refId: connection.to.id, reason: "missing-target-module" });
      continue;
    }
    if (connection.to.type === "bus" && connection.to.id && !busesById.has(connection.to.id)) {
      plan.legacyConnections.push({ connectionId: connection.id, refId: connection.to.id, reason: "missing-target-bus" });
    }
  }

  if (Array.isArray(patch.routes)) {
    for (let routeIndex = 0; routeIndex < patch.routes.length; routeIndex += 1) {
      const route = normalizeRawRoute(patch.routes[routeIndex]);
      if (!route) continue;
      const staleEndpoint = routeMissingEndpoint(route, modulesById, busesById);
      if (staleEndpoint) plan.typedRoutes.push({ routeIndex, ...staleEndpoint });
    }
  }

  plan.totalRemovals = plan.legacyTriggerSources.length
    + plan.legacyModulations.length
    + plan.legacyConnections.length
    + plan.typedRoutes.length;
  return plan;
}

export function applyStaleRoutingCleanup(patch: Patch): StaleRoutingCleanupPlan {
  const plan = planStaleRoutingCleanup(patch);
  if (plan.totalRemovals === 0) return plan;

  const triggerCleanupByModule = new Set(plan.legacyTriggerSources.map((item) => item.moduleId));
  const modulationCleanup = new Set(plan.legacyModulations.map((item) => `${item.moduleId}\u0000${item.parameter}`));
  const connectionCleanup = new Set(plan.legacyConnections.map((item) => item.connectionId));
  const routeCleanup = new Set(plan.typedRoutes.map((item) => item.routeIndex));

  for (const module of patch.modules) {
    if (isSoundModule(module) && triggerCleanupByModule.has(module.id)) {
      module.triggerSource = null;
    }

    if (!("modulations" in module) || !module.modulations || typeof module.modulations !== "object") continue;
    for (const parameter of Object.keys(module.modulations)) {
      if (modulationCleanup.has(`${module.id}\u0000${parameter}`)) {
        delete module.modulations[parameter];
      }
    }
  }

  if (connectionCleanup.size > 0) {
    patch.connections = patch.connections.filter((connection) => !connectionCleanup.has(connection.id));
  }

  if (Array.isArray(patch.routes) && routeCleanup.size > 0) {
    patch.routes = patch.routes.filter((_, routeIndex) => !routeCleanup.has(routeIndex));
  }

  return plan;
}

export function cleanStaleRoutingRefsIfConfirmed(patch: Patch, confirmCleanup: RoutingCleanupConfirm): StaleRoutingCleanupPlan {
  const plan = planStaleRoutingCleanup(patch);
  if (plan.totalRemovals === 0) return plan;
  if (!confirmCleanup(plan)) return emptyStaleRoutingCleanupPlan();
  return applyStaleRoutingCleanup(patch);
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
