import type { Module, Patch, SoundModule } from "../patch";
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

export type RoutingSnapshot = {
  modules: Map<string, RouteRef>;
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

export function getParameterLabel(key: string) {
  return PARAM_LABELS[key] ?? key;
}

export function buildRoutingSnapshot(patch: Patch): RoutingSnapshot {
  const modules = new Map<string, RouteRef>();
  const triggerTargets = new Map<string, RouteRef[]>();
  const controlTargets = new Map<string, ControlTargetRef[]>();
  const voiceIncoming = new Map<string, { trigger: RouteRef | null; modulations: Array<{ parameter: string; parameterLabel: string; source: RouteRef }> }>();
  const triggerIncoming = new Map<string, Array<{ parameter: string; parameterLabel: string; source: RouteRef }>>();
  const visualSources = new Map<string, { sourceLabel: string; contributors: RouteRef[] }>();

  for (const module of patch.modules) {
    modules.set(module.id, makeRouteRef(module));
  }

  for (const module of patch.modules) {
    if (module.type === "drum" || module.type === "tonal") {
      const trigger = module.triggerSource ? modules.get(module.triggerSource) ?? null : null;
      const modulations = Object.entries(module.modulations ?? {})
        .map(([parameter, sourceId]) => {
          const source = sourceId ? modules.get(sourceId) : null;
          return source ? { parameter, parameterLabel: getParameterLabel(parameter), source } : null;
        })
        .filter((entry): entry is { parameter: string; parameterLabel: string; source: RouteRef } => Boolean(entry));
      voiceIncoming.set(module.id, { trigger, modulations });

      if (trigger) {
        const voices = triggerTargets.get(trigger.id) ?? [];
        voices.push(modules.get(module.id)!);
        triggerTargets.set(trigger.id, voices);
      }

      for (const modulation of modulations) {
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

    if (module.type === "trigger") {
      const incoming = Object.entries(module.modulations ?? {})
        .map(([parameter, sourceId]) => {
          const source = sourceId ? modules.get(sourceId) : null;
          return source ? { parameter, parameterLabel: getParameterLabel(parameter), source } : null;
        })
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
    triggerTargets,
    controlTargets,
    voiceIncoming,
    triggerIncoming,
    visualSources,
  };
}

export function getConnectedModuleIds(snapshot: RoutingSnapshot, module: Module): string[] {
  const ids = new Set<string>();

  if (module.type === "drum" || module.type === "tonal") {
    const incoming = snapshot.voiceIncoming.get(module.id);
    if (incoming?.trigger) ids.add(incoming.trigger.id);
    incoming?.modulations.forEach((modulation) => ids.add(modulation.source.id));
  }

  if (module.type === "trigger") {
    (snapshot.triggerTargets.get(module.id) ?? []).forEach((target) => ids.add(target.id));
    (snapshot.triggerIncoming.get(module.id) ?? []).forEach((modulation) => ids.add(modulation.source.id));
  }

  if (module.type === "control") {
    (snapshot.controlTargets.get(module.id) ?? []).forEach((target) => ids.add(target.targetId));
  }

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
