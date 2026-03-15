import type { Scheduler } from "../../engine/scheduler";
import type { Engine } from "../../engine/audio";
import type { Patch, VisualKind } from "../../patch";
import { getVoices, isVisual, makeNewVoice, makeVisual } from "../../patch";
import type { VoiceTab } from "../voiceModule";
import { renderVoiceModule } from "../voiceModule";
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
  led: (voiceIndex: number) => { active: boolean; hit: boolean };
};

export function createModuleGridRenderer(params: ModuleGridParams) {
  let updaters: Array<() => void> = [];

  const rerender = () => {
    const patch = params.patch();

    params.main.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid";
    params.main.appendChild(grid);

    updaters = [];

    const voices = getVoices(patch);
    const patternSourceOptions = voices.map((voice) => ({
      id: voice.id,
      label: `${voice.name} (${voice.id.slice(-4)})`,
    }));

    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      const sourceOptions = [{ id: "self", label: "Self" }, ...patternSourceOptions.filter((opt) => opt.id !== v.id)];

      const upd = renderVoiceModule(
        grid,
        patch,
        v,
        i,
        params.led,
        params.onPatchChange,
        {
          tab: params.getVoiceTab(v.id),
          setTab: (tab) => params.setVoiceTab(v.id, tab),
        },
        sourceOptions,
        () => {
          const prev = params.clonePatch(params.patch());
          const nextPatch = params.patch();
          nextPatch.modules = nextPatch.modules.filter((m) => m.id !== v.id);
          params.pushHistory(prev);
          params.sched.setPatch(nextPatch, { regen: true });
          params.sched.regenAll();
          params.saveAndPersist();
          rerender();
        }
      );

      updaters.push(upd);
    }

    const visuals = patch.modules.filter(isVisual);
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

    const slot = renderAddModuleSlot({
      onPick: (what: "drum" | "tonal" | VisualKind) => {
        const prev = params.clonePatch(params.patch());
        const nextPatch = params.patch();

        if (what === "drum" || what === "tonal") {
          nextPatch.modules.push(makeNewVoice(what));
        } else {
          nextPatch.modules.push(makeVisual(what));
        }

        params.pushHistory(prev);
        params.sched.setPatch(nextPatch, { regen: true });
        params.sched.regenAll();
        params.saveAndPersist();
        rerender();
      },
    });
    grid.appendChild(slot);
  };

  return {
    rerender,
    updateFrame: () => {
      for (const update of updaters) update();
    },
  };
}
