import type { Module, Patch, SoundModule } from "../patch";
import type { CompiledRouting, PatchRoute, RouteDomain, RouteEndpoint } from "../routingGraph.ts";
import { compileRoutingGraph } from "../routingGraph.ts";
import type { TooltipBinder } from "./tooltip";

export type RouteRef = {
  id: string;
  name: string;
  family: Module["type"];
  shortId: string;
  label: string;
};

export type ControlTargetRef = {
  controlId: string;
  targetId: string;
  targetName: string;
  targetFamily: Module["type"];
  parameter: string;
  parameterLabel: string;
};

export type UIRoutingOverviewRoute = {
  id: string;
  domain: RouteDomain;
  source: RouteRef | null;
  sourceLabel: string;
  target: RouteRef | null;
  targetLabel: string;
  parameterLabel?: string;
  parameter?: string;
};

export type UIRoutingOverview = {
  eventRoutes: UIRoutingOverviewRoute[];
  modulationRoutes: UIRoutingOverviewRoute[];
  audioRoutes: UIRoutingOverviewRoute[];
  midiRoutes: UIRoutingOverviewRoute[];
  byModule: Map<string, { incoming: UIRoutingOverviewRoute[]; outgoing: UIRoutingOverviewRoute[] }>;
};

export type RoutingSnapshot = {
  modules: Map<string, RouteRef>;
  overview: UIRoutingOverview;
  triggerTargets: Map<string, RouteRef[]>;
  controlTargets: Map<string, ControlTargetRef[]>;
  voiceIncoming: Map<string, { trigger: RouteRef | null; modulations: Array<{ parameter: string; parameterLabel: string; source: RouteRef }> }>;
  triggerIncoming: Map<string, Array<{ parameter: string; parameterLabel: string; source: RouteRef }>>;
  visualSources: Map<string, { sourceLabel: string; contributors: RouteRef[] }>;
};

const PARAM_LABELS: Record<string, string> = {
  basePitch: "Pitch",
  cutoff: "Cutoff",
  density: "Density",
};

function makeRouteRef(module: Module): RouteRef {
  return {
    id: module.id,
    name: module.name,
    family: module.type,
    shortId: module.id.slice(-4).toUpperCase(),
    label: `${module.name}`,
  };
}

function endpointLabel(endpoint: RouteEndpoint, modules: Map<string, RouteRef>) {
  if (endpoint.kind === "module") return modules.get(endpoint.moduleId)?.name ?? endpoint.moduleId;
  if (endpoint.kind === "bus") return `Bus ${endpoint.busId}`;
  if (endpoint.kind === "master") return "Master";
  if (endpoint.portId) return `MIDI ${endpoint.portId}`;
  const channel = endpoint.channel ? ` ch${endpoint.channel}` : "";
  return `MIDI${channel}`;
}

function includeByModule(map: UIRoutingOverview["byModule"], moduleId: string, route: UIRoutingOverviewRoute, direction: "incoming" | "outgoing") {
  const entry = map.get(moduleId) ?? { incoming: [], outgoing: [] };
  entry[direction].push(route);
  map.set(moduleId, entry);
}

export function getParameterLabel(key: string) {
  return PARAM_LABELS[key] ?? key;
}

