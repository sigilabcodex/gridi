import type { Patch } from "../../patch";
import { bindFloatingPanelReposition, placeFloatingPanel } from "../floatingPanel";
import { buildRoutingSnapshot, type RoutingSnapshot, type UIRoutingOverviewRoute } from "../routingVisibility";

type RoutingOverviewPanelParams = {
  patch: () => Patch;
  attachTo: HTMLButtonElement;
  onInspectModule?: (moduleId: string | null) => void;
};

function routeDomainLabel(route: UIRoutingOverviewRoute) {
  if (route.domain === "event") return "Event";
  if (route.domain === "modulation") return route.parameterLabel ?? "Mod";
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
  ].forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    domainFilter.appendChild(option);
  });

  const moduleFilter = document.createElement("select");
  moduleFilter.className = "transportSessionFilter routingOverviewSelect";

  controls.append(domainFilter, moduleFilter);

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

  panel.append(title, controls, eventBlock, modBlock, audioBlock);

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

    const selectedModuleId = moduleFilter.value;
    const domain = domainFilter.value;

    const eventRoutes = filterRoutesByModule(snapshot.overview.eventRoutes, selectedModuleId);
    const modulationRoutes = filterRoutesByModule(snapshot.overview.modulationRoutes, selectedModuleId);
    const audioRoutes = filterRoutesByModule(snapshot.overview.audioRoutes, selectedModuleId);

    eventList.replaceChildren(...createRouteRows(eventRoutes, selectedModuleId, params.onInspectModule));
    modList.replaceChildren(...createRouteRows(modulationRoutes, selectedModuleId, params.onInspectModule));
    audioList.replaceChildren(...createRouteRows(audioRoutes, selectedModuleId, params.onInspectModule));

    eventBlock.hidden = !(domain === "all" || domain === "event");
    modBlock.hidden = !(domain === "all" || domain === "modulation");
    audioBlock.hidden = !(domain === "all" || domain === "audio");
  };

  domainFilter.onchange = render;
  moduleFilter.onchange = render;

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
