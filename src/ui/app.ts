import type { Patch } from "../patch";
import { clamp, defaultPatch, getSoundModules, getTriggers } from "../patch";
import type { Engine } from "../engine/audio";
import type { Scheduler } from "../engine/scheduler";
import { loadSettings } from "../settings/store";
import { createTransportHeader } from "./header/transportHeader";
import { createAmbientBackgroundLayer } from "./ambientBackground";
import { createUndoRedoHistory } from "./history/undoRedo";
import { openPresetManagerModal } from "./modals/presetManagerModal";
import { openSettingsModal } from "./modals/settingsModal";
import { maybeShowWelcomeModal } from "./modals/welcomeModal";
import {
  loadPresetSession,
  makePresetExportPayload,
  makeSinglePresetExportPayload,
  parsePresetImportPayload,
  sanitizePresetName,
  savePresetSession,
  type PresetRecord,
  type PresetSession,
} from "./persistence/presetStore";
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

function downloadJSON(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function mountApp(root: HTMLElement, engine: Engine, sched: Scheduler) {
  const settings = loadSettings();
  applyUserCss(settings.ui.customCss);

  const clonePatch = (p: Patch): Patch => structuredClone(p);
  const clonePreset = (preset: PresetRecord): PresetRecord => structuredClone(preset);

  let session: PresetSession = loadPresetSession();

  const selectedPreset = () => {
    return (
      session.presets.find((preset) => preset.id === session.selectedPresetId) ??
      session.presets[0] ?? {
        id: "fallback",
        name: "Fallback",
        patch: defaultPatch(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
    );
  };

  let patch: Patch = clonePatch(selectedPreset().patch);
  let savedSnapshot = JSON.stringify(patch);

  const hasUnsavedChanges = () => JSON.stringify(patch) !== savedSnapshot;

  const syncEngineFromPatch = (nextPatch: Patch, regen = true) => {
    sched.setBpm(nextPatch.bpm);
    sched.setPatch(nextPatch, { regen });
    if (regen) sched.regenAll();
    engine.setMasterMute(nextPatch.masterMute);
    engine.setMasterGain(nextPatch.masterGain);
    engine.syncRouting(nextPatch);
  };

  const saveSession = () => savePresetSession(session);

  const saveCurrentPreset = () => {
    const idx = session.presets.findIndex((preset) => preset.id === session.selectedPresetId);
    if (idx < 0) return;

    const nextPreset = clonePreset(session.presets[idx]);
    nextPreset.patch = clonePatch(patch);
    nextPreset.updatedAt = Date.now();
    session.presets[idx] = nextPreset;

    savedSnapshot = JSON.stringify(patch);
    saveSession();

    header.updatePresetUI();
    header.updateStatus();
  };

  const maybeAutosaveCurrentPreset = () => {
    if (settings.data.autosave) saveCurrentPreset();
    else header.updatePresetUI();
  };

  const applyPatch = (nextPatch: Patch) => {
    patch = nextPatch;
    syncEngineFromPatch(patch, true);

    if (settings.data.autosave) {
      savedSnapshot = JSON.stringify(patch);
      saveCurrentPreset();
    }

    gridRenderer.rerender();
    header.updateMuteBtn();
    header.updateMasterGainUI();
    header.updateBpmUI();
    header.updateStatus();
    header.updatePresetUI();
  };

  const history = createUndoRedoHistory(
    () => patch,
    (nextPatch) => {
      patch = nextPatch;
    },
    applyPatch
  );

  const onPatchChange = (fn: (p: Patch) => void, opts?: { regen?: boolean }) => {
    const prev = clonePatch(patch);
    fn(patch);
    history.pushHistory(prev);

    sched.setPatch(patch, { regen: opts?.regen ?? false });
    if (opts?.regen) sched.regenAll();
    engine.syncRouting(patch);

    maybeAutosaveCurrentPreset();
  };

  const ensureSafeLoad = () => {
    if (!hasUnsavedChanges()) return true;

    return confirm(
      "You have unsaved changes in the current preset. Load another preset anyway? Unsaved edits will be lost."
    );
  };

  const loadPresetById = (presetId: string) => {
    if (!ensureSafeLoad()) {
      header.updatePresetUI();
      return;
    }

    const nextPreset = session.presets.find((preset) => preset.id === presetId);
    if (!nextPreset) return;

    session.selectedPresetId = nextPreset.id;
    patch = clonePatch(nextPreset.patch);
    savedSnapshot = JSON.stringify(patch);

    syncEngineFromPatch(patch, true);
    saveSession();

    gridRenderer.rerender();
    header.updatePresetUI();
    header.updateMuteBtn();
    header.updateMasterGainUI();
    header.updateBpmUI();
    header.updateStatus();
  };

  const createPresetFromCurrent = () => {
    const baseName = `Preset ${session.presets.length + 1}`;
    const now = Date.now();
    const preset: PresetRecord = {
      id: `preset-${now}`,
      name: baseName,
      patch: clonePatch(patch),
      createdAt: now,
      updatedAt: now,
    };

    session.presets.push(preset);
    session.selectedPresetId = preset.id;
    patch = clonePatch(preset.patch);
    savedSnapshot = JSON.stringify(patch);
    saveSession();
    header.updatePresetUI();
    header.updateStatus();
  };

  const renamePreset = (presetId: string, proposedName: string) => {
    const preset = session.presets.find((item) => item.id === presetId);
    if (!preset) return;
    preset.name = sanitizePresetName(proposedName, preset.name);
    preset.updatedAt = Date.now();
    saveSession();
    header.updatePresetUI();
  };

  const duplicatePreset = (presetId: string) => {
    const source = session.presets.find((item) => item.id === presetId);
    if (!source) return;

    const now = Date.now();
    const duplicate: PresetRecord = {
      id: `preset-${now}`,
      name: `${source.name} Copy`,
      patch: clonePatch(source.patch),
      createdAt: now,
      updatedAt: now,
    };

    session.presets.push(duplicate);
    session.selectedPresetId = duplicate.id;
    patch = clonePatch(duplicate.patch);
    savedSnapshot = JSON.stringify(patch);
    syncEngineFromPatch(patch, true);
    saveSession();
    gridRenderer.rerender();
    header.updatePresetUI();
    header.updateMuteBtn();
    header.updateMasterGainUI();
    header.updateBpmUI();
    header.updateStatus();
  };

  const deletePreset = (presetId: string) => {
    const preset = session.presets.find((item) => item.id === presetId);
    if (!preset) return;

    if (session.presets.length <= 1) {
      alert("At least one preset must exist.");
      return;
    }

    if (!confirm(`Delete preset \"${preset.name}\"? This cannot be undone.`)) return;

    session.presets = session.presets.filter((item) => item.id !== presetId);
    if (session.selectedPresetId === presetId) {
      session.selectedPresetId = session.presets[0].id;
      patch = clonePatch(session.presets[0].patch);
      savedSnapshot = JSON.stringify(patch);
      syncEngineFromPatch(patch, true);
      gridRenderer.rerender();
      header.updateMuteBtn();
      header.updateMasterGainUI();
      header.updateBpmUI();
    }

    saveSession();
    header.updatePresetUI();
    header.updateStatus();
  };

  const exportCurrentPreset = () => {
    const preset = selectedPreset();
    const payload = makeSinglePresetExportPayload({ ...preset, patch: clonePatch(preset.patch) });
    const safeName = preset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "preset";
    downloadJSON(`gridi-${safeName}.json`, payload);
  };

  const exportSession = () => {
    const payload = makePresetExportPayload(session);
    downloadJSON("gridi-session.json", payload);
  };

  const importFromFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const raw = await file.text();
      const imported = parsePresetImportPayload(raw);
      if (!imported) {
        alert("Invalid preset/session JSON file.");
        return;
      }

      if (!ensureSafeLoad()) return;

      const merged = imported.presets.map((preset, idx) => {
        if (!session.presets.some((existing) => existing.id === preset.id)) return preset;
        return { ...preset, id: `${preset.id}-${Date.now()}-${idx}` };
      });

      session.presets.push(...merged);
      session.selectedPresetId = merged[0]?.id ?? session.selectedPresetId;
      const next = selectedPreset();
      patch = clonePatch(next.patch);
      savedSnapshot = JSON.stringify(patch);
      syncEngineFromPatch(patch, true);
      saveSession();
      gridRenderer.rerender();
      header.updatePresetUI();
      header.updateMuteBtn();
      header.updateMasterGainUI();
      header.updateBpmUI();
      header.updateStatus();
    };
    input.click();
  };

  const { getVoiceTab, setVoiceTab } = createVoiceTabsState();

  syncEngineFromPatch(patch, true);

  root.innerHTML = "";

  const background = createAmbientBackgroundLayer(root);
  const shell = document.createElement("div");
  shell.className = "appShell";
  root.appendChild(shell);

  const main = document.createElement("main");

  const led = (moduleId: string) => {
    const module = getSoundModules(patch).find((m) => m.id === moduleId);
    const active = module?.enabled ?? false;
    const ms = engine.voiceLastTrigMs.get(moduleId) || 0;
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
    saveAndPersist: maybeAutosaveCurrentPreset,
    getVoiceTab,
    setVoiceTab,
    led,
  });

  const header = createTransportHeader({
    root: shell,
    patch: () => patch,
    presetLabel: () => `${selectedPreset().name}${hasUnsavedChanges() ? " *" : ""}`,
    presetNames: () => session.presets.map((preset) => ({ id: preset.id, name: preset.name })),
    selectedPresetId: () => session.selectedPresetId,
    hasUnsavedChanges,
    settingsExperimental: () => settings.ui.experimental,
    audioState: () => engine.ctx.state,
    isPlaying: () => sched.running,
    onOpenSettings: () =>
      openSettingsModal({
        settings,
        applyUserCss,
        updateStatus: header.updateStatus,
      }),
    onOpenPresetManager: () =>
      openPresetManagerModal({
        presets: session.presets,
        selectedPresetId: session.selectedPresetId,
        dirty: hasUnsavedChanges(),
        onSelectPreset: loadPresetById,
        onCreatePreset: createPresetFromCurrent,
        onRenamePreset: renamePreset,
        onDuplicatePreset: duplicatePreset,
        onDeletePreset: deletePreset,
        onSaveCurrentPreset: saveCurrentPreset,
        onExportCurrentPreset: exportCurrentPreset,
        onExportSession: exportSession,
        onImportFile: importFromFile,
      }),
    onSelectPreset: loadPresetById,
    onSavePreset: saveCurrentPreset,
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
      maybeAutosaveCurrentPreset();
      header.updateMuteBtn();
      header.updateStatus();
    },
    onReset: () => {
      patch = defaultPatch();
      syncEngineFromPatch(patch, true);
      maybeAutosaveCurrentPreset();
      gridRenderer.rerender();
      header.updateMuteBtn();
      header.updateMasterGainUI();
      header.updateBpmUI();
      header.updateStatus();
      header.updatePresetUI();
    },
    onReseed: () => {
      const prev = clonePatch(patch);
      const triggers = getTriggers(patch);
      for (const t of triggers) t.seed = randInt(1, 999999);
      history.pushHistory(prev);
      sched.setPatch(patch, { regen: true });
      sched.regenAll();
      maybeAutosaveCurrentPreset();
      gridRenderer.rerender();
    },
    onRandomize: () => {
      const prev = clonePatch(patch);
      const triggers = getTriggers(patch);
      for (const t of triggers) {
        t.subdiv = [1, 2, 4, 8][randInt(0, 3)] as any;
        t.length = randInt(8, 32);
        t.density = clamp(0.05 + rand01() * 0.9, 0, 1);
        t.drop = clamp(rand01() * 0.35, 0, 1);
        t.determinism = clamp(rand01(), 0, 1);
        t.weird = clamp(rand01(), 0, 1);
        t.euclidRot = randInt(-16, 16);
        t.caRule = randInt(0, 255);
        t.caInit = clamp(rand01(), 0, 1);
        t.gravity = clamp(rand01(), 0, 1);
      }
      const sounds = getSoundModules(patch);
      for (const s of sounds) s.pan = clamp((rand01() - 0.5) * 2, -1, 1);
      history.pushHistory(prev);
      sched.setPatch(patch, { regen: true });
      sched.regenAll();
      maybeAutosaveCurrentPreset();
      gridRenderer.rerender();
    },
    onRegen: () => {
      sched.setPatch(patch, { regen: true });
      sched.regenAll();
      header.updateStatus();
    },
    onSetBpm: (v: number) => {
      patch.bpm = clamp(v, 40, 240);
      sched.setBpm(patch.bpm);
      header.updateBpmUI();
      maybeAutosaveCurrentPreset();
    },
    onSetMasterGain: (v: number) => {
      patch.masterGain = clamp(v, 0, 1);
      engine.setMasterGain(patch.masterGain);
      header.updateMasterGainUI();
      maybeAutosaveCurrentPreset();
    },
  });

  shell.appendChild(main);

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

      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveCurrentPreset();
        return;
      }
    }

    if (!typing && e.code === "Space") {
      e.preventDefault();
      header.btnPlay.click();
    }
  });

  gridRenderer.rerender();
  header.updatePresetUI();
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

  const frame = (timestamp: number) => {
    background.updateFrame(timestamp);
    gridRenderer.updateFrame();
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}
