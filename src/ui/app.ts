// src/ui/app.ts
import type { Patch } from "../patch";
import { defaultPatch } from "../patch";
import type { Engine } from "../engine/audio";
import type { Scheduler } from "../engine/scheduler";
import { renderVoiceModule } from "./voiceModule";

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function mountApp(root: HTMLElement, engine: Engine, sched: Scheduler) {
  let patch: Patch = defaultPatch();

  // Estado UI (tu Patch actual no trae masterMute)
  let masterMuted = false;

  root.innerHTML = "";

  const header = document.createElement("header");
  const h1 = document.createElement("h1");
  h1.textContent = "GRIDI v0.2";

  const status = document.createElement("div");
  status.className = "small";
  status.textContent = "status: stopped";

  const btnAudio = document.createElement("button");
  btnAudio.textContent = "Start Audio";
  btnAudio.className = "primary";
  btnAudio.onclick = async () => {
    await engine.start();
    status.textContent = `status: ${sched.running ? "running" : "stopped"} | audio: ${engine.ctx.state}`;
  };

  const btnStartStop = document.createElement("button");
  btnStartStop.textContent = "Start";
  btnStartStop.onclick = () => {
    if (!sched.running) {
      sched.setBpm(patch.bpm);
      sched.start(patch);
      btnStartStop.textContent = "Stop";
    } else {
      sched.stop();
      btnStartStop.textContent = "Start";
    }
    status.textContent = `status: ${sched.running ? "running" : "stopped"} | audio: ${engine.ctx.state}`;
  };

  const btnMute = document.createElement("button");
  btnMute.textContent = "Mute";
  btnMute.onclick = () => {
    masterMuted = !masterMuted;
    engine.setMasterMute(masterMuted);
    btnMute.textContent = masterMuted ? "Unmute" : "Mute";
  };

  const btnReset = document.createElement("button");
  btnReset.textContent = "Reset";
  btnReset.onclick = () => {
    patch = defaultPatch();
    masterMuted = false;
    engine.setMasterMute(false);
    btnMute.textContent = "Mute";

    // si estaba corriendo, reinicia scheduler con patch fresco
    if (sched.running) {
      sched.setBpm(patch.bpm);
    }

    rerender();
  };

  // BPM controls
  const bpmWrap = document.createElement("div");
  bpmWrap.style.display = "flex";
  bpmWrap.style.gap = "8px";
  bpmWrap.style.alignItems = "center";

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

  bpm.oninput = () => {
    const v = parseInt(bpm.value, 10);
    patch.bpm = v;
    bpmNum.value = String(v);
    sched.setBpm(v);
  };

  bpmNum.onchange = () => {
    const v = clamp(parseInt(bpmNum.value, 10), 40, 240);
    patch.bpm = v;
    bpm.value = String(v);
    sched.setBpm(v);
  };

  bpmWrap.append(bpmLabel, bpm, bpmNum);

  header.append(h1, btnAudio, btnStartStop, btnMute, btnReset, bpmWrap, status);
  root.appendChild(header);

  const main = document.createElement("main");
  root.appendChild(main);

  // LED state calc (compatible con enabled/on)
  const led = (i: number) => {
    const v: any = patch.voices[i];
    const active = Boolean(v?.enabled ?? v?.on ?? false);

    const ms = engine.voiceLastTrigMs[i] || 0;
    const hit = performance.now() - ms < 80;

    return { active, hit };
  };

  let ledUpdaters: Array<() => void> = [];

  function onPatchChange(fn: (p: Patch) => void) {
    fn(patch);

    // Si cambió BPM mientras está corriendo, mantenlo sincronizado
    sched.setBpm(patch.bpm);
  }

  function rerender() {
    main.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "grid";
    main.appendChild(grid);

    ledUpdaters = [];
    for (let i = 0; i < patch.voices.length; i++) {
      const upd = renderVoiceModule(grid, patch, i, led, onPatchChange);
      ledUpdaters.push(upd);
    }
  }

  rerender();

  // UI loop (LEDs)
  function frame() {
    for (const u of ledUpdaters) u();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
