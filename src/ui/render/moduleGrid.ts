import type { Scheduler } from "../../engine/scheduler";
import type { Engine } from "../../engine/audio";
import type { Patch, VisualKind } from "../../patch";
import { getTriggers, makeSound, makeTrigger, makeVisual } from "../../patch";
import type { VoiceTab } from "../voiceModule";
import { renderDrumModuleSurface, renderSynthModuleSurface } from "../voiceModule";
import { renderTriggerSurface } from "../triggerModule";
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

type Family = "trigger" | "drum" | "tonal" | "visual";

function getFamily(module: Patch["modules"][number]): Family | "other" {
  if (module.type === "trigger") return "trigger";
  if (module.type === "drum") return "drum";
  if (module.type === "tonal") return "tonal";
  if (module.type === "visual") return "visual";
  return "other";
}

function addFamilyLane(grid: HTMLElement, family: Family, title: string, subtitle: string) {
  const lane = document.createElement("section");
  lane.className = "familyLane";
  lane.dataset.family = family;

  const head = document.createElement("div");
  head.className = "familyLaneHead";
  const t = document.createElement("div");
  t.className = "moduleSectionTitle";
  t.textContent = title;
  const s = document.createElement("div");
  s.className = "small moduleSectionSubtitle";
  s.textContent = subtitle;
  head.append(t, s);

  const body = document.createElement("div");
  body.className = "familyLaneBody";

  lane.append(head, body);
  grid.appendChild(lane);
  return body;
}

function createModuleCell(surface: HTMLElement) {
  const cell = document.createElement("div");
  cell.className = "moduleCell";
  cell.appendChild(surface);
  return cell;
}

function getTotalCells(moduleCount: number, columns = 3) {
  const atLeastOneRow = Math.max(columns, moduleCount + 1);
  return Math.ceil(atLeastOneRow / columns) * columns;
}

export function createModuleGridRenderer(params: ModuleGridParams) {
  let updaters: Array<() => void> = [];

  const createModule = (what: "drum" | "tonal" | "trigger" | VisualKind) => {
    const prev = params.clonePatch(params.patch());
    const nextPatch = params.patch();
    if (what === "drum" || what === "tonal") nextPatch.modules.push(makeSound(what));
    else if (what === "trigger") nextPatch.modules.push(makeTrigger());
    else nextPatch.modules.push(makeVisual(what));
    params.pushHistory(prev);
    params.sched.setPatch(nextPatch, { regen: true });
    params.sched.regenAll();
    params.saveAndPersist();
    rerender();
  };

  const rerender = () => {
    const patch = params.patch();
    params.main.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid";
    params.main.appendChild(grid);
    updaters = [];

    const triggers = getTriggers(patch);
    const triggerOptions = triggers.map((t) => ({ id: t.id, label: `${t.name} (${t.id.slice(-4)})` }));

    const lanes: Record<Family, HTMLElement> = {
      trigger: addFamilyLane(grid, "trigger", "Trigger Family", "Pulse logic and probability sources"),
      drum: addFamilyLane(grid, "drum", "Drum Family", "Percussive voice engines"),
      tonal: addFamilyLane(grid, "tonal", "Synth Family", "Tonal voice engines"),
      visual: addFamilyLane(grid, "visual", "Visual Family", "Signal display and monitoring"),
    };

    const familyModules: Record<Family, Patch["modules"]> = { trigger: [], drum: [], tonal: [], visual: [] };
    for (const module of patch.modules) {
      const family = getFamily(module);
      if (family !== "other") familyModules[family].push(module);
    }

    for (const module of familyModules.trigger) {
      const t = module;
      const surfaceRoot = document.createElement("div");
      const upd = renderTriggerSurface(surfaceRoot, t as any, params.onPatchChange, () => {
        const prev = params.clonePatch(params.patch());
        const nextPatch = params.patch();
        nextPatch.modules = nextPatch.modules.filter((m) => m.id !== t.id);
        for (const m of nextPatch.modules) {
          if ((m.type === "drum" || m.type === "tonal") && m.triggerSource === t.id) m.triggerSource = null;
        }
        params.pushHistory(prev);
        params.sched.setPatch(nextPatch, { regen: true });
        params.sched.regenAll();
        params.saveAndPersist();
        rerender();
      });
      lanes.trigger.appendChild(createModuleCell(surfaceRoot.firstElementChild as HTMLElement));
      updaters.push(upd);
    }

    for (const module of familyModules.drum) {
      const s = module;
      const surfaceRoot = document.createElement("div");
      const upd = renderDrumModuleSurface({
        root: surfaceRoot,
        v: s as any,
        getLedState: params.led,
        onPatchChange: params.onPatchChange,
        ui: { tab: params.getVoiceTab(s.id), setTab: (tab) => params.setVoiceTab(s.id, tab) },
        triggerOptions,
        onRemove: () => {
          const prev = params.clonePatch(params.patch());
          const nextPatch = params.patch();
          nextPatch.modules = nextPatch.modules.filter((m) => m.id !== s.id);
          params.pushHistory(prev);
          params.sched.setPatch(nextPatch, { regen: true });
          params.sched.regenAll();
          params.saveAndPersist();
          rerender();
        },
      });
      lanes.drum.appendChild(createModuleCell(surfaceRoot.firstElementChild as HTMLElement));
      updaters.push(upd);
    }

    for (const module of familyModules.tonal) {
      const s = module;
      const surfaceRoot = document.createElement("div");
      const upd = renderSynthModuleSurface({
        root: surfaceRoot,
        v: s as any,
        getLedState: params.led,
        onPatchChange: params.onPatchChange,
        ui: { tab: params.getVoiceTab(s.id), setTab: (tab) => params.setVoiceTab(s.id, tab) },
        triggerOptions,
        onRemove: () => {
          const prev = params.clonePatch(params.patch());
          const nextPatch = params.patch();
          nextPatch.modules = nextPatch.modules.filter((m) => m.id !== s.id);
          params.pushHistory(prev);
          params.sched.setPatch(nextPatch, { regen: true });
          params.sched.regenAll();
          params.saveAndPersist();
          rerender();
        },
      });
      lanes.tonal.appendChild(createModuleCell(surfaceRoot.firstElementChild as HTMLElement));
      updaters.push(upd);
    }

    for (const module of familyModules.visual) {
      const vm = module;
      const surfaceRoot = document.createElement("div");
      const upd = renderVisualSurface(surfaceRoot, params.engine, patch, vm as any, () => {
        const prev = params.clonePatch(params.patch());
        const nextPatch = params.patch();
        nextPatch.modules = nextPatch.modules.filter((m) => m.id !== vm.id);
        params.pushHistory(prev);
        params.saveAndPersist();
        rerender();
      });
      lanes.visual.appendChild(createModuleCell(surfaceRoot.firstElementChild as HTMLElement));
      updaters.push(upd);
    }

    (Object.keys(lanes) as Family[]).forEach((family) => {
      const lane = lanes[family];
      const currentCount = familyModules[family].length;
      const totalCells = getTotalCells(currentCount);
      const slotsToAdd = Math.max(0, totalCells - currentCount);

      for (let i = 0; i < slotsToAdd; i++) {
        const slot = renderAddModuleSlot({ family, onPick: createModule });
        lane.appendChild(createModuleCell(slot));
      }
    });
  };

  return { rerender, updateFrame: () => { for (const update of updaters) update(); } };
}
