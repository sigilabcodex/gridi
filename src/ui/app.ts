// src/ui/app.ts
import type { Patch } from "../patch";
import { clamp, defaultPatch, getVoices } from "../patch";
import type { Engine } from "../engine/audio";
import type { Scheduler } from "../engine/scheduler";
import { loadSettings } from "../settings/store";
import { createTransportHeader } from "./header/transportHeader";
import { createUndoRedoHistory } from "./history/undoRedo";
import { openSettingsModal } from "./modals/settingsModal";
import { maybeShowWelcomeModal } from "./modals/welcomeModal";
import { BANK_COUNT, loadState, saveState } from "./persistence/bankState";
import { createModuleGridRenderer } from "./render/moduleGrid";
import { createVoiceTabsState } from "./state/voiceTabs";

function randInt(min: number, max: number) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function rand01() {
  return Math.random();
}

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

export function mountApp(root: HTMLElement, engine: Engine, sched: Scheduler) {
  const loaded = loadState();
  let bank = loaded?.bank ?? 0;
  const banks: Patch[] = loaded?.banks ?? Array.from({ length: BANK_COUNT }, () => defaultPatch());
  let patch: Patch = banks[bank];

  const settings = loadSettings();
  applyUserCss(settings.ui.customCss);

  const clonePatch = (p: Patch): Patch => structuredClone(p);

  const syncEngineFromPatch = (nextPatch: Patch, regen = true) => {
    sched.setBpm(nextPatch.bpm);
    sched.setPatch(nextPatch, { regen });
    if (regen) sched.regenAll();
    engine.setMasterMute(nextPatch.masterMute);
    engine.setMasterGain(nextPatch.masterGain);
  };

  const saveAndPersist = () => {
    banks[bank] = patch;
    saveState(bank, banks);
  };

  const applyPatch = (nextPatch: Patch) => {
    patch = nextPatch;
    banks[bank] = patch;
    syncEngineFromPatch(patch, true);
    saveState(bank, banks);
    gridRenderer.rerender();
    header.updateMuteBtn();
    header.updateMasterGainUI();
    header.updateBpmUI();
    header.updateStatus();
  };

  const history = createUndoRedoHistory(
    () => patch,
    (nextPatch) => {
      patch = nextPatch;
      banks[bank] = patch;
    },
    applyPatch
  );

  const onPatchChange = (fn: (p: Patch) => void, opts?: { regen?: boolean }) => {
    const prev = clonePatch(patch);
    fn(patch);
    history.pushHistory(prev);

    sched.setPatch(patch, { regen: opts?.regen ?? false });
    if (opts?.regen) sched.regenAll();

    saveAndPersist();
  };

  const { getVoiceTab, setVoiceTab } = createVoiceTabsState();

  syncEngineFromPatch(patch, true);

  root.innerHTML = "";
  const main = document.createElement("main");

  const led = (voiceIndex: number) => {
    const voices = getVoices(patch);
    const active = voices[voiceIndex]?.enabled ?? false;
    const ms = engine.voiceLastTrigMs[voiceIndex] || 0;
    const hit = performance.now() - ms < 80;
    return { active, hit };
  };

  const gridRenderer = createModuleGridRenderer({
    main,
    engine,
    sched,
    patch: () => patch,
    clonePatch,
    pushHistory: history.pushHistory,
    onPatchChange,
    saveAndPersist,
    getVoiceTab,
    setVoiceTab,
    led,
  });

  const header = createTransportHeader({
    root,
    patch: () => patch,
    bank: () => bank,
    bankCount: BANK_COUNT,
    settingsExperimental: () => settings.ui.experimental,
    audioState: () => engine.ctx.state,
    isPlaying: () => sched.running,
    onOpenSettings: () =>
      openSettingsModal({
        settings,
        patch,
        bank,
        banks,
        clonePatch,
        pushHistory: history.pushHistory,
        setPatch: (nextPatch) => {
          patch = nextPatch;
        },
        setBank: (nextBank) => {
          bank = nextBank;
        },
        syncEngineFromPatch,
        applyUserCss,
        rerender: gridRenderer.rerender,
        updateStatus: header.updateStatus,
        updateBankLabel: header.updateBankLabel,
        updateMuteBtn: header.updateMuteBtn,
        updateMasterGainUI: header.updateMasterGainUI,
      }),
    onToggleAudio: async () => {
      if (engine.ctx.state === "running") await engine.ctx.suspend();
      else await engine.start();
      header.updateAudioBtn();
      header.updateStatus();
    },
    onTogglePlay: async () => {
      if (!sched.running) {
        await engine.start();
        sched.setBpm(patch.bpm);
        sched.setPatch(patch, { regen: false });
        sched.start();
      } else {
        sched.stop();
      }
      header.updatePlayBtn();
      header.updateStatus();
    },
    onToggleMute: () => {
      patch.masterMute = !patch.masterMute;
      engine.setMasterMute(patch.masterMute);
      saveAndPersist();
      header.updateMuteBtn();
      header.updateStatus();
    },
    onReset: () => {
      banks[bank] = defaultPatch();
      patch = banks[bank];
      syncEngineFromPatch(patch, true);
      saveState(bank, banks);
      gridRenderer.rerender();
      header.updateMuteBtn();
      header.updateMasterGainUI();
      header.updateBpmUI();
      header.updateStatus();
    },
    onReseed: () => {
      const prev = clonePatch(patch);
      const voices = getVoices(patch);
      for (const v of voices) v.seed = randInt(1, 999999);
      history.pushHistory(prev);
      sched.setPatch(patch, { regen: true });
      sched.regenAll();
      saveAndPersist();
      gridRenderer.rerender();
    },
    onRandomize: () => {
      const prev = clonePatch(patch);
      const voices = getVoices(patch);
      for (const v of voices) {
        v.subdiv = [1, 2, 4, 8][randInt(0, 3)] as any;
        v.length = randInt(8, 32);
        v.density = clamp(0.05 + rand01() * 0.9, 0, 1);
        v.drop = clamp(rand01() * 0.35, 0, 1);
        v.determinism = clamp(rand01(), 0, 1);
        v.weird = clamp(rand01(), 0, 1);
        v.euclidRot = randInt(-16, 16);
        v.caRule = randInt(0, 255);
        v.caInit = clamp(rand01(), 0, 1);
        v.gravity = clamp(rand01(), 0, 1);
        v.pan = clamp((rand01() - 0.5) * 2, -1, 1);
      }
      history.pushHistory(prev);
      sched.setPatch(patch, { regen: true });
      sched.regenAll();
      saveAndPersist();
      gridRenderer.rerender();
    },
    onRegen: () => {
      sched.setPatch(patch, { regen: true });
      sched.regenAll();
      header.updateStatus();
    },
    onPrevBank: () => {
      bank = (bank - 1 + BANK_COUNT) % BANK_COUNT;
      patch = banks[bank];
      syncEngineFromPatch(patch, true);
      saveState(bank, banks);
      gridRenderer.rerender();
      header.updateBankLabel();
      header.updateMuteBtn();
      header.updateMasterGainUI();
      header.updateBpmUI();
      header.updateStatus();
    },
    onNextBank: () => {
      bank = (bank + 1) % BANK_COUNT;
      patch = banks[bank];
      syncEngineFromPatch(patch, true);
      saveState(bank, banks);
      gridRenderer.rerender();
      header.updateBankLabel();
      header.updateMuteBtn();
      header.updateMasterGainUI();
      header.updateBpmUI();
      header.updateStatus();
    },
    onSetBpm: (v: number) => {
      patch.bpm = clamp(v, 40, 240);
      sched.setBpm(patch.bpm);
      header.updateBpmUI();
      saveAndPersist();
    },
    onSetMasterGain: (v: number) => {
      patch.masterGain = clamp(v, 0, 1);
      engine.setMasterGain(patch.masterGain);
      header.updateMasterGainUI();
      saveAndPersist();
    },
  });

  root.appendChild(main);

  window.addEventListener("keydown", (e) => {
    const isMac = navigator.platform.toLowerCase().includes("mac");
    const mod = isMac ? e.metaKey : e.ctrlKey;

    const t = e.target as HTMLElement | null;
    const tag = t?.tagName?.toLowerCase();
    const typing =
      tag === "input" || tag === "textarea" || tag === "select" || (t as any)?.isContentEditable;

    if (mod && !typing) {
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        history.doUndo();
        return;
      }

      if ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y") {
        e.preventDefault();
        history.doRedo();
        return;
      }
    }

    if (!typing && e.code === "Space") {
      e.preventDefault();
      header.btnPlay.click();
    }
  });

  gridRenderer.rerender();
  header.updateBankLabel();
  header.updateMuteBtn();
  header.updateMasterGainUI();
  header.updateBpmUI();
  header.updateAudioBtn();
  header.updatePlayBtn();
  header.updateStatus();

  maybeShowWelcomeModal({
    settings,
    engine,
    updateAudioBtn: header.updateAudioBtn,
    updateStatus: header.updateStatus,
  });

  const frame = () => {
    gridRenderer.updateFrame();
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
