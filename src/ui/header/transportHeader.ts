import type { Patch } from "../../patch";
import { APP_NAME, APP_SUBTITLE, getVersionTooltipText } from "../../version";
import { bindFloatingPanelReposition, placeFloatingPanel } from "../floatingPanel";
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
  const makeIcon = (name: "play" | "stop" | "mute" | "unmute" | "audioOn" | "audioOff" | "settings" | "actions" | "save") => {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.classList.add("transportIconGlyph");
    const stroke = (d: string) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.8");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      icon.appendChild(path);
    };
    const fill = (d: string) => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("fill", "currentColor");
      icon.appendChild(path);
    };
    if (name === "play") fill("M8 6l10 6-10 6z");
    if (name === "stop") fill("M7 7h10v10H7z");
    if (name === "mute") {
      stroke("M4 10h4l5-4v12l-5-4H4z");
      stroke("M16 9l4 6");
      stroke("M20 9l-4 6");
    }
    if (name === "unmute") {
      stroke("M4 10h4l5-4v12l-5-4H4z");
      stroke("M17 9.5a4 4 0 010 5");
      stroke("M19.5 7a7.5 7.5 0 010 10");
    }
    if (name === "audioOn") {
      stroke("M12 2v6");
      stroke("M7.5 5A7 7 0 1016.5 5");
    }
    if (name === "audioOff") {
      stroke("M12 2v6");
      stroke("M7.5 5A7 7 0 1016.5 5");
      stroke("M5 5l14 14");
    }
    if (name === "settings") {
      stroke("M12 8.2A3.8 3.8 0 1112 16a3.8 3.8 0 010-7.8z");
      stroke("M12 2.7v2.2");
      stroke("M12 19.1v2.2");
      stroke("M3.8 12h2.2");
      stroke("M18 12h2.2");
      stroke("M5.8 5.8l1.5 1.5");
      stroke("M16.7 16.7l1.5 1.5");
      stroke("M18.2 5.8l-1.5 1.5");
      stroke("M7.3 16.7l-1.5 1.5");
    }
    if (name === "actions") {
      stroke("M7 6h10");
      stroke("M7 12h10");
      stroke("M7 18h10");
      fill("M4.5 5.2h1.8v1.8H4.5z");
      fill("M4.5 11.2h1.8V13H4.5z");
      fill("M4.5 17.2h1.8V19H4.5z");
    }
    if (name === "save") {
      stroke("M5 4h12l2 2v14H5z");
      stroke("M8 4v6h8");
      stroke("M9 18h6");
    }
    return icon;
  };

  const header = document.createElement("header");
  header.classList.add("transportHeader");

  const titleWrap = document.createElement("div");
  titleWrap.className = "transportTitle";

  const h1 = document.createElement("h1");
  h1.textContent = APP_NAME;

  const subtitle = document.createElement("div");
  subtitle.className = "small transportSubtitle";
  subtitle.textContent = APP_SUBTITLE;

  titleWrap.tabIndex = 0;
  params.attachTooltip(titleWrap, {
    text: getVersionTooltipText(),
    ariaLabel: `${APP_NAME} version details`,
    preferredSide: "bottom",
    align: "start",
  });

  const mobileToggle = document.createElement("button");
  mobileToggle.className = "transportMobileToggle";
  mobileToggle.type = "button";
  mobileToggle.textContent = "Controls";

  titleWrap.append(h1, subtitle, mobileToggle);

  const transportRow = document.createElement("div");
  transportRow.className = "transportRow transportRowMain";
  const zoneIdentity = document.createElement("div");
  zoneIdentity.className = "transportZone transportZoneIdentity";
  const zoneCenter = document.createElement("div");
  zoneCenter.className = "transportZone transportZoneCenter";
  const zoneRight = document.createElement("div");
  zoneRight.className = "transportZone transportZoneRight";

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
  btnSettings.className = "iconBtn transportSettings transportIconBtn";
  btnSettings.type = "button";
  btnSettings.append(makeIcon("settings"));
  btnSettings.onclick = params.onOpenSettings;
  params.attachTooltip(btnSettings, {
    text: "Open app settings and UI preferences.",
    ariaLabel: "Settings",
  });

  const btnAudio = document.createElement("button");
  btnAudio.className = "transportAudioChip transportIconBtn";
  btnAudio.onclick = params.onToggleAudio;
  params.attachTooltip(btnAudio, {
    text: "Start or suspend the audio engine for this tab.",
    ariaLabel: "Audio engine",
  });

  const btnPlay = document.createElement("button");
  btnPlay.className = "transportPrimaryBtn transportIconBtn";
  btnPlay.onclick = params.onTogglePlay;
  params.attachTooltip(btnPlay, {
    text: "Play or stop the current patch.",
    ariaLabel: "Transport play stop",
  });

  const btnMute = document.createElement("button");
  btnMute.className = "transportGhostBtn transportIconBtn";
  btnMute.onclick = params.onToggleMute;
  params.attachTooltip(btnMute, {
    text: "Mute or unmute the master output.",
    ariaLabel: "Master mute",
  });

  const transportCluster = document.createElement("section");
  transportCluster.className = "transportCluster transportClusterPrimary";
  transportCluster.setAttribute("aria-label", "Transport");
  const btnStop = document.createElement("button");
  btnStop.className = "transportGhostBtn transportIconBtn";
  btnStop.type = "button";
  btnStop.append(makeIcon("stop"));
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

  const presetButton = document.createElement("button");
  presetButton.type = "button";
  presetButton.className = "presetSelect transportPresetTrigger";
  presetButton.setAttribute("aria-haspopup", "listbox");
  presetButton.setAttribute("aria-expanded", "false");
  presetButton.textContent = "Select preset";
  params.attachTooltip(presetButton, {
    text: "Choose the active preset for the current session.",
    ariaLabel: "Preset selector",
  });

  const btnSavePreset = document.createElement("button");
  btnSavePreset.className = "transportGhostBtn transportIconBtn transportSaveBtn";
  btnSavePreset.onclick = params.onSavePreset;
  params.attachTooltip(btnSavePreset, {
    text: "Save the current patch into the selected preset.",
    ariaLabel: "Save preset",
  });

  const sessionSelectRow = document.createElement("div");
  sessionSelectRow.className = "transportSessionSelectRow";
  sessionSelectRow.append(presetButton, btnSavePreset);

  presetWrap.append(presetLabel, sessionSelectRow);

  const sessionActions = document.createElement("div");
  sessionActions.className = "transportActionRow";

  const utilityMenu = document.createElement("div");
  utilityMenu.className = "transportUtilityMenu transportSecondaryMenu";

  const utilitySummary = document.createElement("button");
  utilitySummary.type = "button";
  utilitySummary.className = "transportGhostBtn transportUtilitySummary transportIconBtn";
  utilitySummary.append(makeIcon("actions"));
  utilitySummary.setAttribute("aria-label", "Open session and utility actions");
  utilitySummary.setAttribute("aria-haspopup", "menu");
  utilitySummary.setAttribute("aria-expanded", "false");

  const utilityPanel = document.createElement("div");
  utilityPanel.className = "floatingPanel transportUtilityPanel hidden";
  utilityPanel.setAttribute("role", "menu");

  const makeUtilityBtn = (label: string, onClick: () => void, tooltip: string, ariaLabel: string) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "transportGhostBtn transportUtilityBtn";
    btn.textContent = label;
    btn.setAttribute("role", "menuitem");
    btn.onclick = () => {
      onClick();
      closeUtilityMenu();
    };
    params.attachTooltip(btn, { text: tooltip, ariaLabel });
    return btn;
  };

  const btnReset = makeUtilityBtn("Reset patch", params.onReset, "Reset the current patch back to the default layout.", "Reset patch");
  const btnRandom = makeUtilityBtn("Randomize all", params.onRandomize, "Randomize trigger and voice parameters in the patch.", "Randomize patch");
  const btnRegen = makeUtilityBtn("Regen", params.onRegen, "Regenerate pattern outputs without rebuilding the patch.", "Regenerate patterns");
  const btnReseed = makeUtilityBtn("Reseed all", params.onReseed, "Give all trigger modules fresh random seeds.", "Reseed triggers");

  const makePlaceholderBtn = (label: string) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "transportGhostBtn transportUtilityBtn isPlaceholder";
    btn.textContent = label;
    btn.disabled = true;
    return btn;
  };
  const randomizeSelectedPlaceholder = makePlaceholderBtn("Randomize selected (soon)");
  const randomizeGroupsPlaceholder = makePlaceholderBtn("Randomize groups (soon)");
  const saveAsPlaceholder = makePlaceholderBtn("Save As (soon)");

  const appendUtilitySection = (title: string, buttons: HTMLButtonElement[]) => {
    const label = document.createElement("div");
    label.className = "small transportUtilitySectionLabel";
    label.textContent = title;
    const row = document.createElement("div");
    row.className = "transportUtilitySection";
    row.append(...buttons);
    utilityPanel.append(label, row);
  };

  appendUtilitySection("Session", [btnReset, btnRegen, saveAsPlaceholder]);
  appendUtilitySection("Randomize", [btnRandom, btnReseed, randomizeSelectedPlaceholder, randomizeGroupsPlaceholder]);
  utilityMenu.append(utilitySummary);

  sessionActions.append(utilityMenu);
  sessionBlock.append(presetWrap, sessionActions);
  sessionCluster.append(sessionBlock);

  const settingsDock = document.createElement("div");
  settingsDock.className = "transportSettingsDock";
  settingsDock.append(btnSettings);

  const centerGroup = document.createElement("div");
  centerGroup.className = "transportCenterGroup";
  centerGroup.append(transportCluster, tempoCluster, sessionCluster);

  zoneIdentity.append(titleWrap);
  zoneCenter.append(centerGroup);
  zoneRight.append(statusCluster, settingsDock);
  transportRow.append(zoneIdentity, zoneCenter, zoneRight);

  const main = document.createElement("div");
  main.className = "transportMain";
  main.append(transportRow);
  main.id = "transport-main-controls";

  mobileToggle.setAttribute("aria-controls", main.id);
  header.append(main);

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

  const presetPanel = document.createElement("div");
  presetPanel.className = "floatingPanel transportPresetPanel hidden";
  presetPanel.setAttribute("role", "listbox");
  presetPanel.setAttribute("aria-label", "Session preset list");
  document.body.appendChild(presetPanel);

  let presetPanelCleanup: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let activePresetIndex = -1;
  let presetOptions: HTMLButtonElement[] = [];

  const updatePresetHighlight = () => {
    presetOptions.forEach((option, index) => {
      const active = index === activePresetIndex;
      option.classList.toggle("isActive", active);
      option.setAttribute("aria-selected", active ? "true" : "false");
    });
  };

  const closePresetMenu = () => {
    if (presetPanel.classList.contains("hidden")) return;
    presetPanel.classList.add("hidden");
    presetButton.setAttribute("aria-expanded", "false");
    presetPanelCleanup?.destroy();
    presetPanelCleanup = null;
    activePresetIndex = -1;
  };

  const openPresetMenu = (focusActive = false) => {
    const names = params.presetNames();
    const selectedId = params.selectedPresetId();
    presetPanel.innerHTML = "";
    presetOptions = names.map((preset, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "transportGhostBtn transportPresetOption";
      option.textContent = preset.name;
      option.value = preset.id;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.classList.toggle("isSelected", preset.id === selectedId);
      option.onclick = () => {
        params.onSelectPreset(preset.id);
        closePresetMenu();
        presetButton.focus();
      };
      if (preset.id === selectedId) activePresetIndex = index;
      return option;
    });
    if (activePresetIndex < 0) activePresetIndex = 0;
    presetPanel.append(...presetOptions);
    updatePresetHighlight();
    presetPanel.classList.remove("hidden");
    presetButton.setAttribute("aria-expanded", "true");
    placeFloatingPanel(presetPanel, presetButton.getBoundingClientRect(), {
      offset: 8,
      align: "start",
      preferredSide: "bottom",
      minWidth: 200,
      matchAnchorWidth: true,
      maxWidth: 320,
    });
    presetPanelCleanup = bindFloatingPanelReposition(
      presetPanel,
      () => (presetButton.isConnected ? presetButton.getBoundingClientRect() : null),
      {
        offset: 8,
        align: "start",
        preferredSide: "bottom",
        minWidth: 200,
        matchAnchorWidth: true,
        maxWidth: 320,
      }
    );
    if (focusActive) presetOptions[activePresetIndex]?.focus();
  };

  const movePresetHighlight = (delta: number) => {
    if (!presetOptions.length) return;
    activePresetIndex = (activePresetIndex + delta + presetOptions.length) % presetOptions.length;
    updatePresetHighlight();
    presetOptions[activePresetIndex]?.scrollIntoView({ block: "nearest" });
  };

  presetButton.onclick = () => {
    if (presetPanel.classList.contains("hidden")) openPresetMenu();
    else closePresetMenu();
  };

  presetButton.addEventListener("keydown", (event) => {
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && presetPanel.classList.contains("hidden")) {
      event.preventDefault();
      openPresetMenu(true);
      movePresetHighlight(event.key === "ArrowDown" ? 1 : -1);
    }
  });

  presetPanel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePresetMenu();
      presetButton.focus();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      movePresetHighlight(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      movePresetHighlight(-1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      presetOptions[activePresetIndex]?.click();
    }
  });

  let utilityPanelCleanup: ReturnType<typeof bindFloatingPanelReposition> | null = null;

  const closeUtilityMenu = () => {
    if (utilityPanel.classList.contains("hidden")) return;
    utilityPanel.classList.add("hidden");
    utilitySummary.setAttribute("aria-expanded", "false");
    utilityPanelCleanup?.destroy();
    utilityPanelCleanup = null;
  };

  const openUtilityMenu = () => {
    if (utilityPanel.isConnected) utilityPanel.remove();
    document.body.appendChild(utilityPanel);
    utilityPanel.classList.remove("hidden");
    utilitySummary.setAttribute("aria-expanded", "true");
    placeFloatingPanel(utilityPanel, utilitySummary.getBoundingClientRect(), {
      offset: 8,
      align: "end",
      preferredSide: "bottom",
      minWidth: 180,
      maxWidth: 220,
    });
    utilityPanelCleanup = bindFloatingPanelReposition(
      utilityPanel,
      () => (utilitySummary.isConnected ? utilitySummary.getBoundingClientRect() : null),
      {
        offset: 8,
        align: "end",
        preferredSide: "bottom",
        minWidth: 180,
        maxWidth: 220,
      }
    );
  };

  utilitySummary.onclick = () => {
    if (utilityPanel.classList.contains("hidden")) openUtilityMenu();
    else closeUtilityMenu();
  };

  utilityPanel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeUtilityMenu();
      utilitySummary.focus();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node | null;
    if (target && !presetPanel.classList.contains("hidden")) {
      if (!presetPanel.contains(target) && !presetButton.contains(target)) closePresetMenu();
    }
    if (target && !utilityPanel.classList.contains("hidden")) {
      if (!utilityPanel.contains(target) && !utilitySummary.contains(target)) closeUtilityMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePresetMenu();
      closeUtilityMenu();
    }
  });

  const updateStatus = () => {
    const play = params.isPlaying() ? "playing" : "stopped";
    const audio = params.audioState() === "running" ? "ready" : "suspended";
    const experimental = params.settingsExperimental() ? " (exp)" : "";
    statusPlayback.textContent = `status: ${play}`;
    statusAudio.textContent = `audio: ${audio}${experimental}`;
  };

  const updateAudioBtn = () => {
    const running = params.audioState() === "running";
    btnAudio.replaceChildren(makeIcon(running ? "audioOn" : "audioOff"));
    btnAudio.classList.toggle("isOn", running);
    btnAudio.setAttribute("aria-pressed", running ? "true" : "false");
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
    btnPlay.replaceChildren(makeIcon("play"));
    btnPlay.classList.toggle("isOn", playing);
    btnPlay.setAttribute("aria-pressed", playing ? "true" : "false");
    btnStop.disabled = !playing;
  };

  const updateMuteBtn = () => {
    const patch = params.patch();
    btnMute.replaceChildren(makeIcon(patch.masterMute ? "mute" : "unmute"));
    btnMute.classList.toggle("isOn", patch.masterMute);
    btnMute.setAttribute("aria-pressed", patch.masterMute ? "true" : "false");
  };

  const updateMasterGainUI = () => {
    const patch = params.patch();
    master.value = String(patch.masterGain);
    masterNum.value = String(patch.masterGain);
  };

  const updatePresetUI = () => {
    presetLabel.textContent = `Bank / Session${params.hasUnsavedChanges() ? " • unsaved" : ""}`;

    const names = params.presetNames();
    const selected = names.find((preset) => preset.id === params.selectedPresetId());
    presetButton.textContent = selected?.name ?? "Select preset";
    presetButton.title = selected?.name ?? "Select preset";
    if (!presetPanel.classList.contains("hidden")) openPresetMenu();

    btnSavePreset.replaceChildren(makeIcon("save"));
    btnSavePreset.classList.toggle("primary", params.hasUnsavedChanges());
    btnSavePreset.classList.toggle("hasPending", params.hasUnsavedChanges());
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
