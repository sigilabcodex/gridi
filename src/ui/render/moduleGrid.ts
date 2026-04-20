import type { Scheduler } from "../../engine/scheduler";
import type { Engine } from "../../engine/audio";
import type { Patch, VisualKind } from "../../patch";
import { getControls, getTriggers, makeControl, makeSound, makeTrigger, makeVisual } from "../../patch";
import {
  getModuleGridPosition,
  gridPositionKey,
  gridPositionToSlotIndex,
  slotIndexToGridPosition,
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
import type { ModulePresetRecord } from "../persistence/modulePresetStore";
import { sampleControlValue01WhenActive } from "../modulationView";

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
  modulePresetRecords: ModulePresetRecord[];
  onLoadModulePreset: (moduleId: string, presetId: string) => void;
  onSaveModulePreset: (moduleId: string, name: string, overwritePresetId?: string | null) => void;
  onInspectModule?: (moduleId: string) => void;
  isMidiTargetModule?: (moduleId: string) => boolean;
};

type Pick = "drum" | "tonal" | "trigger" | "control-lfo" | "control-drift" | "control-stepped" | VisualKind;

const MIN_VISIBLE_COLUMNS = 1;
const MOBILE_BREAKPOINT = 760;
const MOBILE_PORTRAIT_MAX_COLUMNS = 1;
const MOBILE_LANDSCAPE_DEFAULT_COLUMNS = 2;
const MOBILE_LANDSCAPE_MAX_COLUMNS = 3;
const MOBILE_LANDSCAPE_MAX_WIDTH = 960;
const MOBILE_LANDSCAPE_MAX_HEIGHT = 560;
const TABLET_MAX_WIDTH = 1180;
const CLEAN_FIT_ALLOWANCE_PX = 24;
const CLEAN_FIT_ALLOWANCE_NARROW_PX = 42;

function fitsCleanColumns(
  availableWidth: number,
  columns: number,
  cellWidth: number,
  gap: number,
  padding: number,
  allowance: number,
) {
  if (columns <= 1) return true;
  const requiredWidth = padding + (cellWidth * columns) + (gap * (columns - 1)) + allowance;
  return availableWidth >= requiredWidth;
}

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

function createModuleRenderErrorSurface(moduleId: string, moduleType: string) {
  const moduleFamilyLabel =
    moduleType === "trigger" ? "GEN" : moduleType === "visual" ? "VIS" : moduleType.toUpperCase();
  const surface = document.createElement("section");
  surface.className = "moduleSurface moduleSurfaceRenderError";
  surface.dataset.type = moduleType;

  const header = document.createElement("div");
  header.className = "surfaceHeader";
  const title = document.createElement("strong");
  title.textContent = `Render error · ${moduleFamilyLabel}`;
  const id = document.createElement("span");
  id.className = "small moduleId";
  id.textContent = moduleId.slice(-6).toUpperCase();
  header.append(title, id);

  const body = document.createElement("div");
  body.className = "surfaceFace";
  const panel = document.createElement("div");
  panel.className = "surfaceTabPanel";
  panel.textContent = "Module failed to render. Open console for details.";
  body.appendChild(panel);

  const tabs = document.createElement("div");
  tabs.className = "surfaceTabs";
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "modTab active";
  tab.textContent = "Error";
  tab.disabled = true;
  tabs.appendChild(tab);

  surface.append(header, body, tabs);
  return surface;
}

