// src/ui/app.ts
import type { Patch, VisualKind } from "../patch";
import { defaultPatch, getVoices, isVisual, makeNewVoice, makeVisual } from "../patch";
import type { Engine } from "../engine/audio";
import type { Scheduler } from "../engine/scheduler";
import { renderVoiceModule } from "./voiceModule";
import { renderVisualModule } from "./visualModule";
import { clamp } from "../patch";

const BANK_COUNT = 4;

export function mountApp(root: HTMLElement, engine: Engine, sched: Scheduler) {
  let bank = 0;
  const banks: Patch[] = Array.from({ length: BANK_COUNT }, () => defaultPatch());
  let patch: Patch = banks[bank];

  // UI-only Adv state per module id
  const advOpen = new Map<string, boolean>();
  const getAdvOpen = (id: string) => advOpen.get(id) ?? false;
  const setAdvOpen = (id: string, v: boolean) => advOpen.set(id, v);

  sched.setPatch(patch, { regen: true });
  sched.setBpm(patch.bpm);

  root.innerHTML = "";

  const header = document.createElement("header");
  const h1 = document.createElement("h1");
  h1.textContent = "GRIDI 0.3";

  const status = document.createElement("div");
  status.className = "small";

  const updateStatus = () => {
    status.textContent = `status: ${sched.running ? "playing" : "stopped"} | audio: ${engine.ctx.state}`;
  };

  const btnAudio = document.createElement("button");
  btnAudio.className = "primary";
  const updateAudioBtn = () => (btnAudio.textContent = engine.ctx.state === "running" ? "Audio ON" : "Audio OFF");
  btnAudio.onclick = async () => {
    if (engine.ctx.state === "running") await engine.ctx.suspend();
    else await engine.start();
    updateAudioBtn();
    updateStatus();
  };

  const btnPlay = document.createElement("button");
  const updatePlayBtn = () => (btnPlay.textContent = sched.running ? "Stop" : "Play");
  btnPlay.onclick = () => {
    if (!sched.running) {
      sched.setBpm(patch.bpm);
      sched.setPatch(patch, { regen: false });
      sched.start();
    } else {
      sched.stop();
    }
    updatePlayBtn();
    updateStatus();
  };

  const btnMute = document.createElement("button");
  const updateMuteBtn = () => {
    btnMute.textContent = patch.masterMute ? "Unmute" : "Mute";
    btnMute.className = patch.masterMute ? "primary" : "";
  };
  btnMute.onclick = () => {
    patch.masterMute = !patch.masterMute;
    engine.setMasterMute(patch.masterMute);
    updateMuteBtn();
    updateStatus();
  };

  const btnReset = document.createElement("button");
  btnReset.textContent = "Reset";
  btnReset.onclick = () => {
    banks[bank] = defaultPatch();
    patch = banks[bank];
    sched.setBpm(patch.bpm);
    sched.setPatch(patch, { regen: true });
    engine.setMasterMute(patch.masterMute);
    engine.setMasterGain(patch.masterGain);
    rerender();
    updateMuteBtn();
    updateStatus();
  };

  // banks
  const bankWrap = document.createElement("div");
  bankWrap.className = "bankWrap";

  const bankLabel = document.createElement("div");
  bankLabel.className = "small";
  const updateBankLabel = () => (bankLabel.textContent = `Bank ${bank + 1}/${BANK_COUNT}`);

  const btnBankPrev = document.createElement("button");
  btnBankPrev.textContent = "◀";
  btnBankPrev.onclick = () => {
    bank = (bank - 1 + BANK_COUNT) % BANK_COUNT;
    patch = banks[bank];
    sched.setBpm(patch.bpm);
    sched.setPatch(patch, { regen: true });
    engine.setMasterMute(patch.masterMute);
    engine.setMasterGain(patch.masterGain);
    rerender();
    updateBankLabel();
    updateMuteBtn();
    updateStatus();
  };

  const btnBankNext = document.createElement("button");
  btnBankNext.textContent = "▶";
  btnBankNext.onclick = () => {
    bank = (bank + 1) % BANK_COUNT;
    patch = banks[bank];
    sched.setBpm(patch.bpm);
    sched.setPatch(patch, { regen: true });
    engine.setMasterMute(patch.masterMute);
    engine.setMasterGain(patch.masterGain);
    rerender();
    updateBankLabel();
    updateMuteBtn();
    updateStatus();
  };
  bankWrap.append(btnBankPrev, bankLabel, btnBankNext);

  // module add buttons
  const addWrap = document.createElement("div");
  addWrap.className = "bankWrap";

  const btnAddDrum = document.createElement("button");
  btnAddDrum.textContent = "+ Drum";
  btnAddDrum.onclick = () => {
    patch.modules.push(makeNewVoice("drum"));
    sched.setPatch(patch, { regen: true });
    rerender();
  };

  const btnAddTonal = document.createElement("button");
  btnAddTonal.textContent = "+ Tonal";
  btnAddTonal.onclick = () => {
    patch.modules.push(makeNewVoice("tonal"));
    sched.setPatch(patch, { regen: true });
    rerender();
  };

  const btnAddScope = document.createElement("button");
  btnAddScope.textContent = "+ Scope";
  btnAddScope.onclick = () => addVisual("scope");

  const btnAddSpec = document.createElement("button");
  btnAddSpec.textContent = "+ Spectrum";
  btnAddSpec.onclick = () => addVisual("spectrum");

  function addVisual(kind: VisualKind) {
    patch.modules.push(makeVisual(kind));
    rerender();
  }

  addWrap.append(btnAddDrum, btnAddTonal, btnAddScope, btnAddSpec);

  // BPM
  const bpmWrap = document.createElement("div");
  bpmWrap.className = "bpmWrap";

  const bpmLabel = document.createElement("div");
  bpmLabel.className = "small";
  bpmLabel.textContent = "BPM";

  const bpm = document.createElement("input");
  bpm.type = "range";
  bpm.min = "40";
  bpm.max = "240";
  bpm.step = "1";
  bpm.value = String(patch.bpm);

  const bpmNum = document.createElement("input");
  bpmNum.type = "number";
  bpmNum.min = "40";
  bpmNum.max = "240";
  bpmNum.value = String(patch.bpm);

  const setBpmUI = (v: number) => {
    patch.bpm = v;
    bpm.value = String(v);
    bpmNum.value = String(v);
    sched.setBpm(v);
  };
  bpm.oninput = () => setBpmUI(parseInt(bpm.value, 10));
  bpmNum.onchange = () => setBpmUI(clamp(parseInt(bpmNum.value, 10), 40, 240));
  bpmWrap.append(bpmLabel, bpm, bpmNum);

  header.append(h1, btnAudio, btnPlay, btnMute, btnReset, addWrap, bankWrap, bpmWrap, status);
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  const led = (voiceIndex: number) => {
    const voices = getVoices(patch);
    const active = voices[voiceIndex]?.enabled ?? false;
    const ms = engine.voiceLastTrigMs[voiceIndex] || 0;
    const hit = performance.now() - ms < 80;
    return { active, hit };
  };

  let updaters: Array<() => void> = [];

  function onPatchChange(fn: (p: Patch) => void, opts?: { regen?: boolean }) {
    fn(patch);
    sched.setPatch(patch, { regen: opts?.regen ?? false });
    if (opts?.regen) sched.regenAll();
  }

  function rerender() {
    main.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "grid";
    main.appendChild(grid);

    updaters = [];

    const voices = getVoices(patch);
    for (let i = 0; i < voices.length; i++) {
      const v = voices[i];
      const upd = renderVoiceModule(
        grid,
        patch,
        v,
        i,
        led,
        onPatchChange,
        {
          advOpen: getAdvOpen(v.id),
          setAdvOpen: (vv) => {
            setAdvOpen(v.id, vv);
            rerender();
          },
        },
        () => {
          // remove by id
          patch.modules = patch.modules.filter((m) => m.id !== v.id);
          sched.setPatch(patch, { regen: true });
          rerender();
        }
      );
      updaters.push(upd);
    }

    const visuals = patch.modules.filter(isVisual);
    for (const vm of visuals) {
      const upd = renderVisualModule(grid, engine, patch, vm, () => {
        patch.modules = patch.modules.filter((m) => m.id !== vm.id);
        rerender();
      });
      updaters.push(upd);
    }
  }

  rerender();
  updateBankLabel();
  updateMuteBtn();
  updateAudioBtn();
  updatePlayBtn();
  updateStatus();

  function frame() {
    for (const u of updaters) u();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
