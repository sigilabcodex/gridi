import type { Module, Patch } from "../patch";
import { clamp, defaultPatch, emptyPatch, getSoundModules, getTriggers, isEffect } from "../patch";
import type { Engine } from "../engine/audio";
import type { Scheduler } from "../engine/scheduler";
import { loadSettings } from "../settings/store";
import { createTransportHeader } from "./header/transportHeader";
import { createAmbientBackgroundLayer } from "./ambientBackground";
import { setControlStylePreference } from "./env";
import { createUndoRedoHistory } from "./history/undoRedo";
import { openPresetManagerModal } from "./modals/presetManagerModal";
import { openSettingsModal } from "./modals/settingsModal";
import { maybeShowWelcomeModal } from "./modals/welcomeModal";
import {
  firstFactoryExamplePatch,
  loadPresetSession,
  makePresetExportPayload,
  makeSinglePresetExportPayload,
  parsePresetImportPayload,
  resetPresetSessionToFactoryExamples,
  restoreMissingFactoryExamples,
  sanitizePresetName,
  savePresetSession,
  type PresetRecord,
  type PresetSession,
} from "./persistence/presetStore";
import {
  applyModulePreset,
  loadModulePresetLibrary,
  saveModulePresetFromModule,
  saveModulePresetLibrary,
  type ModulePresetRecord,
} from "./persistence/modulePresetStore";
import { createModuleGridRenderer } from "./render/moduleGrid";
import { createVoiceTabsState } from "./state/voiceTabs";
import { createTooltipController } from "./tooltip";
import { createMidiInputManager, type MidiInputStatus } from "./midiInput";
import { formatDocumentTitle } from "../version";

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

function connectionTopologySignature(patch: Patch) {
  return patch.connections
    .map((conn) => {
      const toId = conn.to.id ?? "";
      return `${conn.id}|${conn.enabled ? 1 : 0}|${conn.fromModuleId}|${conn.fromPort}|${conn.to.type}|${toId}|${conn.to.port}`;
    })
    .sort();
}

function effectTopologySignature(patch: Patch) {
  return patch.modules
    .filter(isEffect)
    .map((module) => `${module.id}|${module.type}|${module.kind}`)
    .sort();
}

function moduleTopologySignature(patch: Patch) {
  return patch.modules
    .map((module) => `${module.id}|${module.type}`)
    .sort();
}

function routeTopologySignature(patch: Patch) {
  return (patch.routes ?? [])
    .map((route) => {
      const sourceId = route.source.kind === "module"
        ? route.source.moduleId
        : route.source.kind === "bus"
          ? route.source.busId
          : route.source.kind === "external"
            ? `${route.source.externalType}:${route.source.portId ?? ""}:${route.source.channel ?? ""}`
            : "master";
      const sourcePort = "port" in route.source ? route.source.port ?? "" : "";

      const targetId = route.target.kind === "module"
        ? route.target.moduleId
        : route.target.kind === "bus"
          ? route.target.busId
          : route.target.kind === "external"
            ? `${route.target.externalType}:${route.target.portId ?? ""}:${route.target.channel ?? ""}`
            : "master";
      const targetPort = "port" in route.target ? route.target.port ?? "" : "";

      return `${route.domain}|${route.enabled ? 1 : 0}|${route.source.kind}|${sourceId}|${sourcePort}|${route.target.kind}|${targetId}|${targetPort}|${route.metadata?.parameter ?? ""}|${route.metadata?.lane ?? ""}`;
    })
    .sort();
}

function hasRoutingTopologyChange(prev: Patch, next: Patch) {
  const prevConnections = connectionTopologySignature(prev);
  const nextConnections = connectionTopologySignature(next);
  if (prevConnections.length !== nextConnections.length) return true;
  for (let i = 0; i < prevConnections.length; i++) {
    if (prevConnections[i] !== nextConnections[i]) return true;
  }

  const prevEffects = effectTopologySignature(prev);
  const nextEffects = effectTopologySignature(next);
  if (prevEffects.length !== nextEffects.length) return true;
  for (let i = 0; i < prevEffects.length; i++) {
    if (prevEffects[i] !== nextEffects[i]) return true;
  }

  const prevModules = moduleTopologySignature(prev);
  const nextModules = moduleTopologySignature(next);
  if (prevModules.length !== nextModules.length) return true;
  for (let i = 0; i < prevModules.length; i++) {
    if (prevModules[i] !== nextModules[i]) return true;
  }

  const prevRoutes = routeTopologySignature(prev);
  const nextRoutes = routeTopologySignature(next);
  if (prevRoutes.length !== nextRoutes.length) return true;
  for (let i = 0; i < prevRoutes.length; i++) {
    if (prevRoutes[i] !== nextRoutes[i]) return true;
  }

  return false;
}

