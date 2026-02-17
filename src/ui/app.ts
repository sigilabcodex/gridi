// src/ui/app.ts
import type { Patch, VisualKind } from "../patch";
import { clamp, defaultPatch, getVoices, isVisual, makeNewVoice, makeVisual } from "../patch";
import type { Engine } from "../engine/audio";
import type { Scheduler } from "../engine/scheduler";
import { renderVoiceModule, type VoiceTab } from "./voiceModule";
import { renderVisualModule } from "./visualModule";
import { renderAddModuleSlot } from "./AddModuleSlot";
import { loadSettings, saveSettings } from "../settings/store";

const BANK_COUNT = 4;

// --- storage keys (v0.30)
const LS_STATE = "gridi.state.v0_30";

// --- types
type PersistedState = {
  bank: number;
  banks: Patch[];
};

// type UiSettings = {
//  hideWelcome: boolean;     // if true, skip welcome on load
//  experimental: boolean;    // feature flags
//  customCss: string;        // user CSS
// };

function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
function rand01() {
  return Math.random();
}

function safeParseJSON<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function isPatchLike(x: any): x is Patch {
  return x && typeof x === "object" && x.version === "0.3" && Array.isArray(x.modules);
}

function ensureBankCount(banks: Patch[], count: number) {
  const out = banks.slice(0, count);
  while (out.length < count) out.push(defaultPatch());
  return out;
}

function loadState(): PersistedState | null {
  const raw = localStorage.getItem(LS_STATE);
  if (!raw) return null;
  const parsed = safeParseJSON<any>(raw);
  if (!parsed) return null;

  const bank = typeof parsed.bank === "number" ? parsed.bank : 0;
  const banksRaw = Array.isArray(parsed.banks) ? parsed.banks : [];
  const banks = banksRaw.filter(isPatchLike);
  if (!banks.length) return null;

  return { bank: clamp(bank, 0, BANK_COUNT - 1), banks: ensureBankCount(banks, BANK_COUNT) };
}

function saveState(bank: number, banks: Patch[]) {
  const payload: PersistedState = { bank: clamp(bank, 0, BANK_COUNT - 1), banks };
  localStorage.setItem(LS_STATE, JSON.stringify(payload));
}

// inject/update custom CSS
function applyUserCss(cssText: string) {
  const id = "gridi-user-css";
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = cssText || "";
}

// small DOM helper
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

// UI switch helper (uses .switchRow/.switch/.switchKnob styles)
function makeSwitch(labelText: string, value: boolean, onChange: (v: boolean) => void) {
  const row = el("div", "switchRow");
  const label = el("div", "switchLabel", labelText);

  const sw = el("button", "switch" + (value ? " on" : "")) as HTMLButtonElement;
  sw.type = "button";
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-checked", value ? "true" : "false");

  const knob = el("div", "switchKnob");
  sw.appendChild(knob);

  const set = (v: boolean) => {
    value = v;
    sw.className = "switch" + (value ? " on" : "");
    sw.setAttribute("aria-checked", value ? "true" : "false");
  };

  sw.onclick = () => {
    set(!value);
    onChange(value);
  };

  row.append(label, sw);
  return { row, set };
}

// modal helper
function makeModal(title: string) {
  const overlay = el("div", "modalOverlay");
  const modal = el("div", "modal");
  const head = el("div", "modalHead");
  const h = el("div", "modalTitle", title);
  const close = el("button", "modalClose", "×");
  close.title = "Close";
  head.append(h, close);

  const body = el("div", "modalBody");

  modal.append(head, body);
  overlay.appendChild(modal);

  const open = () => document.body.appendChild(overlay);
  const destroy = () => overlay.remove();

  close.onclick = destroy;
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) destroy();
  });

  return { overlay, modal, body, open, destroy };
}


