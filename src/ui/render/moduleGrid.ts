import type { Scheduler } from "../../engine/scheduler";
import type { Engine } from "../../engine/audio";
import type { Patch, VisualKind } from "../../patch";
import { getControls, getTriggers, makeControl, makeSound, makeTrigger, makeVisual } from "../../patch";
import {
  getModuleGridPosition,
  gridPositionKey,
  setModuleGridPosition,
  type GridPosition,
  resolveGridLayout,
} from "../../workspacePlacement.ts";
import type { VoiceTab } from "../voiceModule";
import { renderDrumModuleSurface, renderSynthModuleSurface } from "../voiceModule";
import { renderTriggerSurface } from "../triggerModule";
import { renderControlSurface } from "../controlModule";
import { renderVisualSurface } from "../visualModule";
import { renderAddModuleSlot } from "../AddModuleSlot";
import { buildRoutingSnapshot, getConnectedModuleIds } from "../routingVisibility";
import type { TooltipBinder } from "../tooltip";

type ModuleGridParams = {
  main: HTMLElement;
  engine: Engine;
  sched: Scheduler;
  patch: () => Patch;
  clonePatch: (patch: Patch) => Patch;
  pushHistory: (prev: Patch) => void;
  onPatchChange: (fn: (patch: Patch) => void, opts?: { regen?: boolean }) => void;
  saveAndPersist: () => void;
  getVoiceTab: (id: string) => VoiceTab;
  setVoiceTab: (id: string, tab: VoiceTab) => void;
  led: (moduleId: string) => { active: boolean; hit: boolean };
  attachTooltip: TooltipBinder;
};

type Pick = "drum" | "tonal" | "trigger" | "control-lfo" | "control-drift" | "control-stepped" | VisualKind;

const MIN_VISIBLE_COLUMNS = 1;

function createModuleCell(surface: HTMLElement, opts: { occupied: boolean; index: number; position: GridPosition }) {
  const cell = document.createElement("div");
  cell.className = `moduleCell ${opts.occupied ? "occupied" : "empty"}`;
  cell.dataset.slotIndex = String(opts.index);
  cell.dataset.gridX = String(opts.position.x);
  cell.dataset.gridY = String(opts.position.y);

  const substrate = document.createElement("div");
  substrate.className = "moduleCellSubstrate";

  const bed = document.createElement("div");
  bed.className = "moduleCellBed";

  cell.append(substrate, bed);
  cell.appendChild(surface);
  return cell;
}

function focusFirstInteractive(surface: HTMLElement) {
  const target = surface.querySelector<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  target?.focus();
}