export function mountApp(root: HTMLElement, engine: Engine, sched: Scheduler) {
  const settings = loadSettings();
  setControlStylePreference(settings.ui.controlStyle);
  applyUserCss(settings.ui.customCss);
  const tooltips = createTooltipController({
    getEnabled: () => settings.ux.tooltips,
  });

  const clonePatch = (p: Patch): Patch => structuredClone(p);
  const clonePreset = (preset: PresetRecord): PresetRecord => structuredClone(preset);

  let session: PresetSession = loadPresetSession();
  let modulePresetLibrary: ModulePresetRecord[] = loadModulePresetLibrary();

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
  const updateDocumentTitle = () => {
    document.title = formatDocumentTitle(selectedPreset()?.name);
  };

  let patch: Patch = clonePatch(selectedPreset().patch);
  let savedSnapshot = JSON.stringify(patch);
  let midiTargetModuleId: string | null = patch.modules.find((module) => module.type === "tonal")?.id ?? null;
  let midiStatus: MidiInputStatus = { kind: "pending" };
  let preferredMidiInputId: string | null = null;

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
  const saveModulePresetLibraryState = () => saveModulePresetLibrary(modulePresetLibrary);

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

  const refreshAfterModulePresetChange = () => {
    gridRenderer.rerender();
    header.updatePresetUI();
    header.updateStatus();
  };

  const loadModulePresetIntoModule = (moduleId: string, presetId: string) => {
    const preset = modulePresetLibrary.find((record) => record.id === presetId);
    if (!preset) return;

    onPatchChange((draft) => {
      const module = draft.modules.find((item) => item.id === moduleId) as Module | undefined;
      if (!module) return;
      applyModulePreset(module, preset);
    }, { regen: preset.family === "trigger" });

    refreshAfterModulePresetChange();
  };

  const saveModulePresetFromInstance = (moduleId: string, name: string, overwritePresetId?: string | null) => {
    let didSaveLibrary = false;
    onPatchChange((draft) => {
      const module = draft.modules.find((item) => item.id === moduleId) as Module | undefined;
      if (!module) return;
      const saved = saveModulePresetFromModule(modulePresetLibrary, module, { name, overwritePresetId });
      if (!saved) return;
      didSaveLibrary = true;
    }, { regen: false });

    if (didSaveLibrary) saveModulePresetLibraryState();
    refreshAfterModulePresetChange();
  };

  const applyPatch = (nextPatch: Patch) => {
    patch = nextPatch;
    if (midiTargetModuleId && !patch.modules.some((module) => module.id === midiTargetModuleId && module.type === "tonal")) {
      engine.stopAllMidiVoices(midiTargetModuleId);
      midiTargetModuleId = patch.modules.find((module) => module.type === "tonal")?.id ?? null;
    }
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

  let activeHistoryGesture: { baseline: Patch; baselineSerialized: string } | null = null;

  const beginHistoryGesture = () => {
    if (activeHistoryGesture) return;
    activeHistoryGesture = {
      baseline: clonePatch(patch),
      baselineSerialized: JSON.stringify(patch),
    };
  };

  const endHistoryGesture = () => {
    if (!activeHistoryGesture) return;
    const changed = JSON.stringify(patch) !== activeHistoryGesture.baselineSerialized;
    if (changed) history.pushHistory(activeHistoryGesture.baseline);
    activeHistoryGesture = null;
  };

  const onPatchChange = (fn: (p: Patch) => void, opts?: { regen?: boolean }) => {
    const prev = clonePatch(patch);
    fn(patch);
    if (!activeHistoryGesture) history.pushHistory(prev);
    for (const prevModule of prev.modules) {
      if (prevModule.type !== "tonal") continue;
      const nextModule = patch.modules.find((module) => module.id === prevModule.id);
      const removedOrDisabled = !nextModule || nextModule.type !== "tonal" || !nextModule.enabled;
      const receptionChanged = nextModule?.type === "tonal" && nextModule.reception !== prevModule.reception;
      if (removedOrDisabled || receptionChanged) engine.stopAllMidiVoices(prevModule.id);
    }

    sched.setPatch(patch, { regen: opts?.regen ?? false });
    if (opts?.regen) sched.regenAll();
    if (hasRoutingTopologyChange(prev, patch)) engine.syncRouting(patch);

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
    updateDocumentTitle();
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
      source: "user",
    };

    session.presets.push(preset);
    session.selectedPresetId = preset.id;
    patch = clonePatch(preset.patch);
    savedSnapshot = JSON.stringify(patch);
    saveSession();
    header.updatePresetUI();
    header.updateStatus();
    updateDocumentTitle();
  };

  const createSessionFromPatchTemplate = (template: "empty" | "example") => {
    const label = template === "empty" ? "empty" : "example";
    const fallbackName = template === "empty" ? `Session ${session.presets.length + 1}` : "Example 01 · Basic Pulse Copy";
    const proposed = prompt(`New ${label} session name`, fallbackName);
    if (proposed === null) return;
    const now = Date.now();
    const preset: PresetRecord = {
      id: `preset-${now}`,
      name: sanitizePresetName(proposed, fallbackName),
      patch: template === "empty" ? emptyPatch() : firstFactoryExamplePatch(),
      createdAt: now,
      updatedAt: now,
      source: "user",
    };
    session.presets.push(preset);
    session.selectedPresetId = preset.id;
    patch = clonePatch(preset.patch);
    savedSnapshot = JSON.stringify(patch);
    syncEngineFromPatch(patch, true);
    saveSession();
    gridRenderer.rerender();
    header.updatePresetUI();
    header.updateMuteBtn();
    header.updateMasterGainUI();
    header.updateBpmUI();
    header.updateStatus();
    updateDocumentTitle();
  };
  const createEmptySession = () => createSessionFromPatchTemplate("empty");
  const createExampleSession = () => createSessionFromPatchTemplate("example");

  const saveCurrentAsNewSession = () => {
    const source = selectedPreset();
    const proposed = prompt("Save current patch as session", `${source.name} Copy`);
    if (proposed === null) return;
    const now = Date.now();
    const duplicate: PresetRecord = {
      id: `preset-${now}`,
      name: sanitizePresetName(proposed, `${source.name} Copy`),
      patch: clonePatch(patch),
      createdAt: now,
      updatedAt: now,
      source: "user",
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
    updateDocumentTitle();
  };

  const renamePreset = (presetId: string, proposedName: string) => {
    const preset = session.presets.find((item) => item.id === presetId);
    if (!preset) return;
    preset.name = sanitizePresetName(proposedName, preset.name);
    preset.updatedAt = Date.now();
    saveSession();
    header.updatePresetUI();
    if (session.selectedPresetId === presetId) updateDocumentTitle();
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
      source: "user",
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
    updateDocumentTitle();
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
    updateDocumentTitle();
  };


  const loadSessionState = (nextSession: PresetSession) => {
    session = nextSession;
    const next = selectedPreset();
    session.selectedPresetId = next.id;
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
    updateDocumentTitle();
  };

  const restoreFactoryExamples = () => {
    const before = session.presets.length;
    const nextSession = restoreMissingFactoryExamples(session);
    const added = nextSession.presets.length - before;
    session = nextSession;
    saveSession();
    header.updatePresetUI();
    header.updateStatus();
    if (added > 0) alert(`Restored ${added} missing factory example${added === 1 ? "" : "s"}. Local user sessions were preserved.`);
    else alert("Factory examples are already present. Local user sessions were preserved.");
  };

  const resetToFactoryExamples = () => {
    loadSessionState(resetPresetSessionToFactoryExamples());
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
      updateDocumentTitle();
    };
    input.click();
  };

  const { getVoiceTab, setVoiceTab } = createVoiceTabsState();

  const noteToFreqHz = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
  const freqToMidiFloat = (freq: number) => 69 + 12 * Math.log2(freq / 440);
  const getMidiInputRoute = () => {
    const routes = patch.routes ?? [];
    for (const route of routes) {
      if (!route.enabled || route.domain !== "midi") continue;
      if (route.source.kind !== "external" || route.source.externalType !== "midi") continue;
      if (route.target.kind !== "module") continue;
      const targetModuleId = route.target.moduleId;
      if (!patch.modules.some((module) => module.id === targetModuleId && module.type === "tonal")) continue;
      return route;
    }
    return null;
  };
  const getMidiRouteTargetModuleId = () => {
    const route = getMidiInputRoute();
    if (!route || route.target.kind !== "module") return null;
    return route.target.moduleId;
  };
  const getMidiRouteInputId = () => {
    const route = getMidiInputRoute();
    if (!route || route.source.kind !== "external") return null;
    return route.source.portId ?? null;
  };
  const setMidiInputRoute = (targetModuleId: string | null, inputId: string | null) => {
    onPatchChange((draft) => {
      const keptRoutes = (draft.routes ?? []).filter((route) => !(
        route.domain === "midi" &&
        route.source.kind === "external" &&
        route.source.externalType === "midi"
      ));
      if (targetModuleId) {
        keptRoutes.push({
          id: `midi-in:${inputId ?? "auto"}:${targetModuleId}`,
          domain: "midi",
          source: { kind: "external", externalType: "midi", portId: inputId ?? undefined },
          target: { kind: "module", moduleId: targetModuleId, port: "midi-in" },
          enabled: true,
          metadata: { createdFrom: "ui", lane: "midi-in" },
        });
      }
      draft.routes = keptRoutes;
    }, { regen: false });
  };
  const resolveMidiTarget = () => {
    const midiRoute = getMidiInputRoute();
    if (midiRoute && midiRoute.target.kind === "module") {
      const explicitTargetId = midiRoute.target.moduleId;
      const explicit = patch.modules.find((module) => module.id === explicitTargetId && module.type === "tonal" && module.enabled);
      if (explicit) {
        midiTargetModuleId = explicit.id;
        return explicit;
      }
    }
    if (midiTargetModuleId) {
      const current = patch.modules.find((module) => module.id === midiTargetModuleId && module.type === "tonal");
      if (current?.enabled) return current;
    }
    const fallback = patch.modules.find((module) => module.type === "tonal" && module.enabled) ?? null;
    if (fallback) midiTargetModuleId = fallback.id;
    return fallback;
  };
  const noteOffsetForTarget = (note: number, targetId: string) => {
    const soundModules = getSoundModules(patch);
    const index = soundModules.findIndex((module) => module.id === targetId);
    if (index < 0) return 0;
    const target = soundModules[index];
    if (target.type !== "tonal") return 0;
    const basePool = [55, 82.41, 110, 146.83, 196, 220];
    const base = basePool[index % basePool.length] ?? 110;
    const octave = 1 + Math.floor(index / basePool.length) % 2;
    const coarseRatio = Math.pow(2, target.coarseTune / 12);
    const fineRatio = Math.pow(2, target.fineTune / 12);
    const baseFreq = base * octave * coarseRatio * fineRatio * (0.92 + patch.macro * 0.16);
    const noteFreq = noteToFreqHz(note);
    return freqToMidiFloat(noteFreq) - freqToMidiFloat(baseFreq);
  };

  const midiInput = createMidiInputManager({
    onStatus: (status) => {
      midiStatus = status;
      header.updateMidiUI();
      gridRenderer.rerender();
    },
    onNote: (message) => {
      const target = resolveMidiTarget();
      if (!target) return;
      const noteOffset = noteOffsetForTarget(message.note, target.id);
      if (message.type === "noteon") {
        engine.triggerVoice(target.id, patch, undefined, {
          kind: "note",
          source: "midi",
          gate: "on",
          midiNote: message.note,
          velocity: message.velocity,
          notes: [noteOffset],
          timeSec: engine.ctx.currentTime,
        });
        return;
      }
      engine.triggerVoice(target.id, patch, undefined, {
        kind: "note",
        source: "midi",
        gate: "off",
        midiNote: message.note,
        velocity: 0,
        notes: [noteOffset],
        timeSec: engine.ctx.currentTime,
      });
    },
  });

  syncEngineFromPatch(patch, true);

  root.innerHTML = "";

  const background = createAmbientBackgroundLayer(root, () => engine.getMasterActivity());
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
    attachTooltip: tooltips.attachTooltip,
    modulePresetRecords: modulePresetLibrary,
    onLoadModulePreset: loadModulePresetIntoModule,
    onSaveModulePreset: saveModulePresetFromInstance,
    onInspectModule: (moduleId) => {
      const module = patch.modules.find((item) => item.id === moduleId);
      if (!module || module.type !== "tonal") return;
      if (getMidiInputRoute()) return;
      if (midiTargetModuleId === module.id) return;
      if (midiTargetModuleId) engine.stopAllMidiVoices(midiTargetModuleId);
      midiTargetModuleId = module.id;
      header.updateMidiUI();
      gridRenderer.rerender();
    },
    isMidiTargetModule: (moduleId) => moduleId === midiTargetModuleId,
  });

  const header = createTransportHeader({
    root: shell,
    patch: () => patch,
    presetNames: () => session.presets.map((preset) => ({ id: preset.id, name: preset.name })),
    selectedPresetId: () => session.selectedPresetId,
    hasUnsavedChanges,
    settingsExperimental: () => settings.ui.experimental,
    audioState: () => engine.ctx.state,
    isPlaying: () => sched.running,
    getMasterActivity: () => engine.getMasterActivity(),
    onOpenSettings: () =>
      openSettingsModal({
        settings,
        applyUserCss,
        updateStatus: header.updateStatus,
        onTooltipsChange: () => tooltips.refreshEnabled(),
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
        onRestoreFactoryExamples: restoreFactoryExamples,
        onResetToFactoryExamples: resetToFactoryExamples,
        onSaveCurrentPreset: saveCurrentPreset,
        onExportCurrentPreset: exportCurrentPreset,
        onExportSession: exportSession,
        onImportFile: importFromFile,
      }),
    onSelectPreset: loadPresetById,
    onSavePreset: saveCurrentPreset,
    onSaveAsPreset: saveCurrentAsNewSession,
    onNewEmptySession: createEmptySession,
    onNewExampleSession: createExampleSession,
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
    onStop: () => {
      if (!sched.running) return;
      sched.stop();
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
      if (!confirm("Reset only the current session patch to the default layout? Module presets and other sessions are unchanged.")) return;
      const prev = clonePatch(patch);
      patch = defaultPatch();
      history.pushHistory(prev);
      syncEngineFromPatch(patch, true);
      maybeAutosaveCurrentPreset();
      gridRenderer.rerender();
      header.updateMuteBtn();
      header.updateMasterGainUI();
      header.updateBpmUI();
      header.updateStatus();
      header.updatePresetUI();
      updateDocumentTitle();
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
    onInspectRoutingModule: (moduleId) => {
      gridRenderer.setRoutingInspect(moduleId);
    },
    attachTooltip: tooltips.attachTooltip,
    midiStatus: () => midiStatus,
    midiTargetLabel: () => {
      const routeTargetId = getMidiRouteTargetModuleId();
      const fallbackTargetId = routeTargetId ?? midiTargetModuleId;
      const target = patch.modules.find((module) => module.id === fallbackTargetId && module.type === "tonal");
      return target ? target.name : null;
    },
    onSelectMidiInput: (inputId) => {
      preferredMidiInputId = inputId;
      midiInput.setPreferredInput(inputId);
      const targetId = getMidiRouteTargetModuleId();
      if (targetId) setMidiInputRoute(targetId, inputId);
      header.updateMidiUI();
      header.updateRoutingOverview();
    },
    onSetMidiTargetModule: (moduleId) => {
      if (midiTargetModuleId && midiTargetModuleId !== moduleId) engine.stopAllMidiVoices(midiTargetModuleId);
      const existingInputId = getMidiRouteInputId() ?? preferredMidiInputId;
      midiTargetModuleId = moduleId;
      setMidiInputRoute(moduleId, existingInputId ?? null);
      header.updateMidiUI();
      header.updateRoutingOverview();
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

  const onGestureStart = () => beginHistoryGesture();
  const onGestureEnd = () => endHistoryGesture();
  document.addEventListener("gridi-history-gesture-start", onGestureStart as EventListener);
  document.addEventListener("gridi-history-gesture-end", onGestureEnd as EventListener);

  gridRenderer.rerender();
  header.updatePresetUI();
  header.updateMuteBtn();
  header.updateMasterGainUI();
  header.updateBpmUI();
  header.updateAudioBtn();
  header.updatePlayBtn();
  header.updateStatus();
  header.updateMidiUI();
  updateDocumentTitle();

  void midiInput.init().then(() => {
    const existing = getMidiInputRoute();
    const routeInputId = existing?.source.kind === "external" ? existing.source.portId ?? null : null;
    preferredMidiInputId = routeInputId;
    midiInput.setPreferredInput(routeInputId);
    header.updateMidiUI();
    header.updateRoutingOverview();
  });

  maybeShowWelcomeModal({
    settings,
    engine,
    updateAudioBtn: header.updateAudioBtn,
    updateStatus: header.updateStatus,
  });

  const frame = (timestamp: number) => {
    background.updateFrame(timestamp);
    gridRenderer.updateFrame();
    header.updateOutputMeter();
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);

  window.addEventListener("beforeunload", () => {
    midiInput.dispose();
    engine.stopAllMidiVoices();
  });
}
