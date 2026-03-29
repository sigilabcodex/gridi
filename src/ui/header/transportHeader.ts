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
  getMasterActivity: () => { level: number; transient: number; active: boolean };
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
  transportRow.className = "transportRow transportRowPrimary";

  const sessionRow = document.createElement("div");
  sessionRow.className = "transportRow transportRowSession";

  const status = document.createElement("div");
  status.className = "small transportStatus";

  const outputCenter = document.createElement("div");
  outputCenter.className = "transportOutputCenter";
  outputCenter.setAttribute("aria-label", "Main output activity");

  const outputLabel = document.createElement("span");
  outputLabel.className = "small transportOutputLabel";
  outputLabel.textContent = "Main Out";

  const outputMeter = document.createElement("div");
  outputMeter.className = "transportOutputMeter";
  outputMeter.setAttribute("aria-hidden", "true");

  const outputFill = document.createElement("div");
  outputFill.className = "transportOutputFill";

  const outputTransient = document.createElement("div");
  outputTransient.className = "transportOutputTransient";

  outputMeter.append(outputFill, outputTransient);
  outputCenter.append(outputLabel, outputMeter);

  const btnSettings = el("button", "iconBtn", "⚙");
  btnSettings.classList.add("transportSettings");
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
  transportCluster.append(btnPlay, btnMute);

  const masterWrap = el("div", "bpmWrap");
  masterWrap.classList.add("transportDial");
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
  masterWrap.append(masterLab, master, masterNum);

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
  bpmWrap.append(bpmLabel, bpm, bpmNum);

  const tempoCluster = document.createElement("section");
  tempoCluster.className = "transportCluster transportClusterTempo";
  tempoCluster.setAttribute("aria-label", "Tempo and master");
  tempoCluster.append(bpmWrap, masterWrap);

  const statusCluster = document.createElement("section");
  statusCluster.className = "transportCluster transportClusterStatus";
  statusCluster.setAttribute("aria-label", "Status and settings");
  statusCluster.append(outputCenter, status, btnAudio, btnSettings);

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

  const btnPresetManager = document.createElement("button");
  btnPresetManager.className = "transportGhostBtn";
  btnPresetManager.textContent = "Presets";
  btnPresetManager.onclick = params.onOpenPresetManager;
  params.attachTooltip(btnPresetManager, {
    text: "Open preset management actions like import and export.",
    ariaLabel: "Open preset manager",
  });

  presetWrap.append(presetLabel, presetSelect);

  const sessionActions = document.createElement("div");
  sessionActions.className = "transportActionRow";

  const utilityMenu = document.createElement("details");
  utilityMenu.className = "transportUtilityMenu";

  const utilitySummary = document.createElement("summary");
  utilitySummary.className = "transportGhostBtn transportUtilitySummary";
  utilitySummary.textContent = "Utilities";
  utilitySummary.setAttribute("aria-label", "Open utility patch actions");

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
  const btnReseed = makeUtilityBtn("Re-seed", params.onReseed, "Give all trigger modules fresh random seeds.", "Reseed triggers");
  const btnRandom = makeUtilityBtn("Randomize", params.onRandomize, "Randomize trigger and voice parameters in the patch.", "Randomize patch");
  const btnRegen = makeUtilityBtn("Regen patterns", params.onRegen, "Regenerate pattern outputs without rebuilding the patch.", "Regenerate patterns");

  utilityPanel.append(btnReset, btnReseed, btnRandom, btnRegen);
  utilityMenu.append(utilitySummary, utilityPanel);

  sessionActions.append(btnSavePreset, btnPresetManager, utilityMenu);

  transportRow.append(transportCluster, tempoCluster, statusCluster);
  sessionRow.append(presetWrap, sessionActions);

  const main = document.createElement("div");
  main.className = "transportMain";
  main.append(transportRow, sessionRow);
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
    const play = params.isPlaying() ? "PLAY" : "STOP";
    const audio = params.audioState() === "running" ? "AUDIO READY" : "AUDIO SUSP";
    const experimental = params.settingsExperimental() ? " • EXP" : "";
    status.textContent = `${play} • ${audio}${experimental}`;
  };

  const updateAudioBtn = () => {
    const running = params.audioState() === "running";
    btnAudio.textContent = running ? "Audio: On" : "Audio: Off";
    btnAudio.classList.toggle("isOn", running);
  };

  const updateOutputMeter = () => {
    const activity = params.getMasterActivity();
    outputFill.style.transform = `scaleX(${activity.level.toFixed(3)})`;
    outputTransient.style.opacity = activity.transient.toFixed(3);
    outputCenter.classList.toggle("isActive", activity.active);
  };

  const updatePlayBtn = () => {
    const playing = params.isPlaying();
    btnPlay.textContent = playing ? "■ Stop" : "▶ Play";
  };

  const updateMuteBtn = () => {
    const patch = params.patch();
    btnMute.textContent = patch.masterMute ? "🔇 Unmute" : "🔈 Mute";
    btnMute.classList.toggle("isOn", patch.masterMute);
  };

  const updateMasterGainUI = () => {
    const patch = params.patch();
    master.value = String(patch.masterGain);
    masterNum.value = String(patch.masterGain);
  };

  const updatePresetUI = () => {
    presetLabel.textContent = params.presetLabel();

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