export function buildUIRoutingOverview(compiled: CompiledRouting, modules: Map<string, RouteRef>): UIRoutingOverview {
  const eventRoutes: UIRoutingOverviewRoute[] = [];
  const modulationRoutes: UIRoutingOverviewRoute[] = [];
  const audioRoutes: UIRoutingOverviewRoute[] = [];
  const midiRoutes: UIRoutingOverviewRoute[] = [];
  const byModule = new Map<string, { incoming: UIRoutingOverviewRoute[]; outgoing: UIRoutingOverviewRoute[] }>();

  const include = (routeRecord: PatchRoute) => {
    const source = routeRecord.source.kind === "module" ? modules.get(routeRecord.source.moduleId) ?? null : null;
    const target = routeRecord.target.kind === "module" ? modules.get(routeRecord.target.moduleId) ?? null : null;
    const route: UIRoutingOverviewRoute = {
      id: routeRecord.id,
      domain: routeRecord.domain,
      source,
      sourceLabel: endpointLabel(routeRecord.source, modules),
      target,
      targetLabel: endpointLabel(routeRecord.target, modules),
      parameterLabel: routeRecord.domain === "modulation" && routeRecord.metadata?.parameter
        ? getParameterLabel(routeRecord.metadata.parameter)
        : undefined,
      parameter: routeRecord.metadata?.parameter,
    };

    if (route.domain === "event") eventRoutes.push(route);
    else if (route.domain === "modulation") modulationRoutes.push(route);
    else if (route.domain === "audio") audioRoutes.push(route);
    else if (route.domain === "midi") midiRoutes.push(route);

    if (source) includeByModule(byModule, source.id, route, "outgoing");
    if (target) includeByModule(byModule, target.id, route, "incoming");
  };

  for (const route of compiled.routes) {
    if (route.domain === "event" || route.domain === "modulation" || route.domain === "audio" || route.domain === "midi") include(route);
  }

  const sortRoutes = (items: UIRoutingOverviewRoute[]) => {
    items.sort((a, b) => {
      const sourceCmp = a.sourceLabel.localeCompare(b.sourceLabel);
      if (sourceCmp !== 0) return sourceCmp;
      const targetCmp = a.targetLabel.localeCompare(b.targetLabel);
      if (targetCmp !== 0) return targetCmp;
      return a.id.localeCompare(b.id);
    });
  };

  sortRoutes(eventRoutes);
  sortRoutes(modulationRoutes);
  sortRoutes(audioRoutes);
  sortRoutes(midiRoutes);

  return { eventRoutes, modulationRoutes, audioRoutes, midiRoutes, byModule };
}

export function buildRoutingSnapshot(patch: Patch): RoutingSnapshot {
  const compiled = compileRoutingGraph(patch);
  const modules = new Map<string, RouteRef>();
  const triggerTargets = new Map<string, RouteRef[]>();
  const controlTargets = new Map<string, ControlTargetRef[]>();
  const voiceIncoming = new Map<string, { trigger: RouteRef | null; modulations: Array<{ parameter: string; parameterLabel: string; source: RouteRef }> }>();
  const triggerIncoming = new Map<string, Array<{ parameter: string; parameterLabel: string; source: RouteRef }>>();
  const visualSources = new Map<string, { sourceLabel: string; contributors: RouteRef[] }>();

  for (const module of patch.modules) {
    modules.set(module.id, makeRouteRef(module));
  }

  const overview = buildUIRoutingOverview(compiled, modules);

  for (const module of patch.modules) {
    if (module.type === "drum" || module.type === "tonal") {
      const incomingRoutes = overview.byModule.get(module.id)?.incoming ?? [];
      const triggerRoute = incomingRoutes.find((route) => route.domain === "event") ?? null;
      const modulationRoutes = incomingRoutes.filter((route) => route.domain === "modulation");
      const trigger = triggerRoute?.source ?? null;
      const modulations = modulationRoutes
        .map((route) => (route.source && route.parameterLabel && route.parameter)
          ? { parameter: route.parameter, parameterLabel: route.parameterLabel, source: route.source }
          : null)
        .filter((entry): entry is { parameter: string; parameterLabel: string; source: RouteRef } => Boolean(entry));
      voiceIncoming.set(module.id, { trigger, modulations });

      if (trigger) {
        const triggerEventTargets = overview.byModule.get(trigger.id)?.outgoing
          .filter((route) => route.domain === "event")
          .map((route) => route.target)
          .filter((target): target is RouteRef => Boolean(target)) ?? [];
        triggerTargets.set(trigger.id, triggerEventTargets);
      }

      modulationRoutes.forEach((route) => {
        if (!route.source || !route.parameterLabel) return;
        const targets = controlTargets.get(route.source.id) ?? [];
        targets.push({
          controlId: route.source.id,
          targetId: module.id,
          targetName: module.name,
          targetFamily: module.type,
          parameter: route.parameter ?? route.parameterLabel,
          parameterLabel: route.parameterLabel,
        });
        controlTargets.set(route.source.id, targets);
      });
      continue;
    }

    if (module.type === "trigger") {
      const incoming = (overview.byModule.get(module.id)?.incoming ?? [])
        .filter((route) => route.domain === "modulation")
        .map((route) => (route.source && route.parameterLabel && route.parameter)
          ? { parameter: route.parameter, parameterLabel: route.parameterLabel, source: route.source }
          : null)
        .filter((entry): entry is { parameter: string; parameterLabel: string; source: RouteRef } => Boolean(entry));
      triggerIncoming.set(module.id, incoming);

      for (const modulation of incoming) {
        const targets = controlTargets.get(modulation.source.id) ?? [];
        targets.push({
          controlId: modulation.source.id,
          targetId: module.id,
          targetName: module.name,
          targetFamily: module.type,
          parameter: modulation.parameter,
          parameterLabel: modulation.parameterLabel,
        });
        controlTargets.set(modulation.source.id, targets);
      }
      continue;
    }

    if (module.type === "visual") {
      const contributors = patch.modules
        .filter((candidate): candidate is SoundModule => candidate.type === "drum" || candidate.type === "tonal")
        .map((candidate) => modules.get(candidate.id))
        .filter((candidate): candidate is RouteRef => Boolean(candidate));
      visualSources.set(module.id, { sourceLabel: "Master mix", contributors });
    }
  }

  return {
    modules,
    overview,
    triggerTargets,
    controlTargets,
    voiceIncoming,
    triggerIncoming,
    visualSources,
  };
}

