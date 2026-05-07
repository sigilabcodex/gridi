import type { Patch } from "../../patch";
import { bindFloatingPanelReposition, placeFloatingPanel } from "../floatingPanel";
import { buildRoutingSnapshot, type RoutingSnapshot, type UIRoutingOverviewRoute } from "../routingVisibility";
import { buildEventRoutingInspectorRows, buildRoutingHealthSummary } from "../routingInspector";
import type { MidiInputStatus } from "../midiInput";
import type { MidiOutputStatus } from "../midiOutput";

type RoutingOverviewPanelParams = {
  patch: () => Patch;
  attachTo: HTMLButtonElement;
  onInspectModule?: (moduleId: string | null) => void;
  midiStatus: () => MidiInputStatus;
  midiOutStatus: () => MidiOutputStatus;
  onSelectMidiInput: (inputId: string | null) => void;
  onSelectMidiOutput: (outputId: string | null) => void;
  onSetMidiTargetModule: (moduleId: string | null) => void;
  onSetMidiOutSourceModule: (moduleId: string | null) => void;
};

function routeDomainLabel(route: UIRoutingOverviewRoute) {
  if (route.domain === "event") return "Event";
  if (route.domain === "modulation") return route.parameterLabel ?? "Mod";
  if (route.domain === "midi") return "MIDI";
  return "Audio";
}

function routeLineText(route: UIRoutingOverviewRoute) {
  const detail = route.parameterLabel ? ` · ${route.parameterLabel}` : "";
  return `${route.sourceLabel} → ${route.targetLabel}${detail}`;
}

function createRouteRows(
  routes: UIRoutingOverviewRoute[],
  selectedModuleId: string,
  onInspectModule?: (moduleId: string | null) => void,
) {
  if (!routes.length) {
    const empty = document.createElement("div");
    empty.className = "routingOverviewEmpty";
    empty.textContent = "No routes";
    return [empty];
  }

  return routes.map((route) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "routingOverviewRow";
    row.textContent = routeLineText(route);

    const hasMatch = !selectedModuleId || route.source?.id === selectedModuleId || route.target?.id === selectedModuleId;
    row.classList.toggle("isMuted", !hasMatch);

    const inspectId = route.source?.id ?? route.target?.id ?? null;
    row.onmouseenter = () => {
      if (!inspectId) return;
      onInspectModule?.(inspectId);
    };
    row.onmouseleave = () => onInspectModule?.(null);
    row.onclick = () => {
      if (!inspectId) return;
      onInspectModule?.(inspectId);
    };

    const tag = document.createElement("span");
    tag.className = "routingOverviewRowTag";
    tag.textContent = routeDomainLabel(route);
    row.prepend(tag);
    return row;
  });
}

function filterRoutesByModule(routes: UIRoutingOverviewRoute[], moduleId: string) {
  if (!moduleId) return routes;
  return routes.filter((route) => route.source?.id === moduleId || route.target?.id === moduleId);
}

function createHealthCountChip(label: string, count: number) {
  const chip = document.createElement("span");
  chip.className = "routingOverviewHealthChip";
  chip.textContent = `${label}: ${count}`;
  return chip;
}

function createInspectorRows(rows: ReturnType<typeof buildEventRoutingInspectorRows>) {
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "routingOverviewEmpty";
    empty.textContent = "No voices";
    return [empty];
  }

  return rows.map((entry) => {
    const row = document.createElement("div");
    row.className = "routingOverviewInspectorRow";
    row.classList.toggle("isMissing", entry.sourceStatus === "missing");
    row.classList.toggle("isMuted", entry.sourceStatus === "none");

    const source = document.createElement("span");
    source.className = "routingOverviewInspectorSource";
    source.textContent = entry.sourceLabel;

    const arrow = document.createElement("span");
    arrow.className = "routingOverviewInspectorArrow";
    arrow.textContent = "→";

    const target = document.createElement("span");
    target.className = "routingOverviewInspectorTarget";
    target.textContent = entry.voiceLabel;

    row.append(source, arrow, target);
    return row;
  });
}