async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function mountApp(root: HTMLElement, engine: Engine, sched: Scheduler) {
  // --- load persisted state (banks + bank index)
  const loaded = loadState();
  let bank = loaded?.bank ?? 0;
  const banks: Patch[] = loaded?.banks ?? Array.from({ length: BANK_COUNT }, () => defaultPatch());
  let patch: Patch = banks[bank];

  // --- UI settings (welcome/settings/custom css)
  const settings = loadSettings();
applyUserCss(settings.ui.customCss);


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

  function syncEngineFromPatch(p: Patch, regen = true) {
    sched.setBpm(p.bpm);
    sched.setPatch(p, { regen });
    if (regen) sched.regenAll();
    engine.setMasterMute(p.masterMute);
    engine.setMasterGain(p.masterGain);
  }

  function doUndo() {
    if (!undoStack.length) return;
    const prev = undoStack.pop()!;
    redoStack.push(clonePatch(patch));
    patch = prev;
    banks[bank] = patch;
    syncEngineFromPatch(patch, true);
    saveState(bank, banks);
    rerender();
    updateMuteBtn();
    updateMasterGainUI();
    updateStatus();
  }

  function doRedo() {
    if (!redoStack.length) return;
    const next = redoStack.pop()!;
    undoStack.push(clonePatch(patch));
    patch = next;
    banks[bank] = patch;
    syncEngineFromPatch(patch, true);
    saveState(bank, banks);
    rerender();
    updateMuteBtn();
    updateMasterGainUI();
    updateStatus();
  }

  window.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    const mod = isMac ? e.metaKey : e.ctrlKey;

    // ignore if typing
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName?.toLowerCase();
    const typing =
      tag === "input" || tag === "textarea" || tag === "select" || (t as any)?.isContentEditable;

    // Undo/Redo
    if (mod && !typing) {
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        doUndo();
        return;
      } else if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        doRedo();
        return;
      }
    }

    // Space = Play/Stop (non-typing)
    if (!typing && e.code === "Space") {
      e.preventDefault();
      btnPlay.click();
    }
  });

  // UI-only Adv state per module id

