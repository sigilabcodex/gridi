import type { Patch } from "../../patch";
import { APP_DISPLAY_NAME } from "../../version";
import { el } from "../modals/modal";
import type { TooltipBinder } from "../tooltip";

type HeaderParams = {
  root: HTMLElement;
  patch: () => Patch;
  presetLabel: () => string;
  presetNames: () => { id: string; name: string }[];
  selectedPresetId: () => string;
  hasUnsavedChanges: () => boolean;
  settingsExperimental: () => boolean;
  audioState: () => "running" | string;
  isPlaying: () => boolean;
  getMasterActivity: () => { level: number; transient: number; active: boolean; left: number; right: number };
  onOpenSettings: () => void;
  onOpenPresetManager: () => void;
  onSelectPreset: (presetId: string) => void;
  onSavePreset: () => void;
  onToggleAudio: () => Promise<void>;
  onTogglePlay: () => Promise<void>;
  onToggleMute: () => void;
  onReset: () => void;
  onReseed: () => void;
  onRandomize: () => void;
  onRegen: () => void;
  onSetBpm: (v: number) => void;
  onSetMasterGain: (v: number) => void;
  attachTooltip: TooltipBinder;
};

export function createTransportHeader(params: HeaderParams) {
  const header = document.createElement("header");
  header.classList.add("transportHeader");

  const titleWrap = document.createElement("div");
  titleWrap.className = "transportTitle";

  const h1 = document.createElement("h1");
  h1.textContent = APP_DISPLAY_NAME;

  const subtitle = document.createElement("div");
  subtitle.className = "small transportSubtitle";
  subtitle.textContent = "Modular workspace";

  const mobileToggle = document.createElement("button");
  mobileToggle.className = "transportMobileToggle";
  mobileToggle.type = "button";
  mobileToggle.textContent = "Controls";

  titleWrap.append(h1, subtitle, mobileToggle);

  const transportRow = document.createElement("div");
  transportRow.className = "transportRow transportRowMain";

  const status = document.createElement("div");
  status.className = "small transportStatus";
  const statusPlayback = document.createElement("div");
  statusPlayback.className = "transportStatusLine";
  const statusAudio = document.createElement("div");
  statusAudio.className = "transportStatusLine";
  status.append(statusPlayback, statusAudio);

  const outputCenter = document.createElement("div");
  outputCenter.className = "transportOutputCenter";
  outputCenter.setAttribute("aria-label", "Main output activity");

  const outputMeter = document.createElement("div");
  outputMeter.className = "transportOutputMeter";
  outputMeter.setAttribute("aria-hidden", "true");

  const outputBarLeft = document.createElement("div");
  outputBarLeft.className = "transportOutputBar transportOutputBarLeft";
  const outputFillLeft = document.createElement("div");
  outputFillLeft.className = "transportOutputFill";
  outputBarLeft.appendChild(outputFillLeft);

  const outputBarRight = document.createElement("div");
  outputBarRight.className = "transportOutputBar transportOutputBarRight";
  const outputFillRight = document.createElement("div");
  outputFillRight.className = "transportOutputFill";
  outputBarRight.appendChild(outputFillRight);

  const outputTransient = document.createElement("div");
  outputTransient.className = "transportOutputTransient";

  outputMeter.append(outputBarLeft, outputBarRight, outputTransient);
  outputCenter.append(outputMeter);

  const btnSettings = document.createElement("button");
  btnSettings.className = "iconBtn transportSettings";
  btnSettings.type = "button";
  btnSettings.textContent = "Settings";
  btnSettings.onclick = params.onOpenSettings;
  params.attachTooltip(btnSettings, {
    text: "Open app settings and UI preferences.",
    ariaLabel: "Settings",
  });

  const btnAudio = document.createElement("button");
  btnAudio.className = "transportAudioChip";
  btnAudio.onclick = params.onToggleAudio;
  params.attachTooltip(btnAudio, {
    text: "Start or suspend the audio engine for this tab.",
    ariaLabel: "Audio engine",
  });

  const btnPlay = document.createElement("button");
  btnPlay.className = "transportPrimaryBtn";
  btnPlay.onclick = params.onTogglePlay;
  params.attachTooltip(btnPlay, {
    text: "Play or stop the current patch.",
    ariaLabel: "Transport play stop",
  });

  const btnMute = document.createElement("button");
  btnMute.className = "transportGhostBtn";
  btnMute.onclick = params.onToggleMute;
  params.attachTooltip(btnMute, {
    text: "Mute or unmute the master output.",
    ariaLabel: "Master mute",
  });

  const transportCluster = document.createElement("section");
  transportCluster.className = "transportCluster transportClusterPrimary";
  transportCluster.setAttribute("aria-label", "Transport");
  const btnStop = document.createElement("button");
  btnStop.className = "transportGhostBtn";
  btnStop.type = "button";
  btnStop.textContent = "Stop";
  btnStop.onclick = params.onTogglePlay;
  params.attachTooltip(btnStop, {
    text: "Stop the current patch playback.",
    ariaLabel: "Transport stop",
  });

  transportCluster.append(btnPlay, btnStop, btnMute);

  const masterWrap = el("div", "bpmWrap");
  masterWrap.classList.add("transportDial", "transportDialMaster");
  const masterLab = el("div", "small", "Master");
  const master = document.createElement("input");
  master.type = "range";
  master.min = "0";
  master.max = "1";
  master.step = "0.001";

  const masterNum = document.createElement("input");
  masterNum.type = "number";
  masterNum.min = "0";
  masterNum.max = "1";
  masterNum.step = "0.001";
  masterNum.className = "transportDialNumber transportChipInput";

  master.oninput = () => params.onSetMasterGain(parseFloat(master.value));
  masterNum.onchange = () => params.onSetMasterGain(parseFloat(masterNum.value));
  params.attachTooltip(master, {
    text: "Adjust the overall master output level.",
    ariaLabel: "Master gain slider",
  });
  params.attachTooltip(masterNum, {
    text: "Enter the master output level directly.",
    ariaLabel: "Master gain value",
  });
  const masterValueWrap = document.createElement("div");
  masterValueWrap.className = "transportValueRow";
  masterValueWrap.append(masterNum);
  masterWrap.append(masterLab, master, masterValueWrap);

  const bpmWrap = document.createElement("div");
  bpmWrap.className = "bpmWrap transportDial";

  const bpmLabel = document.createElement("div");
  bpmLabel.className = "small";
  bpmLabel.textContent = "BPM";

  const bpm = document.createElement("input");
  bpm.type = "range";
  bpm.min = "40";
  bpm.max = "240";
  bpm.step = "1";

  const bpmNum = document.createElement("input");
  bpmNum.type = "number";
  bpmNum.min = "40";
  bpmNum.max = "240";
  bpmNum.className = "transportDialNumber transportChipInput";

  bpm.oninput = () => params.onSetBpm(parseInt(bpm.value, 10));
  bpmNum.onchange = () => params.onSetBpm(parseInt(bpmNum.value, 10));
  params.attachTooltip(bpm, {
    text: "Adjust the global tempo in beats per minute.",
    ariaLabel: "Tempo slider",
  });
  params.attachTooltip(bpmNum, {
    text: "Enter the tempo in beats per minute.",
    ariaLabel: "Tempo value",
  });
  const bpmValueWrap = document.createElement("div");
  bpmValueWrap.className = "transportValueRow";
  bpmValueWrap.append(bpmNum);
  bpmWrap.append(bpmLabel, bpm, bpmValueWrap);

  const tempoCluster = document.createElement("section");
  tempoCluster.className = "transportCluster transportClusterTempo";
  tempoCluster.setAttribute("aria-label", "Tempo and master");
  tempoCluster.append(bpmWrap, masterWrap);

  const statusCluster = document.createElement("section");
  statusCluster.className = "transportCluster transportClusterStatus";
  statusCluster.setAttribute("aria-label", "Status");
  statusCluster.append(btnAudio, outputCenter);
  statusCluster.prepend(status);

  const sessionCluster = document.createElement("section");
  sessionCluster.className = "transportCluster transportClusterSession";
  sessionCluster.setAttribute("aria-label", "Session and utilities");

  const sessionBlock = document.createElement("div");
  sessionBlock.className = "transportSessionBlock";

  const presetWrap = document.createElement("div");
  presetWrap.className = "presetWrap transportPresetWrap";

  const presetLabel = document.createElement("div");
  presetLabel.className = "small transportPresetLabel";

  const presetSelect = document.createElement("select");
  presetSelect.className = "presetSelect";
  presetSelect.onchange = () => params.onSelectPreset(presetSelect.value);
  params.attachTooltip(presetSelect, {
    text: "Choose the active preset for the current session.",
    ariaLabel: "Preset selector",
  });

  const btnSavePreset = document.createElement("button");
  btnSavePreset.className = "transportGhostBtn";
  btnSavePreset.onclick = params.onSavePreset;
  params.attachTooltip(btnSavePreset, {
    text: "Save the current patch into the selected preset.",
    ariaLabel: "Save preset",
  });

  const sessionSelectRow = document.createElement("div");
  sessionSelectRow.className = "transportSessionSelectRow";
  sessionSelectRow.append(presetSelect, btnSavePreset);

  presetWrap.append(presetLabel, sessionSelectRow);

  const sessionActions = document.createElement("div");
  sessionActions.className = "transportActionRow";

  const utilityMenu = document.createElement("details");
  utilityMenu.className = "transportUtilityMenu transportSecondaryMenu";

  const utilitySummary = document.createElement("summary");
  utilitySummary.className = "transportGhostBtn transportUtilitySummary";
  utilitySummary.textContent = "Actions";
  utilitySummary.setAttribute("aria-label", "Open session and utility actions");

  const utilityPanel = document.createElement("div");
  utilityPanel.className = "transportUtilityPanel";

  const makeUtilityBtn = (label: string, onClick: () => void, tooltip: string, ariaLabel: string) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "transportGhostBtn transportUtilityBtn";
    btn.textContent = label;
    btn.onclick = () => {
      onClick();
      utilityMenu.removeAttribute("open");
    };
    params.attachTooltip(btn, { text: tooltip, ariaLabel });
    return btn;
  };

  const btnReset = makeUtilityBtn("Reset patch", params.onReset, "Reset the current patch back to the default layout.", "Reset patch");
  const btnRandom = makeUtilityBtn("Randomize", params.onRandomize, "Randomize trigger and voice parameters in the patch.", "Randomize patch");
  const btnRegen = makeUtilityBtn("Regen", params.onRegen, "Regenerate pattern outputs without rebuilding the patch.", "Regenerate patterns");
  const btnReseed = makeUtilityBtn("Reseed", params.onReseed, "Give all trigger modules fresh random seeds.", "Reseed triggers");

  const makePlaceholderBtn = (label: string) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "transportGhostBtn transportUtilityBtn isPlaceholder";
    btn.textContent = label;
    btn.disabled = true;
    return btn;
  };
  const saveAsPlaceholder = makePlaceholderBtn("Save As (soon)");
  const undoPlaceholder = makePlaceholderBtn("Undo (soon)");
  const redoPlaceholder = makePlaceholderBtn("Redo (soon)");

  utilityPanel.append(btnReset, btnRandom, btnRegen, btnReseed, saveAsPlaceholder, undoPlaceholder, redoPlaceholder);
  utilityMenu.append(utilitySummary, utilityPanel);

  sessionActions.append(utilityMenu);
  sessionBlock.append(presetWrap, sessionActions);
  sessionCluster.append(sessionBlock);

  const settingsDock = document.createElement("div");
  settingsDock.className = "transportSettingsDock";
  settingsDock.append(btnSettings);

  transportRow.append(transportCluster, tempoCluster, sessionCluster, statusCluster, settingsDock);

  const main = document.createElement("div");
  main.className = "transportMain";
  main.append(transportRow);
  main.id = "transport-main-controls";

  mobileToggle.setAttribute("aria-controls", main.id);
  header.append(titleWrap, main);

  const mobileMql =
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? null
      : window.matchMedia("(max-width: 760px)");

  let mobileExpanded = false;
  const syncMobileHeaderState = () => {
    const mobileActive = mobileMql?.matches ?? false;
    header.classList.toggle("isMobile", mobileActive);
    header.classList.toggle("mobileCollapsed", mobileActive && !mobileExpanded);
    mobileToggle.setAttribute("aria-expanded", mobileExpanded ? "true" : "false");
    mobileToggle.textContent = mobileExpanded ? "Hide" : "Controls";
    mobileToggle.hidden = !mobileActive;
  };

  const setMobileExpanded = (next: boolean) => {
    mobileExpanded = next;
    syncMobileHeaderState();
  };

  mobileToggle.onclick = () => setMobileExpanded(!mobileExpanded);

  if (mobileMql) {
    mobileMql.addEventListener("change", () => {
      if (!mobileMql.matches) mobileExpanded = false;
      syncMobileHeaderState();
    });
  }

  syncMobileHeaderState();

  params.root.appendChild(header);

  const updateStatus = () => {
    const play = params.isPlaying() ? "playing" : "stopped";
    const audio = params.audioState() === "running" ? "ready" : "suspended";
    const experimental = params.settingsExperimental() ? " (exp)" : "";
    statusPlayback.textContent = `status: ${play}`;
    statusAudio.textContent = `audio: ${audio}${experimental}`;
  };

  const updateAudioBtn = () => {
    const running = params.audioState() === "running";
    btnAudio.textContent = running ? "Audio: On" : "Audio: Off";
    btnAudio.classList.toggle("isOn", running);
  };

  const updateOutputMeter = () => {
    const activity = params.getMasterActivity();
    const left = Number.isFinite(activity.left) ? activity.left : activity.level;
    const right = Number.isFinite(activity.right) ? activity.right : activity.level;
    outputFillLeft.style.transform = `scaleX(${left.toFixed(3)})`;
    outputFillRight.style.transform = `scaleX(${right.toFixed(3)})`;
    outputTransient.style.opacity = activity.transient.toFixed(3);
    outputCenter.classList.toggle("isActive", activity.active);
  };

  const updatePlayBtn = () => {
    const playing = params.isPlaying();
    btnPlay.textContent = playing ? "Pause" : "Play";
    btnStop.disabled = !playing;
  };

  const updateMuteBtn = () => {
    const patch = params.patch();
    btnMute.textContent = patch.masterMute ? "Unmute" : "Mute";
    btnMute.classList.toggle("isOn", patch.masterMute);
  };

  const updateMasterGainUI = () => {
    const patch = params.patch();
    master.value = String(patch.masterGain);
    masterNum.value = String(patch.masterGain);
  };

  const updatePresetUI = () => {
    presetLabel.textContent = `Bank • ${params.presetLabel()}`;

    const selected = params.selectedPresetId();
    const names = params.presetNames();

    presetSelect.innerHTML = "";
    names.forEach((preset) => {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.name;
      if (preset.id === selected) option.selected = true;
      presetSelect.appendChild(option);
    });

    btnSavePreset.textContent = params.hasUnsavedChanges() ? "Save*" : "Save";
    btnSavePreset.classList.toggle("primary", params.hasUnsavedChanges());
  };

  const updateBpmUI = () => {
    const patch = params.patch();
    bpm.value = String(patch.bpm);
    bpmNum.value = String(patch.bpm);
  };

  return {
    btnPlay,
    updateStatus,
    updateAudioBtn,
    updatePlayBtn,
    updateMuteBtn,
    updateMasterGainUI,
    updatePresetUI,
    updateBpmUI,
    updateOutputMeter,
  };
}