export function createRoutingOverviewPanel(params: RoutingOverviewPanelParams) {
  const panel = document.createElement("div");
  panel.className = "floatingPanel transportUtilityPanel routingOverviewPanel hidden";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Routing overview");

  const title = document.createElement("div");
  title.className = "small transportUtilitySectionLabel";
  title.textContent = "Global routing overview";

  const controls = document.createElement("div");
  controls.className = "routingOverviewControls";

  const domainFilter = document.createElement("select");
  domainFilter.className = "transportSessionFilter routingOverviewSelect";
  [
    { value: "all", label: "All domains" },
    { value: "event", label: "Event" },
    { value: "modulation", label: "Modulation" },
    { value: "audio", label: "Audio" },
    { value: "midi", label: "MIDI" },
  ].forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    domainFilter.appendChild(option);
  });

  const moduleFilter = document.createElement("select");
  moduleFilter.className = "transportSessionFilter routingOverviewSelect";

  controls.append(domainFilter, moduleFilter);

  const healthBlock = document.createElement("section");
  healthBlock.className = "routingOverviewSection routingOverviewHealth";
  const healthStatus = document.createElement("div");
  healthStatus.className = "routingOverviewHealthStatus";
  const healthCounts = document.createElement("div");
  healthCounts.className = "routingOverviewHealthCounts";
  healthBlock.append(healthStatus, healthCounts);

  const inspectorBlock = document.createElement("section");
  inspectorBlock.className = "routingOverviewSection routingOverviewInspector";
  const inspectorHead = document.createElement("div");
  inspectorHead.className = "small transportUtilitySectionLabel";
  inspectorHead.textContent = "Event inspector";
  const inspectorList = document.createElement("div");
  inspectorList.className = "routingOverviewList";
  inspectorBlock.append(inspectorHead, inspectorList);

  const eventBlock = document.createElement("section");
  eventBlock.className = "routingOverviewSection";
  const eventHead = document.createElement("div");
  eventHead.className = "small transportUtilitySectionLabel";
  eventHead.textContent = "Event";
  const eventList = document.createElement("div");
  eventList.className = "routingOverviewList";
  eventBlock.append(eventHead, eventList);

  const modBlock = document.createElement("section");
  modBlock.className = "routingOverviewSection";
  const modHead = document.createElement("div");
  modHead.className = "small transportUtilitySectionLabel";
  modHead.textContent = "Modulation";
  const modList = document.createElement("div");
  modList.className = "routingOverviewList";
  modBlock.append(modHead, modList);

  const audioBlock = document.createElement("section");
  audioBlock.className = "routingOverviewSection";
  const audioHead = document.createElement("div");
  audioHead.className = "small transportUtilitySectionLabel";
  audioHead.textContent = "Audio";
  const audioList = document.createElement("div");
  audioList.className = "routingOverviewList";
  audioBlock.append(audioHead, audioList);

  const midiEditBlock = document.createElement("section");
  midiEditBlock.className = "routingOverviewSection";
  const midiEditHead = document.createElement("div");
  midiEditHead.className = "small transportUtilitySectionLabel";
  midiEditHead.textContent = "MIDI input routing";
  const midiEditBody = document.createElement("div");
  midiEditBody.className = "transportUtilitySection";
  const midiInputSelect = document.createElement("select");
  midiInputSelect.className = "transportSessionFilter routingOverviewSelect";
  const midiTargetSelect = document.createElement("select");
  midiTargetSelect.className = "transportSessionFilter routingOverviewSelect";
  midiEditBody.append(midiInputSelect, midiTargetSelect);
  midiEditBlock.append(midiEditHead, midiEditBody);

  const midiOutEditBlock = document.createElement("section");
  midiOutEditBlock.className = "routingOverviewSection";
  const midiOutEditHead = document.createElement("div");
  midiOutEditHead.className = "small transportUtilitySectionLabel";
  midiOutEditHead.textContent = "MIDI output routing";
  const midiOutEditBody = document.createElement("div");
  midiOutEditBody.className = "transportUtilitySection";
  const midiOutStatusLine = document.createElement("div");
  midiOutStatusLine.className = "routingOverviewEmpty";
  const midiOutputSelect = document.createElement("select");
  midiOutputSelect.className = "transportSessionFilter routingOverviewSelect";
  const midiOutSourceSelect = document.createElement("select");
  midiOutSourceSelect.className = "transportSessionFilter routingOverviewSelect";
  midiOutEditBody.append(midiOutStatusLine, midiOutputSelect, midiOutSourceSelect);
  midiOutEditBlock.append(midiOutEditHead, midiOutEditBody);

  const midiRoutesBlock = document.createElement("section");
  midiRoutesBlock.className = "routingOverviewSection";
  const midiRoutesHead = document.createElement("div");
  midiRoutesHead.className = "small transportUtilitySectionLabel";
  midiRoutesHead.textContent = "MIDI";
  const midiRoutesList = document.createElement("div");
  midiRoutesList.className = "routingOverviewList";
  midiRoutesBlock.append(midiRoutesHead, midiRoutesList);

  panel.append(title, controls, healthBlock, inspectorBlock, midiEditBlock, midiOutEditBlock, eventBlock, modBlock, audioBlock, midiRoutesBlock);

  let cleanup: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let latestSnapshot: RoutingSnapshot | null = null;

  const syncModuleOptions = (patch: Patch) => {
    const selected = moduleFilter.value;
    moduleFilter.replaceChildren();

    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All modules";
    moduleFilter.appendChild(all);

    patch.modules
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((module) => {
        const option = document.createElement("option");
        option.value = module.id;
        option.textContent = `${module.name} (${module.type === "tonal" ? "synth" : module.type})`;
        moduleFilter.appendChild(option);
      });

    moduleFilter.value = patch.modules.some((module) => module.id === selected) ? selected : "";
  };

  const render = () => {
    const patch = params.patch();
    const snapshot = buildRoutingSnapshot(patch);
    latestSnapshot = snapshot;
    syncModuleOptions(patch);
    const midiStatus = params.midiStatus();
    const midiOutStatus = params.midiOutStatus();

    const selectedModuleId = moduleFilter.value;
    const domain = domainFilter.value;
    const health = buildRoutingHealthSummary(patch);
    healthStatus.textContent = health.label;
    healthBlock.classList.toggle("hasWarnings", health.warningCount > 0);
    healthCounts.replaceChildren();
    if (health.warningCount > 0) {
      const { missingSources, invalidRoutes, staleConnections, staleModulations } = health.counts;
      if (missingSources) healthCounts.appendChild(createHealthCountChip("missing sources", missingSources));
      if (invalidRoutes) healthCounts.appendChild(createHealthCountChip("invalid routes", invalidRoutes));
      if (staleConnections) healthCounts.appendChild(createHealthCountChip("stale connections", staleConnections));
      if (staleModulations) healthCounts.appendChild(createHealthCountChip("stale modulations", staleModulations));
    }

    const eventRows = buildEventRoutingInspectorRows(patch)
      .filter((row) => !selectedModuleId || row.voiceId === selectedModuleId || row.sourceId === selectedModuleId);
    inspectorList.replaceChildren(...createInspectorRows(eventRows));

    const eventRoutes = filterRoutesByModule(snapshot.overview.eventRoutes, selectedModuleId);
    const modulationRoutes = filterRoutesByModule(snapshot.overview.modulationRoutes, selectedModuleId);
    const audioRoutes = filterRoutesByModule(snapshot.overview.audioRoutes, selectedModuleId);
    const midiRoutes = filterRoutesByModule(snapshot.overview.midiRoutes, selectedModuleId);

    eventList.replaceChildren(...createRouteRows(eventRoutes, selectedModuleId, params.onInspectModule));
    modList.replaceChildren(...createRouteRows(modulationRoutes, selectedModuleId, params.onInspectModule));
    audioList.replaceChildren(...createRouteRows(audioRoutes, selectedModuleId, params.onInspectModule));
    midiRoutesList.replaceChildren(...createRouteRows(midiRoutes, selectedModuleId, params.onInspectModule));

    const activeMidiPatchRoute = (patch.routes ?? []).find((route) => (
      route.enabled &&
      route.domain === "midi" &&
      route.source.kind === "external" &&
      route.source.externalType === "midi" &&
      route.target.kind === "module"
    )) ?? null;
    const activeMidiInputId = activeMidiPatchRoute?.source.kind === "external" ? activeMidiPatchRoute.source.portId ?? null : null;
    const activeMidiTargetModuleId = activeMidiPatchRoute?.target.kind === "module" ? activeMidiPatchRoute.target.moduleId : null;

    const activeMidiOutPatchRoute = (patch.routes ?? []).find((route) => (
      route.enabled &&
      route.domain === "midi" &&
      route.source.kind === "module" &&
      route.target.kind === "external" &&
      route.target.externalType === "midi"
    )) ?? null;
    const activeMidiOutputId = activeMidiOutPatchRoute?.target.kind === "external" ? activeMidiOutPatchRoute.target.portId ?? null : null;
    const activeMidiOutSourceModuleId = activeMidiOutPatchRoute?.source.kind === "module" ? activeMidiOutPatchRoute.source.moduleId : null;

    midiInputSelect.replaceChildren();
    const autoOption = document.createElement("option");
    autoOption.value = "";
    autoOption.textContent = "Input: Auto (prefer hardware)";
    midiInputSelect.appendChild(autoOption);
    const availableInputs = midiStatus.kind === "connected" || midiStatus.kind === "idle" ? midiStatus.inputs : [];
    for (const input of availableInputs) {
      const option = document.createElement("option");
      option.value = input.id;
      option.textContent = `Input: ${input.name}${input.likelyVirtual ? " (virtual)" : ""}`;
      midiInputSelect.appendChild(option);
    }
    midiInputSelect.value = activeMidiInputId ?? "";

    midiTargetSelect.replaceChildren();
    const noneTarget = document.createElement("option");
    noneTarget.value = "";
    noneTarget.textContent = "Target: None";
    midiTargetSelect.appendChild(noneTarget);
    patch.modules
      .filter((module) => module.type === "tonal")
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((module) => {
        const option = document.createElement("option");
        option.value = module.id;
        option.textContent = `Target: ${module.name}`;
        midiTargetSelect.appendChild(option);
      });
    midiTargetSelect.value = activeMidiTargetModuleId ?? "";
    midiInputSelect.disabled = midiTargetSelect.value === "";
    midiEditBody.classList.toggle("isMuted", patch.modules.every((module) => module.type !== "tonal"));

    midiOutputSelect.replaceChildren();
    const outputAutoOption = document.createElement("option");
    outputAutoOption.value = "";
    outputAutoOption.textContent = "Output: Auto";
    midiOutputSelect.appendChild(outputAutoOption);
    const availableOutputs = midiOutStatus.kind === "connected" || midiOutStatus.kind === "sending" || midiOutStatus.kind === "idle" ? midiOutStatus.outputs : [];
    for (const output of availableOutputs) {
      const option = document.createElement("option");
      option.value = output.id;
      option.textContent = `Output: ${output.name}`;
      midiOutputSelect.appendChild(option);
    }
    midiOutputSelect.value = activeMidiOutputId ?? "";

    midiOutSourceSelect.replaceChildren();
    const noneSource = document.createElement("option");
    noneSource.value = "";
    noneSource.textContent = "Source: Off";
    midiOutSourceSelect.appendChild(noneSource);
    patch.modules
      .filter((module) => module.type === "trigger")
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((module) => {
        const option = document.createElement("option");
        option.value = module.id;
        option.textContent = `Source: ${module.name}`;
        midiOutSourceSelect.appendChild(option);
      });
    midiOutSourceSelect.value = activeMidiOutSourceModuleId ?? "";
    midiOutputSelect.disabled = midiOutSourceSelect.value === "";
    midiOutEditBody.classList.toggle("isMuted", midiOutSourceSelect.value === "");
    midiOutStatusLine.textContent = midiOutStatus.kind === "unsupported"
      ? "MIDI Out unavailable in this browser"
      : midiOutStatus.kind === "pending"
        ? "MIDI Out permission needed"
        : midiOutStatus.kind === "denied"
          ? `MIDI Out denied: ${midiOutStatus.reason}`
          : midiOutStatus.kind === "sending"
            ? `MIDI Out sending → ${midiOutStatus.name}`
            : midiOutStatus.kind === "connected"
              ? `MIDI Out selected: ${midiOutStatus.name}`
              : midiOutStatus.message;

    inspectorBlock.hidden = !(domain === "all" || domain === "event");
    eventBlock.hidden = !(domain === "all" || domain === "event");
    modBlock.hidden = !(domain === "all" || domain === "modulation");
    audioBlock.hidden = !(domain === "all" || domain === "audio");
    midiRoutesBlock.hidden = !(domain === "all" || domain === "midi");
    midiEditBlock.hidden = !(domain === "all" || domain === "midi");
    midiOutEditBlock.hidden = !(domain === "all" || domain === "midi");
  };

  domainFilter.onchange = render;
  moduleFilter.onchange = render;
  midiInputSelect.onchange = () => {
    const targetModuleId = midiTargetSelect.value || null;
    params.onSelectMidiInput(midiInputSelect.value || null);
    if (!targetModuleId) return;
    params.onSetMidiTargetModule(targetModuleId);
    render();
  };
  midiTargetSelect.onchange = () => {
    const targetModuleId = midiTargetSelect.value || null;
    params.onSetMidiTargetModule(targetModuleId);
    render();
  };
  midiOutputSelect.onchange = () => {
    params.onSelectMidiOutput(midiOutputSelect.value || null);
    render();
  };
  midiOutSourceSelect.onchange = () => {
    params.onSetMidiOutSourceModule(midiOutSourceSelect.value || null);
    render();
  };

  const close = () => {
    if (panel.classList.contains("hidden")) return;
    panel.classList.add("hidden");
    params.attachTo.setAttribute("aria-expanded", "false");
    cleanup?.destroy();
    cleanup = null;
    params.onInspectModule?.(null);
  };

  const open = () => {
    if (panel.isConnected) panel.remove();
    document.body.appendChild(panel);
    panel.classList.remove("hidden");
    params.attachTo.setAttribute("aria-expanded", "true");
    render();
    placeFloatingPanel(panel, params.attachTo.getBoundingClientRect(), {
      preferredSide: "bottom",
      align: "end",
      offset: 8,
      minWidth: 260,
      maxWidth: 420,
    });
    cleanup = bindFloatingPanelReposition(panel, () => (params.attachTo.isConnected ? params.attachTo.getBoundingClientRect() : null), {
      preferredSide: "bottom",
      align: "end",
      offset: 8,
      minWidth: 260,
      maxWidth: 420,
    });
  };

  const toggle = () => {
    if (panel.classList.contains("hidden")) open();
    else close();
  };

  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (!panel.classList.contains("hidden") && !panel.contains(target) && !params.attachTo.contains(target)) close();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    close();
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);

  return {
    toggle,
    close,
    refresh() {
      if (!panel.classList.contains("hidden")) render();
    },
    getSnapshot() {
      return latestSnapshot;
    },
  };
}