export function getConnectedModuleIds(snapshot: RoutingSnapshot, module: Module): string[] {
  const ids = new Set<string>();
  const byModule = snapshot.overview.byModule.get(module.id);

  byModule?.incoming.forEach((route) => {
    if (route.source) ids.add(route.source.id);
  });
  byModule?.outgoing.forEach((route) => {
    if (route.target) ids.add(route.target.id);
  });

  if (module.type === "visual") {
    (snapshot.visualSources.get(module.id)?.contributors ?? []).forEach((ref) => ids.add(ref.id));
  }

  ids.delete(module.id);
  return [...ids];
}

function createEl<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createRoutingChip(text: string, tone: "default" | "connected" | "muted" = "default") {
  const chip = createEl("span", `routingChip ${tone !== "default" ? `routingChip-${tone}` : ""}`.trim(), text);
  return chip;
}

export function createRoutingSummary(title: string, chips: HTMLElement[], emptyText: string) {
  const block = createEl("div", "routingSummaryBlock");
  const label = createEl("div", "routingSummaryLabel", title);
  const values = createEl("div", "routingSummaryValues");
  if (chips.length) chips.forEach((chip) => values.appendChild(chip));
  else values.appendChild(createRoutingChip(emptyText, "muted"));
  block.append(label, values);
  return block;
}

export function createRoutingSummaryStrip(blocks: HTMLElement[]) {
  const strip = createEl("div", "routingSummaryStrip");
  blocks.forEach((block) => strip.appendChild(block));
  return strip;
}

export function createRoutingCard(title: string, subtitle?: string) {
  const card = createEl("div", "utilityRouteCard routingCard");
  const head = createEl("div", "routingCardHead");
  const titleNode = createEl("div", "routingCardTitle", title);
  head.appendChild(titleNode);
  if (subtitle) head.appendChild(createEl("div", "routingCardSubtitle", subtitle));
  card.appendChild(head);
  return card;
}

export function createCompactSelectField(params: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string | null | undefined;
  emptyLabel?: string;
  includeEmptyOption?: boolean;
  className?: string;
  tooltip?: string;
  attachTooltip?: TooltipBinder;
  onChange: (value: string | null) => void;
}) {
  const wrap = createEl("label", `compactSelectField${params.className ? ` ${params.className}` : ""}`.trim());
  const label = createEl("span", "compactSelectLabel", params.label);
  const sel = document.createElement("select");
  sel.className = "compactSelectInput";

  if (params.includeEmptyOption ?? true) {
    const none = document.createElement("option");
    none.value = "";
    none.textContent = params.emptyLabel ?? "None";
    if (!params.selected) none.selected = true;
    sel.appendChild(none);
  }

  for (const option of params.options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    if (option.value === params.selected) node.selected = true;
    sel.appendChild(node);
  }

  sel.onchange = () => params.onChange(sel.value || null);
  if (params.tooltip && params.attachTooltip) {
    params.attachTooltip(sel, { text: params.tooltip, ariaLabel: params.label });
  }
  wrap.append(label, sel);
  return { wrap, select: sel };
}

export function createModuleRefChip(ref: RouteRef, suffix?: string) {
  return createRoutingChip(suffix ? `${ref.name} · ${suffix}` : ref.name, "connected");
}
