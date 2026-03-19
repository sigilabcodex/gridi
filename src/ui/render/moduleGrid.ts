import type { Scheduler } from "../../engine/scheduler";
import type { Engine } from "../../engine/audio";
import type { Patch, VisualKind } from "../../patch";
import { getControls, getTriggers, makeControl, makeSound, makeTrigger, makeVisual } from "../../patch";
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
const WORKSPACE_COLUMNS = 3;

function createModuleCell(surface: HTMLElement, opts: { occupied: boolean; index: number }) {
  const cell = document.createElement("div");
  cell.className = `moduleCell ${opts.occupied ? "occupied" : "empty"}`;
  cell.dataset.slotIndex = String(opts.index);

  const substrate = document.createElement("div");
  substrate.className = "moduleCellSubstrate";

  const bed = document.createElement("div");
  bed.className = "moduleCellBed";

  cell.append(substrate, bed);
  cell.appendChild(surface);
  return cell;
}

function getModuleSlotIndex(module: Patch["modules"][number], columns = WORKSPACE_COLUMNS) {
  if (
    Number.isInteger(module.x) && Number.isInteger(module.y)
    && (module.x as number) >= 0 && (module.y as number) >= 0
  ) {
    return (module.y as number) * columns + (module.x as number);
  }
  return null;
}

function setModuleSlot(module: Patch["modules"][number], slotIndex: number, columns = WORKSPACE_COLUMNS) {
  module.x = slotIndex % columns;
  module.y = Math.floor(slotIndex / columns);
}

function resolveWorkspaceSlots(modules: Patch["modules"], columns = WORKSPACE_COLUMNS) {
  const modulesBySlot = new Map<number, Patch["modules"][number]>();
  const slotByModuleId = new Map<string, number>();
  let nextDenseSlot = 0;

  const claimSlot = (preferred: number | null, module: Patch["modules"][number]) => {
    let slotIndex = preferred;
    if (slotIndex == null || modulesBySlot.has(slotIndex)) {
      while (modulesBySlot.has(nextDenseSlot)) nextDenseSlot++;
      slotIndex = nextDenseSlot;
    }
    modulesBySlot.set(slotIndex, module);
    slotByModuleId.set(module.id, slotIndex);
    nextDenseSlot = Math.max(nextDenseSlot, slotIndex + 1);
    return slotIndex;
  };

  for (const module of modules) claimSlot(getModuleSlotIndex(module, columns), module);

  const highestOccupiedSlot = Math.max(-1, ...modulesBySlot.keys());
  const atLeastOneRow = Math.max(columns, highestOccupiedSlot + 2);
  return {
    modulesBySlot,
    slotByModuleId,
    totalCells: Math.ceil(atLeastOneRow / columns) * columns,
  };
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

  const moveModuleToCell = (moduleId: string, insertionIndex: number) => {
    const prev = params.clonePatch(params.patch());
    const nextPatch = params.patch();
    const module = nextPatch.modules.find((m) => m.id === moduleId);
    if (!module) return;

    const { totalCells, slotByModuleId } = resolveWorkspaceSlots(nextPatch.modules);
    if (insertionIndex < 0 || insertionIndex >= totalCells) return;

    const currentSlot = slotByModuleId.get(module.id);
    if (currentSlot === insertionIndex) return;
    setModuleSlot(module, insertionIndex);

    params.pushHistory(prev);
    params.sched.setPatch(nextPatch, { regen: false });
    params.saveAndPersist();
    rerender();
  };

  const createModuleAt = (what: Pick, insertionIndex: number) => {
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
    setModuleSlot(created as Patch["modules"][number], insertionIndex);
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

    const { modulesBySlot, totalCells } = resolveWorkspaceSlots(patch.modules);

    for (let slotIndex = 0; slotIndex < totalCells; slotIndex++) {
      const module = modulesBySlot.get(slotIndex);
      if (module) {
        const surface = renderModuleSurface(module);
        workspaceGrid.appendChild(createModuleCell(surface, { occupied: true, index: slotIndex }));
        continue;
      }

      const slot = renderAddModuleSlot({
        insertionIndex: slotIndex,
        onPick: (what) => createModuleAt(what, slotIndex),
        onDropModule: (moduleId) => moveModuleToCell(moduleId, slotIndex),
      });
      workspaceGrid.appendChild(createModuleCell(slot, { occupied: false, index: slotIndex }));
    }
  };

  return { rerender, updateFrame: () => { for (const update of updaters) update(); } };
}
