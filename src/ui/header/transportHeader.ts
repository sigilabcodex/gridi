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
  titleWrap.append(h1, subtitle);

  const status = document.createElement("div");
  status.className = "small";

  const btnSettings = el("button", "iconBtn", "⚙");
  btnSettings.classList.add("transportSettings");
  btnSettings.onclick = params.onOpenSettings;
  params.attachTooltip(btnSettings, {
    text: "Open app settings and UI preferences.",
    ariaLabel: "Settings",
  });

  const btnAudio = document.createElement("button");
  btnAudio.className = "primary";
  btnAudio.onclick = params.onToggleAudio;
  params.attachTooltip(btnAudio, {
    text: "Start or suspend the audio engine for this tab.",
    ariaLabel: "Audio engine",
  });

  const btnPlay = document.createElement("button");
  btnPlay.onclick = params.onTogglePlay;
  params.attachTooltip(btnPlay, {
    text: "Play or stop the current patch.",
    ariaLabel: "Transport play stop",
  });

  const btnMute = document.createElement("button");
  btnMute.onclick = params.onToggleMute;
  params.attachTooltip(btnMute, {
    text: "Mute or unmute the master output.",
    ariaLabel: "Master mute",
  });

  const masterWrap = el("div", "bpmWrap");
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

  const btnReset = document.createElement("button");
  btnReset.textContent = "Reset";
  btnReset.onclick = params.onReset;
  params.attachTooltip(btnReset, {
    text: "Reset the current patch back to the default layout.",
    ariaLabel: "Reset patch",
  });

  const btnReseed = document.createElement("button");
  btnReseed.textContent = "Re-seed";
  btnReseed.onclick = params.onReseed;
  params.attachTooltip(btnReseed, {
    text: "Give all trigger modules fresh random seeds.",
    ariaLabel: "Reseed triggers",
  });

  const btnRandom = document.createElement("button");
  btnRandom.textContent = "Randomize";
  btnRandom.onclick = params.onRandomize;
  params.attachTooltip(btnRandom, {
    text: "Randomize trigger and voice parameters in the patch.",
    ariaLabel: "Randomize patch",
  });

  const btnRegen = document.createElement("button");
  btnRegen.textContent = "Regen";
  btnRegen.onclick = params.onRegen;
  params.attachTooltip(btnRegen, {
    text: "Regenerate pattern outputs without rebuilding the patch.",
    ariaLabel: "Regenerate patterns",
  });

  const presetWrap = document.createElement("div");
  presetWrap.className = "presetWrap";

  const presetLabel = document.createElement("div");
  presetLabel.className = "small";

  const presetSelect = document.createElement("select");
  presetSelect.className = "presetSelect";
  presetSelect.onchange = () => params.onSelectPreset(presetSelect.value);
  params.attachTooltip(presetSelect, {
    text: "Choose the active preset for the current session.",
    ariaLabel: "Preset selector",
  });

  const btnSavePreset = document.createElement("button");
  btnSavePreset.onclick = params.onSavePreset;
  params.attachTooltip(btnSavePreset, {
    text: "Save the current patch into the selected preset.",
    ariaLabel: "Save preset",
  });

  const btnPresetManager = document.createElement("button");
  btnPresetManager.textContent = "Presets";
  btnPresetManager.onclick = params.onOpenPresetManager;
  params.attachTooltip(btnPresetManager, {
    text: "Open preset management actions like import and export.",
    ariaLabel: "Open preset manager",
  });

  presetWrap.append(presetLabel, presetSelect);

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

  status.classList.add("transportStatus");

  const makeGroup = (title: string, className: string) => {
    const group = document.createElement("section");
    group.className = `transportGroup ${className}`;

    const groupLabel = document.createElement("div");
    groupLabel.className = "small transportGroupLabel";
    groupLabel.textContent = title;

    const groupBody = document.createElement("div");
    groupBody.className = "transportGroupBody";

    group.append(groupLabel, groupBody);
    return { group, groupBody };
  };

  const transportGroup = makeGroup("Transport", "transportGroupTransport");
  transportGroup.groupBody.append(btnAudio, btnPlay, btnMute);

  const sessionGroup = makeGroup("Patch / Session", "transportGroupSession");
  const sessionActions = document.createElement("div");
  sessionActions.className = "transportActionRow";
  sessionActions.append(btnSavePreset, btnPresetManager, btnReset, btnReseed, btnRandom, btnRegen);
  sessionGroup.groupBody.append(presetWrap, sessionActions);

  const masterGroup = makeGroup("Tempo / Master", "transportGroupMaster");
  masterGroup.groupBody.append(bpmWrap, masterWrap);

  const statusGroup = makeGroup("Status", "transportGroupStatus");
  const statusActions = document.createElement("div");
  statusActions.className = "transportStatusActions";
  statusActions.append(status, btnSettings);
  statusGroup.groupBody.append(statusActions);

  const main = document.createElement("div");
  main.className = "transportMain";
  main.append(transportGroup.group, sessionGroup.group, masterGroup.group, statusGroup.group);
  main.id = "transport-main-controls";

  mobileToggle.setAttribute("aria-controls", main.id);

  titleWrap.appendChild(mobileToggle);
  header.append(titleWrap, main);

  const mobileMql = typeof window === "undefined" || typeof window.matchMedia !== "function"
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
    status.textContent = `status: ${params.isPlaying() ? "playing" : "stopped"} | audio: ${params.audioState()}${
      params.settingsExperimental() ? " | experimental: ON" : ""
    }`;
  };

  const updateAudioBtn = () => {
    btnAudio.textContent = params.audioState() === "running" ? "Audio ON" : "Audio OFF";
  };

  const updatePlayBtn = () => {
    btnPlay.textContent = params.isPlaying() ? "Stop" : "Play";
  };

  const updateMuteBtn = () => {
    const patch = params.patch();
    btnMute.textContent = patch.masterMute ? "Unmute" : "Mute";
    btnMute.className = patch.masterMute ? "primary" : "";
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
    btnSavePreset.className = params.hasUnsavedChanges() ? "primary" : "";
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
  };
}