function parseCssLengthPx(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readVisibleColumnCount(main: HTMLElement) {
  const rootStyles = getComputedStyle(document.documentElement);
  const cellWidth = parseCssLengthPx(rootStyles.getPropertyValue("--module-cell-w"), 330);
  const gap = parseCssLengthPx(rootStyles.getPropertyValue("--workspace-grid-gap"), 10);
  const padding = parseCssLengthPx(rootStyles.getPropertyValue("--workspace-grid-pad"), 8) * 2;
  const availableWidth = Math.max(main.clientWidth, cellWidth + padding);
  const fitted = Math.floor((availableWidth - padding + gap) / (cellWidth + gap));
  return Math.max(MIN_VISIBLE_COLUMNS, fitted || 0);
}

export function createModuleGridRenderer(params: ModuleGridParams) {
  let updaters: Array<() => void> = [];
  let inspectedModuleId: string | null = null;
  let visibleColumns = readVisibleColumnCount(params.main);
  let renderedColumns = visibleColumns;

  const removeModule = (moduleId: string) => {
    const prev = params.clonePatch(params.patch());
    const nextPatch = params.patch();
    nextPatch.modules = nextPatch.modules.filter((m) => m.id !== moduleId);
    for (const m of nextPatch.modules) {
      if ((m.type === "drum" || m.type === "tonal") && m.triggerSource === moduleId) m.triggerSource = null;
      if (m.type === "drum" || m.type === "tonal" || m.type === "trigger") {
        const entries = Object.entries(m.modulations ?? {});
        for (const [key, sourceId] of entries) {
          if (sourceId === moduleId) delete (m.modulations as Record<string, string>)[key];
        }
      }
    }
    if (inspectedModuleId === moduleId) inspectedModuleId = null;
    params.pushHistory(prev);
    params.sched.setPatch(nextPatch, { regen: true });
    params.sched.regenAll();
    params.saveAndPersist();
    rerender();
  };

  const moveModuleToCell = (moduleId: string, destination: GridPosition) => {
    const prev = params.clonePatch(params.patch());
    const nextPatch = params.patch();
    const module = nextPatch.modules.find((m) => m.id === moduleId);
    if (!module) return;

    const currentPosition = getModuleGridPosition(module);
    if (currentPosition && gridPositionKey(currentPosition) === gridPositionKey(destination)) return;

    setModuleGridPosition(module, destination);

    params.pushHistory(prev);
    params.sched.setPatch(nextPatch, { regen: false });
    params.saveAndPersist();
    rerender();
  };

  const createModuleAt = (what: Pick, destination: GridPosition) => {
    const prev = params.clonePatch(params.patch());
    const nextPatch = params.patch();

    const indexForType = nextPatch.modules.filter((m) =>
      what === "trigger"
        ? m.type === "trigger"
        : what.startsWith("control")
          ? m.type === "control"
          : what === "drum"
            ? m.type === "drum"
            : what === "tonal"
              ? m.type === "tonal"
              : m.type === "visual",
    ).length;

    const created = what === "drum" || what === "tonal"
      ? makeSound(what, indexForType)
      : what === "trigger"
        ? makeTrigger(indexForType)
        : what === "control-lfo"
          ? makeControl("lfo", indexForType)
          : what === "control-drift"
            ? makeControl("drift", indexForType)
            : what === "control-stepped"
              ? makeControl("stepped", indexForType)
              : makeVisual(what, indexForType);
    setModuleGridPosition(created as Patch["modules"][number], destination);
    nextPatch.modules.push(created as Patch["modules"][number]);

    params.pushHistory(prev);
    params.sched.setPatch(nextPatch, { regen: true });
    params.sched.regenAll();
    params.saveAndPersist();
    rerender();
  };

  const rerender = () => {
    visibleColumns = readVisibleColumnCount(params.main);

    const patch = params.patch();
    const routing = buildRoutingSnapshot(patch);
    params.main.innerHTML = "";

    const workspaceViewport = document.createElement("div");
    workspaceViewport.className = "workspaceViewport";

    const workspaceViewportInner = document.createElement("div");
    workspaceViewportInner.className = "workspaceViewportInner";

    const workspaceGrid = document.createElement("div");
    workspaceGrid.className = "grid workspaceGrid";

    workspaceViewport.appendChild(workspaceViewportInner);
    workspaceViewportInner.appendChild(workspaceGrid);
    params.main.appendChild(workspaceViewport);
    updaters = [];

    const triggers = getTriggers(patch);
    const controls = getControls(patch);
    const triggerOptions = triggers.map((t) => ({ id: t.id, label: `${t.name} (${t.id.slice(-4)})` }));
    const controlOptions = controls.map((c) => ({ id: c.id, label: `${c.name} (${c.kind})` }));

    const surfaceByModuleId = new Map<string, HTMLElement>();
    const focusableByPosition = new Map<string, HTMLElement>();

    const focusPosition = (position: GridPosition) => {
      focusableByPosition.get(gridPositionKey(position))?.focus();
    };

    const handleGridNavigation = (surface: HTMLElement, position: GridPosition) => {
      surface.addEventListener("keydown", (e) => {
        if (e.target !== surface) return;
        if (e.key === "ArrowLeft") {
          if (position.x <= 0) return;
          e.preventDefault();
          focusPosition({ x: position.x - 1, y: position.y });
        } else if (e.key === "ArrowRight") {
          if (position.x >= renderedColumns - 1) return;
          e.preventDefault();
          focusPosition({ x: position.x + 1, y: position.y });
        } else if (e.key === "ArrowUp") {
          if (position.y <= 0) return;
          e.preventDefault();
          focusPosition({ x: position.x, y: position.y - 1 });
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          focusPosition({ x: position.x, y: position.y + 1 });
        } else if (e.key === "Enter") {
          e.preventDefault();
          focusFirstInteractive(surface);
        }
      });
    };

    const applyRoutingHighlight = () => {
      const inspected = inspectedModuleId ? patch.modules.find((module) => module.id === inspectedModuleId) : null;
      const related = inspected ? new Set(getConnectedModuleIds(routing, inspected)) : new Set<string>();

      for (const [moduleId, surface] of surfaceByModuleId.entries()) {
        surface.classList.toggle("routingInspect", moduleId === inspectedModuleId);
        surface.classList.toggle("routingLinked", related.has(moduleId));
      }
    };

    const onRoutingChange = (fn: (patch: Patch) => void, opts?: { regen?: boolean }) => {
      params.onPatchChange(fn, opts);
      rerender();
    };

    const registerModuleSurface = (moduleId: string, moduleKind: string, surface: HTMLElement, position: GridPosition) => {
      surface.draggable = true;
      surface.tabIndex = 0;
      surface.classList.add("draggableModule");
      surface.dataset.moduleId = moduleId;
      surface.dataset.gridX = String(position.x);
      surface.dataset.gridY = String(position.y);
      surface.setAttribute("aria-label", `Module ${moduleId.slice(-4)} at ${position.x + 1}, ${position.y + 1}`);
      surfaceByModuleId.set(moduleId, surface);
      focusableByPosition.set(gridPositionKey(position), surface);
      handleGridNavigation(surface, position);

      const inspect = () => {
        inspectedModuleId = moduleId;
        applyRoutingHighlight();
      };

      surface.addEventListener("dragstart", (e) => {
        surface.classList.add("dragging");
        e.dataTransfer?.setData("text/module-id", moduleId);
        e.dataTransfer?.setData("text/module-kind", moduleKind);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      });
      surface.addEventListener("dragend", () => surface.classList.remove("dragging"));
      surface.addEventListener("pointerdown", inspect);
      surface.addEventListener("focusin", inspect);
    };

    const renderModuleSurface = (module: Patch["modules"][number], position: GridPosition) => {
      const surfaceRoot = document.createElement("div");

      if (module.type === "trigger") {
        const upd = renderTriggerSurface(
          surfaceRoot,
          module,
          routing,
          params.onPatchChange,
          onRoutingChange,
          controlOptions,
          params.attachTooltip,
          () => removeModule(module.id),
        );
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, "trigger", surface, position);
        updaters.push(upd);
        return surface;
      }

      if (module.type === "drum") {
        const upd = renderDrumModuleSurface({
          root: surfaceRoot,
          v: module,
          routing,
          getLedState: params.led,
          onPatchChange: params.onPatchChange,
          onRoutingChange,
          ui: { tab: params.getVoiceTab(module.id), setTab: (tab) => params.setVoiceTab(module.id, tab) },
          triggerOptions,
          controlOptions,
          onRemove: () => removeModule(module.id),
        });
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, "drum", surface, position);
        updaters.push(upd);
        return surface;
      }

      if (module.type === "tonal") {
        const upd = renderSynthModuleSurface({
          root: surfaceRoot,
          v: module,
          routing,
          getLedState: params.led,
          onPatchChange: params.onPatchChange,
          onRoutingChange,
          ui: { tab: params.getVoiceTab(module.id), setTab: (tab) => params.setVoiceTab(module.id, tab) },
          triggerOptions,
          controlOptions,
          onRemove: () => removeModule(module.id),
        });
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, "tonal", surface, position);
        updaters.push(upd);
        return surface;
      }

      if (module.type === "control") {
        const upd = renderControlSurface(surfaceRoot, module, routing, params.onPatchChange, () => removeModule(module.id));
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, "control", surface, position);
        updaters.push(upd);
        return surface;
      }

      if (module.type === "visual") {
        const upd = renderVisualSurface(surfaceRoot, params.engine, module, routing, () => removeModule(module.id));
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, module.kind, surface, position);
        updaters.push(upd);
        return surface;
      }
      return surfaceRoot;
    };

    const { modulesByPosition, maxOccupiedX, totalRows } = resolveGridLayout(patch.modules);
    renderedColumns = Math.max(visibleColumns, maxOccupiedX + 1, MIN_VISIBLE_COLUMNS);
    workspaceGrid.style.setProperty("--workspace-visible-columns", String(visibleColumns));
    workspaceGrid.style.setProperty("--workspace-render-columns", String(renderedColumns));

    if (inspectedModuleId && !patch.modules.some((module) => module.id === inspectedModuleId)) inspectedModuleId = null;

    for (let y = 0; y < totalRows; y++) {
      for (let x = 0; x < renderedColumns; x++) {
        const position = { x, y };
        const slotIndex = y * renderedColumns + x;
        const module = modulesByPosition.get(gridPositionKey(position));
        if (module) {
          const surface = renderModuleSurface(module, position);
          workspaceGrid.appendChild(createModuleCell(surface, { occupied: true, index: slotIndex, position }));
          continue;
        }

        const slot = renderAddModuleSlot({
          position,
          onPick: (what) => createModuleAt(what, position),
          onDropModule: (moduleId) => moveModuleToCell(moduleId, position),
          attachTooltip: params.attachTooltip,
        });
        focusableByPosition.set(gridPositionKey(position), slot);
        handleGridNavigation(slot, position);
        slot.addEventListener("focusin", () => {
          inspectedModuleId = null;
          applyRoutingHighlight();
        });
        slot.addEventListener("pointerdown", () => {
          inspectedModuleId = null;
          applyRoutingHighlight();
        });
        workspaceGrid.appendChild(createModuleCell(slot, { occupied: false, index: slotIndex, position }));
      }
    }

    applyRoutingHighlight();
  };

  const resizeObserver = typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver(() => {
      const nextVisibleColumns = readVisibleColumnCount(params.main);
      if (nextVisibleColumns === visibleColumns) return;
      visibleColumns = nextVisibleColumns;
      rerender();
    });
  resizeObserver?.observe(params.main);

  return { rerender, updateFrame: () => { for (const update of updaters) update(); } };
}
