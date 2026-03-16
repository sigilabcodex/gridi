import type { Scheduler } from "../../engine/scheduler";
import type { Engine } from "../../engine/audio";
import type { Patch, VisualKind } from "../../patch";
import { getSoundModules, getTriggers, isVisual, makeSound, makeTrigger, makeVisual } from "../../patch";
import type { VoiceTab } from "../voiceModule";
import { renderVoiceModule } from "../voiceModule";
import { renderTriggerModule } from "../triggerModule";
import { renderVisualModule } from "../visualModule";
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

function addSection(grid: HTMLElement, title: string, subtitle: string) {
  const section = document.createElement("div");
  section.className = "moduleSection";
  const t = document.createElement("div");
  t.className = "moduleSectionTitle";
  t.textContent = title;
  const s = document.createElement("div");
  s.className = "small moduleSectionSubtitle";
  s.textContent = subtitle;
  section.append(t, s);
  grid.appendChild(section);
}

export function createModuleGridRenderer(params: ModuleGridParams) {
  let updaters: Array<() => void> = [];

  const rerender = () => {
    const patch = params.patch();
    params.main.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid";
    params.main.appendChild(grid);
    updaters = [];

    const sounds = getSoundModules(patch);
    const triggers = getTriggers(patch);
    const triggerOptions = triggers.map((t) => ({ id: t.id, label: `${t.name} (${t.id.slice(-4)})` }));

    addSection(grid, "Trigger Modules", "Event generation and pattern logic");
    for (const t of triggers) {
      const upd = renderTriggerModule(grid, t, params.onPatchChange, () => {
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
      updaters.push(upd);
    }

    addSection(grid, "Synth Modules", "Drum and tonal voices driven by trigger sources");
    for (const s of sounds) {
      const upd = renderVoiceModule(
        grid,
        s,
        0,
        params.led,
        params.onPatchChange,
        { tab: params.getVoiceTab(s.id), setTab: (tab) => params.setVoiceTab(s.id, tab) },
        triggerOptions,
        () => {
          const prev = params.clonePatch(params.patch());
          const nextPatch = params.patch();
          nextPatch.modules = nextPatch.modules.filter((m) => m.id !== s.id);
          params.pushHistory(prev);
          params.sched.setPatch(nextPatch, { regen: true });
          params.sched.regenAll();
          params.saveAndPersist();
          rerender();
        },
      );
      updaters.push(upd);
    }

    const visuals = patch.modules.filter(isVisual);
    addSection(grid, "Visual Modules", "Monitoring output and behavior");
    for (const vm of visuals) {
      const upd = renderVisualModule(grid, params.engine, patch, vm, () => {
        const prev = params.clonePatch(params.patch());
        const nextPatch = params.patch();
        nextPatch.modules = nextPatch.modules.filter((m) => m.id !== vm.id);
        params.pushHistory(prev);
        params.saveAndPersist();
        rerender();
      });
      updaters.push(upd);
    }

    addSection(grid, "Module Browser", "Add new modules by family");
    const slot = renderAddModuleSlot({
      onPick: (what: "drum" | "tonal" | "trigger" | VisualKind) => {
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
      },
    });
    grid.appendChild(slot);
  };

  return { rerender, updateFrame: () => { for (const update of updaters) update(); } };
}