function formatUnknownError(error: unknown) {
  if (typeof error === "string") return error;
  if (error === null) return "null";
  if (typeof error === "undefined") return "undefined";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
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

function measureCssVariablePx(main: HTMLElement, variableName: string, fallback: number) {
  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.inlineSize = `var(${variableName})`;
  main.appendChild(probe);
  const measured = probe.getBoundingClientRect().width;
  probe.remove();
  if (Number.isFinite(measured) && measured > 0) return measured;
  const rootStyles = getComputedStyle(document.documentElement);
  return parseCssLengthPx(rootStyles.getPropertyValue(variableName), fallback);
}

function isMobilePortraitViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px) and (orientation: portrait)`).matches;
}

function isMobileLandscapeViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(
    `(orientation: landscape) and (max-width: ${MOBILE_LANDSCAPE_MAX_WIDTH}px) and (max-height: ${MOBILE_LANDSCAPE_MAX_HEIGHT}px)`,
  ).matches;
}

function isConstrainedWorkspaceViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(`(max-width: ${TABLET_MAX_WIDTH}px)`).matches;
}

function readVisibleColumnCount(main: HTMLElement) {
  const rootStyles = getComputedStyle(document.documentElement);
  const cellWidth = measureCssVariablePx(main, "--module-cell-w", 330);
  const gap = parseCssLengthPx(rootStyles.getPropertyValue("--workspace-grid-gap"), 10);
  const padding = parseCssLengthPx(rootStyles.getPropertyValue("--workspace-grid-pad"), 8) * 2;
  const availableWidth = Math.max(main.clientWidth, cellWidth + padding);
  const fitted = Math.floor((availableWidth - padding + gap) / (cellWidth + gap));
  const fittedColumns = Math.max(MIN_VISIBLE_COLUMNS, fitted || 0);
  const cleanFittedColumns = Math.max(
    MIN_VISIBLE_COLUMNS,
    fitsCleanColumns(availableWidth, fittedColumns, cellWidth, gap, padding, CLEAN_FIT_ALLOWANCE_PX)
      ? fittedColumns
      : fittedColumns - 1,
  );

  if (isMobilePortraitViewport()) {
    return Math.min(MOBILE_PORTRAIT_MAX_COLUMNS, cleanFittedColumns);
  }

  if (isMobileLandscapeViewport()) {
    if (cleanFittedColumns < 2) return MIN_VISIBLE_COLUMNS;
    if (!fitsCleanColumns(availableWidth, 2, cellWidth, gap, padding, CLEAN_FIT_ALLOWANCE_NARROW_PX)) return MIN_VISIBLE_COLUMNS;

    if (cleanFittedColumns >= MOBILE_LANDSCAPE_MAX_COLUMNS) {
      if (fitsCleanColumns(availableWidth, 3, cellWidth, gap, padding, CLEAN_FIT_ALLOWANCE_NARROW_PX)) {
        return MOBILE_LANDSCAPE_MAX_COLUMNS;
      }
    }

    return MOBILE_LANDSCAPE_DEFAULT_COLUMNS;
  }

  return cleanFittedColumns;
}

function readPositionFromKey(key: string): GridPosition | null {
  const [xRaw, yRaw] = key.split(",");
  const x = Number.parseInt(xRaw ?? "", 10);
  const y = Number.parseInt(yRaw ?? "", 10);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
}

export function createModuleGridRenderer(params: ModuleGridParams) {
  let updaters: Array<() => void> = [];
  const failedUpdaterIndices = new Set<number>();
  let inspectedModuleId: string | null = null;
  let visibleColumns = readVisibleColumnCount(params.main);
  let renderedColumns = visibleColumns;
  let movedModuleIds = new Set<string>();
  let latestPatch: Patch | null = null;
  let latestRouting = buildRoutingSnapshot(params.patch());
  let surfaceByModuleId = new Map<string, HTMLElement>();

  const applyRoutingHighlight = () => {
    const patch = latestPatch;
    if (!patch) return;
    const inspected = inspectedModuleId ? patch.modules.find((module) => module.id === inspectedModuleId) : null;
    const related = inspected ? new Set(getConnectedModuleIds(latestRouting, inspected)) : new Set<string>();

    for (const [moduleId, surface] of surfaceByModuleId.entries()) {
      surface.classList.toggle("routingInspect", moduleId === inspectedModuleId);
      surface.classList.toggle("routingLinked", related.has(moduleId));
      surface.classList.toggle("midiTargetModule", params.isMidiTargetModule?.(moduleId) ?? false);
    }
  };

  type ScrollSnapshot = {
    windowX: number;
    windowY: number;
    viewportScrollLeft: number;
    lockHorizontal: boolean;
  };

  const snapshotScrollPosition = (): ScrollSnapshot => {
    const viewport = params.main.querySelector<HTMLElement>(".workspaceViewport");
    const lockHorizontal = isConstrainedWorkspaceViewport();
    return {
      windowX: window.scrollX,
      windowY: window.scrollY,
      viewportScrollLeft: lockHorizontal ? 0 : (viewport?.scrollLeft ?? 0),
      lockHorizontal,
    };
  };

  const restoreScrollPosition = (snapshot: ScrollSnapshot) => {
    const viewport = params.main.querySelector<HTMLElement>(".workspaceViewport");
    if (viewport) viewport.scrollLeft = snapshot.lockHorizontal ? 0 : snapshot.viewportScrollLeft;
    window.scrollTo(snapshot.windowX, snapshot.windowY);
    requestAnimationFrame(() => {
      const refreshedViewport = params.main.querySelector<HTMLElement>(".workspaceViewport");
      if (refreshedViewport) refreshedViewport.scrollLeft = snapshot.lockHorizontal ? 0 : snapshot.viewportScrollLeft;
      window.scrollTo(snapshot.windowX, snapshot.windowY);
    });
  };

  const rerenderStable = () => {
    const scrollSnapshot = snapshotScrollPosition();
    rerender();
    restoreScrollPosition(scrollSnapshot);
  };

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
    params.engine.syncRouting(nextPatch);
    params.saveAndPersist();
    rerenderStable();
  };

  const moveModuleToCell = (moduleId: string, destination: GridPosition) => {
    const prev = params.clonePatch(params.patch());
    const nextPatch = params.patch();
    const module = nextPatch.modules.find((m) => m.id === moduleId);
    if (!module) return;

    const currentPosition = getModuleGridPosition(module);
    if (currentPosition && gridPositionKey(currentPosition) === gridPositionKey(destination)) return;

    setModuleGridPosition(module, destination);
    movedModuleIds = new Set([moduleId]);

    params.pushHistory(prev);
    params.sched.setPatch(nextPatch, { regen: false });
    params.saveAndPersist();
    rerenderStable();
  };

  const swapModulesById = (sourceModuleId: string, targetModuleId: string) => {
    if (sourceModuleId === targetModuleId) return;

    const prev = params.clonePatch(params.patch());
    const nextPatch = params.patch();
    const sourceModule = nextPatch.modules.find((m) => m.id === sourceModuleId);
    const targetModule = nextPatch.modules.find((m) => m.id === targetModuleId);
    if (!sourceModule || !targetModule) return;

    const sourcePosition = getModuleGridPosition(sourceModule);
    const targetPosition = getModuleGridPosition(targetModule);
    if (!sourcePosition || !targetPosition) return;

    setModuleGridPosition(sourceModule, targetPosition);
    setModuleGridPosition(targetModule, sourcePosition);
    movedModuleIds = new Set([sourceModuleId, targetModuleId]);

    params.pushHistory(prev);
    params.sched.setPatch(nextPatch, { regen: false });
    params.saveAndPersist();
    rerenderStable();
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
    params.engine.syncRouting(nextPatch);
    params.saveAndPersist();
    rerenderStable();
  };

  const rerender = () => {
    failedUpdaterIndices.clear();
    visibleColumns = readVisibleColumnCount(params.main);

    const patch = params.patch();
    const routing = buildRoutingSnapshot(patch);
    latestPatch = patch;
    latestRouting = routing;
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

    surfaceByModuleId = new Map<string, HTMLElement>();
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

    const onRoutingChange = (fn: (patch: Patch) => void, opts?: { regen?: boolean }) => {
      params.onPatchChange(fn, opts);
      rerender();
    };
    const sampleModulationValue = (controlId: string | null | undefined) =>
      sampleControlValue01WhenActive(
        params.patch(),
        controlId,
        performance.now() / 1000,
        params.sched.running && params.engine.ctx.state === "running",
      );

    const registerModuleSurface = (moduleId: string, moduleKind: string, surface: HTMLElement, position: GridPosition) => {
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
        params.onInspectModule?.(moduleId);
        applyRoutingHighlight();
      };

      const dragHandle = surface.querySelector<HTMLElement>(".surfaceBadge");
      if (!dragHandle) {
        console.warn("[module-grid] drag handle not found for module", moduleId);
      } else {
        dragHandle.classList.add("module-drag-handle");
        dragHandle.draggable = true;
        dragHandle.setAttribute("aria-label", `Drag module ${moduleId.slice(-4)} to another slot`);

        dragHandle.addEventListener("dragstart", (e) => {
          surface.classList.add("dragging");
          surface.closest(".moduleCell")?.classList.add("dragSource");
          params.main.classList.add("moduleDragActive");
          e.dataTransfer?.setData("text/module-id", moduleId);
          e.dataTransfer?.setData("text/module-kind", moduleKind);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
        });
        dragHandle.addEventListener("dragend", () => {
          surface.classList.remove("dragging");
          surface.closest(".moduleCell")?.classList.remove("dragSource");
          params.main.classList.remove("moduleDragActive");
          params.main.querySelectorAll(".moduleCell.dragSwapReady, .moduleCell.dragMoveReady").forEach((cell) => {
            cell.classList.remove("dragSwapReady", "dragMoveReady");
          });
        });
      }
      surface.addEventListener("pointerdown", inspect);
      surface.addEventListener("focusin", inspect);
      surface.addEventListener("dragenter", (e) => {
        e.preventDefault();
        surface.classList.add("dragSwapReady");
        surface.closest(".moduleCell")?.classList.add("dragSwapReady");
      });
      surface.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        surface.classList.add("dragSwapReady");
        surface.closest(".moduleCell")?.classList.add("dragSwapReady");
      });
      surface.addEventListener("dragleave", () => {
        surface.classList.remove("dragSwapReady");
        surface.closest(".moduleCell")?.classList.remove("dragSwapReady");
      });
      surface.addEventListener("drop", (e) => {
        e.preventDefault();
        surface.classList.remove("dragSwapReady");
        surface.closest(".moduleCell")?.classList.remove("dragSwapReady");
        const droppedModuleId = e.dataTransfer?.getData("text/module-id") ?? "";
        if (!droppedModuleId) return;
        swapModulesById(droppedModuleId, moduleId);
      });
    };

    const resolveRenderedSurface = (moduleRoot: HTMLElement, moduleType: string, moduleId: string) => {
      const surface = moduleRoot.firstElementChild;
      if (!(surface instanceof HTMLElement)) {
        throw new Error(`Renderer for module ${moduleId} (${moduleType}) did not append a root HTMLElement.`);
      }
      return surface;
    };

    const renderModuleSurface = (module: Patch["modules"][number], position: GridPosition) => {
      const surfaceRoot = document.createElement("div");
      let rendererPath = "unknown";

      try {
        if (module.type === "trigger") {
          rendererPath = "renderTriggerSurface";
          const upd = renderTriggerSurface(
            surfaceRoot,
            module,
            routing,
            () => params.sched.running,
            params.onPatchChange,
            onRoutingChange,
            sampleModulationValue,
            controlOptions,
            params.attachTooltip,
            params.modulePresetRecords,
            params.onLoadModulePreset,
            params.onSaveModulePreset,
            () => removeModule(module.id),
          );
          const surface = resolveRenderedSurface(surfaceRoot, "trigger", module.id);
          registerModuleSurface(module.id, "trigger", surface, position);
          updaters.push(upd);
          return surface;
        }

        if (module.type === "drum") {
          rendererPath = "renderDrumModuleSurface";
          const upd = renderDrumModuleSurface({
            root: surfaceRoot,
            v: module,
            routing,
            getLedState: params.led,
            onPatchChange: params.onPatchChange,
            onRoutingChange,
            sampleModulationValue,
            ui: { tab: params.getVoiceTab(module.id), setTab: (tab) => params.setVoiceTab(module.id, tab) },
            triggerOptions,
            controlOptions,
            onLoadModulePreset: params.onLoadModulePreset,
            onSaveModulePreset: params.onSaveModulePreset,
            modulePresetRecords: params.modulePresetRecords,
            attachTooltip: params.attachTooltip,
            onRemove: () => removeModule(module.id),
          });
          const surface = resolveRenderedSurface(surfaceRoot, "drum", module.id);
          registerModuleSurface(module.id, "drum", surface, position);
          updaters.push(upd);
          return surface;
        }

        if (module.type === "tonal") {
          rendererPath = "renderSynthModuleSurface";
          const upd = renderSynthModuleSurface({
            root: surfaceRoot,
            v: module,
            routing,
            getLedState: params.led,
            onPatchChange: params.onPatchChange,
            onRoutingChange,
            sampleModulationValue,
            ui: { tab: params.getVoiceTab(module.id), setTab: (tab) => params.setVoiceTab(module.id, tab) },
            triggerOptions,
            controlOptions,
            onLoadModulePreset: params.onLoadModulePreset,
            onSaveModulePreset: params.onSaveModulePreset,
            modulePresetRecords: params.modulePresetRecords,
            attachTooltip: params.attachTooltip,
            onRemove: () => removeModule(module.id),
          });
          const surface = resolveRenderedSurface(surfaceRoot, "tonal", module.id);
          registerModuleSurface(module.id, "tonal", surface, position);
          updaters.push(upd);
          return surface;
        }

        if (module.type === "control") {
          rendererPath = "renderControlSurface";
          const upd = renderControlSurface(
            surfaceRoot,
            module,
            routing,
            () => params.sched.running,
            params.onPatchChange,
            onRoutingChange,
            params.modulePresetRecords,
            params.onLoadModulePreset,
            params.onSaveModulePreset,
            params.attachTooltip,
            () => removeModule(module.id),
          );
          const surface = resolveRenderedSurface(surfaceRoot, "control", module.id);
          registerModuleSurface(module.id, "control", surface, position);
          updaters.push(upd);
          return surface;
        }

        if (module.type === "visual") {
          rendererPath = "renderVisualSurface";
          const upd = renderVisualSurface(
            surfaceRoot,
            params.engine,
            module,
            routing,
            () => params.sched.running,
            params.onPatchChange,
            () => removeModule(module.id),
            params.modulePresetRecords,
            params.onLoadModulePreset,
            params.onSaveModulePreset,
            params.attachTooltip,
          );
          const surface = resolveRenderedSurface(surfaceRoot, module.kind, module.id);
          registerModuleSurface(module.id, module.kind, surface, position);
          updaters.push(upd);
          return surface;
        }
      } catch (error) {
        const errorDetails = error instanceof Error
          ? {
            isErrorInstance: true,
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
          : {
            isErrorInstance: false,
            name: typeof error,
            message: formatUnknownError(error),
            stack: undefined,
          };

        console.error("[moduleGrid] module renderer exception", {
          moduleFamily: module.type,
          moduleId: module.id,
          rendererPath,
          ...errorDetails,
          rawError: error,
        });
        return createModuleRenderErrorSurface(module.id, module.type);
      }

      return createModuleRenderErrorSurface(module.id, module.type);
    };

    const { modulesByPosition, maxOccupiedX, totalRows } = resolveGridLayout(patch.modules);
    const constrainedViewport = isConstrainedWorkspaceViewport();
    renderedColumns = constrainedViewport
      ? Math.max(visibleColumns, MIN_VISIBLE_COLUMNS)
      : Math.max(visibleColumns, maxOccupiedX + 1, MIN_VISIBLE_COLUMNS);
    const rootStyles = getComputedStyle(document.documentElement);
    const cellWidth = measureCssVariablePx(params.main, "--module-cell-w", 330);
    const gap = parseCssLengthPx(rootStyles.getPropertyValue("--workspace-grid-gap"), 10);
    const padding = parseCssLengthPx(rootStyles.getPropertyValue("--workspace-grid-pad"), 8) * 2;
    const visibleSpanWidth = (visibleColumns * cellWidth) + (Math.max(visibleColumns - 1, 0) * gap) + padding;
    const sideGutter = Math.max(0, Math.floor((params.main.clientWidth - visibleSpanWidth) / 2));
    workspaceViewport.style.setProperty("--workspace-side-gutter", `${sideGutter}px`);
    workspaceGrid.style.setProperty("--workspace-visible-columns", String(visibleColumns));
    workspaceGrid.style.setProperty("--workspace-render-columns", String(renderedColumns));
    if (constrainedViewport) workspaceViewport.scrollLeft = 0;

    if (inspectedModuleId && !patch.modules.some((module) => module.id === inspectedModuleId)) inspectedModuleId = null;

    const renderEmptySlot = (displayPosition: GridPosition, targetPosition: GridPosition, slotIndex: number) => {
      const slot = renderAddModuleSlot({
        position: targetPosition,
        onPick: (what) => createModuleAt(what, targetPosition),
        onDropModule: (moduleId) => moveModuleToCell(moduleId, targetPosition),
        attachTooltip: params.attachTooltip,
      });
      focusableByPosition.set(gridPositionKey(displayPosition), slot);
      handleGridNavigation(slot, displayPosition);
      slot.addEventListener("focusin", () => {
        inspectedModuleId = null;
        applyRoutingHighlight();
      });
      slot.addEventListener("pointerdown", () => {
        inspectedModuleId = null;
        applyRoutingHighlight();
      });
      workspaceGrid.appendChild(createModuleCell(slot, { occupied: false, index: slotIndex, position: displayPosition }));
    };

    if (constrainedViewport) {
      const moduleEntries = Array.from(modulesByPosition.entries())
        .map(([key, module]) => {
          const sourcePosition = readPositionFromKey(key);
          if (!sourcePosition) return null;
          return {
            module,
            sourcePosition,
            sourceSlot: gridPositionToSlotIndex(sourcePosition),
          };
        })
        .filter((entry): entry is { module: Patch["modules"][number]; sourcePosition: GridPosition; sourceSlot: number } => Boolean(entry))
        .sort((a, b) => a.sourceSlot - b.sourceSlot);

      moduleEntries.forEach((entry, displaySlot) => {
        const displayPosition = slotIndexToGridPosition(displaySlot, renderedColumns);
        const surface = renderModuleSurface(entry.module, displayPosition);
        if (movedModuleIds.has(entry.module.id)) {
          surface.classList.add("dropSettled");
          requestAnimationFrame(() => surface.classList.remove("dropSettled"));
        }
        workspaceGrid.appendChild(
          createModuleCell(surface, {
            occupied: true,
            index: displaySlot,
            position: displayPosition,
          }),
        );
      });

      const emptySlots = renderedColumns * 2;
      const firstEmptySlot = moduleEntries.length;
      for (let offset = 0; offset < emptySlots; offset++) {
        const displaySlot = firstEmptySlot + offset;
        const displayPosition = slotIndexToGridPosition(displaySlot, renderedColumns);
        const canonicalPosition = slotIndexToGridPosition(displaySlot);
        renderEmptySlot(displayPosition, canonicalPosition, displaySlot);
      }
    } else {
      for (let y = 0; y < totalRows; y++) {
        for (let x = 0; x < renderedColumns; x++) {
          const position = { x, y };
          const slotIndex = y * renderedColumns + x;
          const module = modulesByPosition.get(gridPositionKey(position));
          if (module) {
            const surface = renderModuleSurface(module, position);
            if (movedModuleIds.has(module.id)) {
              surface.classList.add("dropSettled");
              requestAnimationFrame(() => surface.classList.remove("dropSettled"));
            }
            workspaceGrid.appendChild(createModuleCell(surface, { occupied: true, index: slotIndex, position }));
            continue;
          }

          renderEmptySlot(position, position, slotIndex);
        }
      }
    }

    applyRoutingHighlight();
    movedModuleIds.clear();
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

  return {
    rerender,
    setRoutingInspect: (moduleId: string | null) => {
      inspectedModuleId = moduleId;
      applyRoutingHighlight();
    },
    updateFrame: () => {
      for (let i = 0; i < updaters.length; i++) {
        const update = updaters[i];
        try {
          update();
        } catch (error) {
          if (!failedUpdaterIndices.has(i)) {
            failedUpdaterIndices.add(i);
            console.error("[module-grid] updater failed", error);
          }
        }
      }
    },
  };
}
