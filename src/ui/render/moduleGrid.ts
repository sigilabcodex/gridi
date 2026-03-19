import type { Scheduler } from "../../engine/scheduler";
import type { Engine } from "../../engine/audio";
import type { Patch, VisualKind } from "../../patch";
import { getControls, getTriggers, makeControl, makeSound, makeTrigger, makeVisual } from "../../patch";
import {
  gridPositionKey,
  gridPositionToSlotIndex,
  resolveGridLayout,
  setModuleGridPosition,
  slotIndexToGridPosition,
  type GridPosition,
} from "../../workspacePlacement.ts";
import type { VoiceTab } from "../voiceModule";
import { renderDrumModuleSurface, renderSynthModuleSurface } from "../voiceModule";
import { renderTriggerSurface } from "../triggerModule";
import { renderControlSurface } from "../controlModule";
import { renderVisualSurface } from "../visualModule";
import { renderAddModuleSlot } from "../AddModuleSlot";

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
};

type Pick = "drum" | "tonal" | "trigger" | "control-lfo" | "control-drift" | "control-stepped" | VisualKind;

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

export function createModuleGridRenderer(params: ModuleGridParams) {
  let updaters: Array<() => void> = [];

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

    const { slotByModuleId } = resolveGridLayout(nextPatch.modules);
    const destinationSlot = gridPositionToSlotIndex(destination);
    const currentSlot = slotByModuleId.get(module.id);
    if (currentSlot === destinationSlot) return;

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
              : m.type === "visual"
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
    const patch = params.patch();
    params.main.innerHTML = "";

    const workspaceGrid = document.createElement("div");
    workspaceGrid.className = "grid workspaceGrid";
    params.main.appendChild(workspaceGrid);
    updaters = [];

    const triggers = getTriggers(patch);
    const controls = getControls(patch);
    const triggerOptions = triggers.map((t) => ({ id: t.id, label: `${t.name} (${t.id.slice(-4)})` }));
    const controlOptions = controls.map((c) => ({ id: c.id, label: `${c.name} (${c.kind})` }));

    const registerModuleSurface = (moduleId: string, moduleKind: string, surface: HTMLElement) => {
      surface.draggable = true;
      surface.classList.add("draggableModule");
      surface.dataset.moduleId = moduleId;

      surface.addEventListener("dragstart", (e) => {
        surface.classList.add("dragging");
        e.dataTransfer?.setData("text/module-id", moduleId);
        e.dataTransfer?.setData("text/module-kind", moduleKind);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      });
      surface.addEventListener("dragend", () => surface.classList.remove("dragging"));
    };

    const renderModuleSurface = (module: Patch["modules"][number]) => {
      const surfaceRoot = document.createElement("div");

      if (module.type === "trigger") {
        const upd = renderTriggerSurface(surfaceRoot, module, params.onPatchChange, controlOptions, () => removeModule(module.id));
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, "trigger", surface);
        updaters.push(upd);
        return surface;
      }

      if (module.type === "drum") {
        const upd = renderDrumModuleSurface({
          root: surfaceRoot,
          v: module,
          getLedState: params.led,
          onPatchChange: params.onPatchChange,
          ui: { tab: params.getVoiceTab(module.id), setTab: (tab) => params.setVoiceTab(module.id, tab) },
          triggerOptions,
          controlOptions,
          onRemove: () => removeModule(module.id),
        });
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, "drum", surface);
        updaters.push(upd);
        return surface;
      }

      if (module.type === "tonal") {
        const upd = renderSynthModuleSurface({
          root: surfaceRoot,
          v: module,
          getLedState: params.led,
          onPatchChange: params.onPatchChange,
          ui: { tab: params.getVoiceTab(module.id), setTab: (tab) => params.setVoiceTab(module.id, tab) },
          triggerOptions,
          controlOptions,
          onRemove: () => removeModule(module.id),
        });
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, "tonal", surface);
        updaters.push(upd);
        return surface;
      }

      if (module.type === "control") {
        const upd = renderControlSurface(surfaceRoot, module, params.onPatchChange, () => removeModule(module.id));
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, "control", surface);
        updaters.push(upd);
        return surface;
      }

      if (module.type === "visual") {
        const upd = renderVisualSurface(surfaceRoot, params.engine, patch, module, () => removeModule(module.id));
        const surface = surfaceRoot.firstElementChild as HTMLElement;
        registerModuleSurface(module.id, module.kind, surface);
        updaters.push(upd);
        return surface;
      }
      return surfaceRoot;
    };

    const { modulesByPosition, totalCells } = resolveGridLayout(patch.modules);

    for (let slotIndex = 0; slotIndex < totalCells; slotIndex++) {
      const position = slotIndexToGridPosition(slotIndex);
      const module = modulesByPosition.get(gridPositionKey(position));
      if (module) {
        const surface = renderModuleSurface(module);
        workspaceGrid.appendChild(createModuleCell(surface, { occupied: true, index: slotIndex, position }));
        continue;
      }

      const slot = renderAddModuleSlot({
        position,
        onPick: (what) => createModuleAt(what, position),
        onDropModule: (moduleId) => moveModuleToCell(moduleId, position),
      });
      workspaceGrid.appendChild(createModuleCell(slot, { occupied: false, index: slotIndex, position }));
    }
  };

  return { rerender, updateFrame: () => { for (const update of updaters) update(); } };
}
