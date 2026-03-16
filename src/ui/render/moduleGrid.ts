import type { Scheduler } from "../../engine/scheduler";
import type { Engine } from "../../engine/audio";
import type { Patch, VisualKind } from "../../patch";
import { getTriggers, isVisual, makeSound, makeTrigger, makeVisual } from "../../patch";
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

function getFamily(module: Patch["modules"][number]): "trigger" | "drum" | "tonal" | "visual" | "other" {
  if (module.type === "trigger") return "trigger";
  if (module.type === "drum") return "drum";
  if (module.type === "tonal") return "tonal";
  if (module.type === "visual") return "visual";
  return "other";
}

function addFamilyLane(grid: HTMLElement, title: string, subtitle: string) {
  const lane = document.createElement("section");
  lane.className = "familyLane";

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

export function createModuleGridRenderer(params: ModuleGridParams) {
  let updaters: Array<() => void> = [];

  const rerender = () => {
    const patch = params.patch();
    params.main.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid";
    params.main.appendChild(grid);
    updaters = [];

    const triggers = getTriggers(patch);
    const sounds = patch.modules.filter((m) => m.type === "drum" || m.type === "tonal");
    const visuals = patch.modules.filter(isVisual);
    const triggerOptions = triggers.map((t) => ({ id: t.id, label: `${t.name} (${t.id.slice(-4)})` }));

    const triggerLane = addFamilyLane(grid, "Trigger Family", "Pattern density, pulse logic, and probability streams");
    const drumLane = addFamilyLane(grid, "Drum Family", "Transient/body/noise shaping for percussive voices");
    const synthLane = addFamilyLane(grid, "Synth Family", "Timbre, envelope, and filter architecture");
    const visualLane = addFamilyLane(grid, "Visual Family", "Reactive signal display and monitoring");
    const browserLane = addFamilyLane(grid, "Module Browser", "Add modules by family");

    for (const module of patch.modules) {
      const family = getFamily(module);
      if (family === "trigger") {
        const t = module;
        const upd = renderTriggerSurface(triggerLane, t, params.onPatchChange, () => {
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

      if (family === "drum") {
        const s = module;
        const upd = renderDrumModuleSurface({
          root: drumLane,
          v: s,
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
        updaters.push(upd);
      }

      if (family === "tonal") {
        const s = module;
        const upd = renderSynthModuleSurface({
          root: synthLane,
          v: s,
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
        updaters.push(upd);
      }

      if (family === "visual") {
        const vm = module;
        const upd = renderVisualSurface(visualLane, params.engine, patch, vm, () => {
          const prev = params.clonePatch(params.patch());
          const nextPatch = params.patch();
          nextPatch.modules = nextPatch.modules.filter((m) => m.id !== vm.id);
          params.pushHistory(prev);
          params.saveAndPersist();
          rerender();
        });
        updaters.push(upd);
      }
    }

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
    browserLane.appendChild(slot);
  };

  return { rerender, updateFrame: () => { for (const update of updaters) update(); } };
}