const voiceTabs = new Map<string, VoiceTab>();
const getVoiceTab = (id: string): VoiceTab => voiceTabs.get(id) ?? "MAIN";
const setVoiceTab = (id: string, t: VoiceTab) => voiceTabs.set(id, t);


  // initial engine sync
  syncEngineFromPatch(patch, true);

  root.innerHTML = "";

  // ===== header =====
  const header = document.createElement("header");
  const h1 = document.createElement("h1");
  h1.textContent = "GRIDI 0.30";

  const status = document.createElement("div");
  status.className = "small";
  const updateStatus = () => {
    status.textContent = `status: ${sched.running ? "playing" : "stopped"} | audio: ${engine.ctx.state}${
      settings.ui.experimental ? " | experimental: ON" : ""
    }`;
  };

  // --- Settings (gear) ---
  const btnSettings = el("button", "iconBtn", "⚙");
  btnSettings.title = "Settings";
  btnSettings.onclick = () => openSettings();

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
    saveState(bank, banks);
    updateMuteBtn();
    updateStatus();
  };

  // --- Master Gain (v0.30) ---
  const masterWrap = el("div", "bpmWrap");
  const masterLab = el("div", "small", "Master");
  const master = document.createElement("input");
  master.type = "range";
  master.min = "0";
  master.max = "1";
  master.step = "0.001";
  master.value = String(patch.masterGain);

  const masterNum = document.createElement("input");
  masterNum.type = "number";
  masterNum.min = "0";
  masterNum.max = "1";
  masterNum.step = "0.001";
  masterNum.value = String(patch.masterGain);

  const updateMasterGainUI = () => {
    master.value = String(patch.masterGain);
    masterNum.value = String(patch.masterGain);
  };

  const setMasterUI = (v: number) => {
    patch.masterGain = clamp(v, 0, 1);
    engine.setMasterGain(patch.masterGain);
    updateMasterGainUI();
    saveState(bank, banks);
  };
  master.oninput = () => setMasterUI(parseFloat(master.value));
  masterNum.onchange = () => setMasterUI(parseFloat(masterNum.value));
  masterWrap.append(masterLab, master, masterNum);

  const btnReset = document.createElement("button");
  btnReset.textContent = "Reset";
  btnReset.onclick = () => {
    banks[bank] = defaultPatch();
    patch = banks[bank];
    syncEngineFromPatch(patch, true);
    saveState(bank, banks);
    rerender();
    updateMuteBtn();
    updateMasterGainUI();
    updateStatus();
  };

  // --- Reseed / Randomize / Regen ---
  const btnReseed = document.createElement("button");
  btnReseed.textContent = "Re-seed";
  btnReseed.onclick = () => {
    const prev = clonePatch(patch);
    const voices = getVoices(patch);
    for (const v of voices) v.seed = randInt(1, 999999);
    pushHistory(prev);
    sched.setPatch(patch, { regen: true });
    sched.regenAll();
    saveState(bank, banks);
    rerender();
  };

  const btnRandom = document.createElement("button");
  btnRandom.textContent = "Randomize";
  btnRandom.onclick = () => {
    const prev = clonePatch(patch);
    const voices = getVoices(patch);
    for (const v of voices) {
      v.subdiv = [1, 2, 4, 8][randInt(0, 3)] as any;
      v.length = randInt(8, 32);
      v.density = clamp(0.05 + rand01() * 0.9, 0, 1);
      v.drop = clamp(rand01() * 0.35, 0, 1);
      v.determinism = clamp(rand01(), 0, 1);
      v.weird = clamp(rand01(), 0, 1);

      v.euclidRot = randInt(-16, 16); // <-- fix (no v.rot)
      v.caRule = randInt(0, 255);
      v.caInit = clamp(rand01(), 0, 1);
      v.gravity = clamp(rand01(), 0, 1);
      v.pan = clamp((rand01() - 0.5) * 2, -1, 1);
    }
    pushHistory(prev);
    sched.setPatch(patch, { regen: true });
    sched.regenAll();
    saveState(bank, banks);
    rerender();
  };

  const btnRegen = document.createElement("button");
  btnRegen.textContent = "Regen";
  btnRegen.onclick = () => {
    sched.setPatch(patch, { regen: true });
    sched.regenAll();
    updateStatus();
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
    syncEngineFromPatch(patch, true);
    saveState(bank, banks);
    rerender();
    updateBankLabel();
    updateMuteBtn();
    updateMasterGainUI();
    updateStatus();
  };

  const btnBankNext = document.createElement("button");
  btnBankNext.textContent = "▶";
  btnBankNext.onclick = () => {
    bank = (bank + 1) % BANK_COUNT;
    patch = banks[bank];
    syncEngineFromPatch(patch, true);
    saveState(bank, banks);
    rerender();
    updateBankLabel();
    updateMuteBtn();
    updateMasterGainUI();
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
    saveState(bank, banks);
  };
  bpm.oninput = () => setBpmUI(parseInt(bpm.value, 10));
  bpmNum.onchange = () => setBpmUI(clamp(parseInt(bpmNum.value, 10), 40, 240));
  bpmWrap.append(bpmLabel, bpm, bpmNum);

  const spacer = document.createElement("div");
  spacer.className = "spacer";

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
    masterWrap,
    spacer,
    status,
    btnSettings
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
    const prev = clonePatch(patch);
    fn(patch);
    pushHistory(prev);

    sched.setPatch(patch, { regen: opts?.regen ?? false });
    if (opts?.regen) sched.regenAll();

    banks[bank] = patch;
    saveState(bank, banks);
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
         tab: getVoiceTab(v.id),
         setTab: (t) => setVoiceTab(v.id, t),
      },

        () => {
          const prev = clonePatch(patch);
          patch.modules = patch.modules.filter((m) => m.id !== v.id);
          pushHistory(prev);
          sched.setPatch(patch, { regen: true });
          sched.regenAll();
          saveState(bank, banks);
          rerender();
        }
      );
      updaters.push(upd);
    }

    const visuals = patch.modules.filter(isVisual);
    for (const vm of visuals) {
      const upd = renderVisualModule(grid, engine, patch, vm, () => {
        const prev = clonePatch(patch);
        patch.modules = patch.modules.filter((m) => m.id !== vm.id);
        pushHistory(prev);
        saveState(bank, banks);
        rerender();
      });
      updaters.push(upd);
    }

    // --- add-slot ghost tile (always last) ---
    const slot = renderAddModuleSlot({
      onPick: (what: "drum" | "tonal" | VisualKind) => {
        const prev = clonePatch(patch);
        if (what === "drum" || what === "tonal") {
          patch.modules.push(makeNewVoice(what));
        } else {
          patch.modules.push(makeVisual(what));
        }
        pushHistory(prev);
        sched.setPatch(patch, { regen: true });
        sched.regenAll();
        saveState(bank, banks);
        rerender();
      },
    });
    grid.appendChild(slot);
  }

  // ===== Settings modal =====
  function openSettings() {
    const m = makeModal("Settings");
    const body = m.body;

  // Experimental toggle
  const swExp = makeSwitch("Experimental mode", settings.ui.experimental, (v) => {
  settings.ui.experimental = v;
  saveSettings(settings);
  updateStatus();
 });

  // Welcome toggle
  const swWel = makeSwitch("Show welcome screen on load", !settings.ui.hideWelcome, (v) => {
  settings.ui.hideWelcome = !v;
  saveSettings(settings);
 });

    // Custom CSS
    const cssWrap = el("div", "settingsBlock");
    const cssLab = el("div", "small", "Custom CSS (saved locally)");
    const cssTA = document.createElement("textarea");
    cssTA.className = "cssBox";
    cssTA.value = settings.ui.customCss;
    const cssBtns = el("div", "settingsBtnRow");
    const btnApply = el("button", "primary", "Apply CSS");
    const btnClear = el("button", "", "Clear");
    btnApply.onclick = () => {
    settings.ui.customCss = cssTA.value;
    saveSettings(settings);
    applyUserCss(settings.ui.customCss);
    };

    btnClear.onclick = () => {
  cssTA.value = "";
  settings.ui.customCss = "";
  saveSettings(settings);
  applyUserCss("");
 };


    cssBtns.append(btnApply, btnClear);
    cssWrap.append(cssLab, cssTA, cssBtns);

    // Import / Export
    const ieWrap = el("div", "settingsBlock");
    const ieLab = el("div", "small", "Import / Export JSON");
    const ieTA = document.createElement("textarea");
    ieTA.className = "jsonBox";
    ieTA.placeholder = "Paste Patch JSON or Banks JSON here…";

    const ieBtns = el("div", "settingsBtnRow");
    const btnCopyPatch = el("button", "", "Copy Patch");
    const btnCopyBanks = el("button", "", "Copy Banks");
    const btnImportPatch = el("button", "primary", "Import Patch");
    const btnImportBanks = el("button", "primary", "Import Banks");

    btnCopyPatch.onclick = async () => {
      const txt = JSON.stringify(patch, null, 2);
      ieTA.value = txt;
      await copyToClipboard(txt);
    };

    btnCopyBanks.onclick = async () => {
      const payload = { version: "0.30", bank, banks };
      const txt = JSON.stringify(payload, null, 2);
      ieTA.value = txt;
      await copyToClipboard(txt);
    };

    btnImportPatch.onclick = () => {
      const parsed = safeParseJSON<any>(ieTA.value.trim());
      if (!isPatchLike(parsed)) {
        alert("Invalid patch JSON (expected version: 0.3).");
        return;
      }
      const prev = clonePatch(patch);
      patch = parsed;
      banks[bank] = patch;
      pushHistory(prev);
      syncEngineFromPatch(patch, true);
      saveState(bank, banks);
      rerender();
      updateMuteBtn();
      updateMasterGainUI();
      updateStatus();
      m.destroy();
    };

    btnImportBanks.onclick = () => {
      const parsed = safeParseJSON<any>(ieTA.value.trim());
      const banksIn = parsed?.banks;
      const bankIn = parsed?.bank;

      if (!Array.isArray(banksIn)) {
        alert("Invalid banks JSON (expected { banks: Patch[] }).");
        return;
      }

      const filtered = banksIn.filter(isPatchLike);
      if (!filtered.length) {
        alert("No valid patches found in banks JSON (expected version: 0.3).");
        return;
      }

      const prev = clonePatch(patch);

      const nextBanks = ensureBankCount(filtered, BANK_COUNT);
      const nextBank = typeof bankIn === "number" ? clamp(bankIn, 0, BANK_COUNT - 1) : 0;

      bank = nextBank;
      for (let i = 0; i < BANK_COUNT; i++) banks[i] = nextBanks[i];

      patch = banks[bank];
      pushHistory(prev);
      syncEngineFromPatch(patch, true);
      saveState(bank, banks);
      rerender();
      updateBankLabel();
      updateMuteBtn();
      updateMasterGainUI();
      updateStatus();
      m.destroy();
    };

    ieBtns.append(btnCopyPatch, btnCopyBanks, btnImportPatch, btnImportBanks);
    ieWrap.append(ieLab, ieTA, ieBtns);

    body.append(swExp.row, swWel.row, cssWrap, ieWrap);

    m.open();
  }

  // ===== Welcome modal =====
  function maybeShowWelcome() {
    if (settings.ui.hideWelcome) return;

    const w = makeModal("Welcome to GRIDI");
    const body = w.body;

    const p = el("div", "welcomeText");
    p.innerHTML = `
      <p><b>GRIDI</b> is a generative rhythmic instrument.</p>
      <p>To start audio, the browser requires a user gesture.</p>
      <p class="small">Tips: Space = Play/Stop. Ctrl/Cmd+Z/Y = Undo/Redo. ⚙ has export/import and custom CSS.</p>
      <p class="small welcomeDedication">Dedicated to Taniel Morales (1970–2026) — artist, teacher, friend.</p>
    `;

    const row = el("div", "settingsBtnRow");
    const btnStart = el("button", "primary", "Start Audio Engine");
    const btnLater = el("button", "", "Not now");
    const chkWrap = el("label", "chkRow");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = true;
    chkWrap.append(chk, el("span", "small", "Don’t show again"));

    btnStart.onclick = async () => {
      await engine.start();
      updateAudioBtn();
      updateStatus();
      if (chk.checked) {
    settings.ui.hideWelcome = true;
    saveSettings(settings);
    }

      w.destroy();
    };
    btnLater.onclick = () => {
      if (chk.checked) {
   settings.ui.hideWelcome = true;
   saveSettings(settings);
   }
      w.destroy();
    };

    row.append(btnStart, btnLater);
    body.append(p, chkWrap, row);
    w.open();
  }

  // initial render
  rerender();
  updateBankLabel();
  updateMuteBtn();
  updateMasterGainUI();
  updateAudioBtn();
  updatePlayBtn();
  updateStatus();
  maybeShowWelcome();

  function frame() {
    for (const u of updaters) u();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
