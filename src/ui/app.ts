// src/ui/app.ts
import type { Patch, VisualKind } from "../patch";
import { clamp, defaultPatch, getVoices, isVisual, makeNewVoice, makeVisual } from "../patch";
import type { Engine } from "../engine/audio";
import type { Scheduler } from "../engine/scheduler";
import { renderVoiceModule } from "./voiceModule";
import { renderVisualModule } from "./visualModule";
import { renderAddModuleSlot } from "./AddModuleSlot";

const BANK_COUNT = 4;

function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function rand01() {
  return Math.random();
}

export function mountApp(root: HTMLElement, engine: Engine, sched: Scheduler) {
  let bank = 0;
  const banks: Patch[] = Array.from({ length: BANK_COUNT }, () => defaultPatch());
  let patch: Patch = banks[bank];

    // === Undo/Redo history (UI-only) ===
  const undoStack: Patch[] = [];
  const redoStack: Patch[] = [];
  let historyLock = false;

  const clonePatch = (p: Patch): Patch => structuredClone(p);

  function pushHistory(prev: Patch) {
    if (historyLock) return;
    undoStack.push(clonePatch(prev));
    if (undoStack.length > 80) undoStack.shift();
    redoStack.length = 0;
  }

  function doUndo() {
    if (!undoStack.length) return;
    const prev = undoStack.pop()!;
    redoStack.push(clonePatch(patch));
    patch = prev;
    banks[bank] = patch;
    sched.setBpm(patch.bpm);
    sched.setPatch(patch, { regen: true });
    engine.setMasterMute(patch.masterMute);
    engine.setMasterGain(patch.masterGain);
    rerender();
    updateMuteBtn();
    updateStatus();
  }

  function doRedo() {
    if (!redoStack.length) return;
    const next = redoStack.pop()!;
    undoStack.push(clonePatch(patch));
    patch = next;
    banks[bank] = patch;
    sched.setBpm(patch.bpm);
    sched.setPatch(patch, { regen: true });
    engine.setMasterMute(patch.masterMute);
    engine.setMasterGain(patch.masterGain);
    rerender();
    updateMuteBtn();
    updateStatus();
  }

  window.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (!mod) return;

    // ignore if typing in an input/select/textarea
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName?.toLowerCase();
    const typing = tag === "input" || tag === "textarea" || tag === "select" || (t as any)?.isContentEditable;
    if (typing) return;

    if (e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      doUndo();
    } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
      e.preventDefault();
      doRedo();
    }
  });



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

  // --- Audio / transport ---
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

  // --- Reseed / Randomize / Regen ---
  const btnReseed = document.createElement("button");
  btnReseed.textContent = "Re-seed";
  btnReseed.onclick = () => {
    const voices = getVoices(patch);
    for (const v of voices) v.seed = randInt(1, 999999);
    sched.setPatch(patch, { regen: true });
    rerender();
  };

  const btnRandom = document.createElement("button");
  btnRandom.textContent = "Randomize";
  btnRandom.onclick = () => {
    const voices = getVoices(patch);
    for (const v of voices) {
      // keep musical-ish ranges
      v.subdiv = [1, 2, 4, 8][randInt(0, 3)];
      v.length = randInt(8, 32);
      v.density = clamp(0.05 + rand01() * 0.9, 0, 1);
      v.drop = clamp(rand01() * 0.35, 0, 1);
      v.determinism = clamp(rand01(), 0, 1);
      v.weird = clamp(rand01(), 0, 1);

      v.euclidRot = randInt(-16, 16);
      v.caRule = randInt(0, 255);
      v.caInit = clamp(rand01(), 0, 1);
      v.gravity = clamp(rand01(), 0, 1);
      v.rot = randInt(-16, 16);
      v.pan = clamp((rand01() - 0.5) * 2, -1, 1);
    }
    sched.setPatch(patch, { regen: true });
    rerender();
  };

  const btnRegen = document.createElement("button");
  btnRegen.textContent = "Regen";
  btnRegen.onclick = () => {
    sched.setPatch(patch, { regen: true });
    sched.regenAll();
  };

  // --- banks ---
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

  // --- BPM ---
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

  header.append(
    h1,
    btnAudio,
    btnPlay,
    btnMute,
    btnReset,
    btnReseed,
    btnRandom,
    btnRegen,
    bankWrap,
    bpmWrap,
    status
  );
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
    const prev = structuredClone(patch);
    fn(patch);
    pushHistory(prev);

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

    // --- add-slot ghost tile (always last) ---
    const slot = renderAddModuleSlot({
      onPick: (what: "drum" | "tonal" | VisualKind) => {
        if (what === "drum" || what === "tonal") {
          patch.modules.push(makeNewVoice(what));
          sched.setPatch(patch, { regen: true });
          rerender();
          return;
        }
        patch.modules.push(makeVisual(what));
        rerender();
      },
    });
    grid.appendChild(slot);
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
