import type { Patch } from "../../patch";
import { APP_NAME, getVersionTooltipText } from "../../version";
import { bindFloatingPanelReposition, placeFloatingPanel } from "../floatingPanel";
import { el } from "../modals/modal";
import type { TooltipBinder } from "../tooltip";

type HeaderParams = {
  root: HTMLElement;
  patch: () => Patch;
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
  onSaveAsPreset: () => void;
  onNewSession: () => void;
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
  const makeIcon = (
    name:
      | "play"
      | "stop"
      | "mute"
      | "unmute"
      | "audioOn"
      | "audioOff"
      | "settings"
      | "session"
      | "save"
      | "generator"
  ) => {
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
    if (name === "session") {
      stroke("M4.5 6.5h15");
      stroke("M4.5 17.5h15");
      stroke("M8 4.5v4");
      stroke("M16 4.5v4");
      stroke("M6.5 9h11v9h-11z");
      stroke("M9 12h6");
    }
    if (name === "save") {
      stroke("M5 4h12l2 2v14H5z");
      stroke("M8 4v6h8");
      stroke("M9 18h6");
    }
    if (name === "generator") {
      stroke("M7 7h10");
      stroke("M7 17h10");
      stroke("M7 7l3-3");
      stroke("M7 7l3 3");
      stroke("M17 17l-3-3");
      stroke("M17 17l-3 3");
      stroke("M10 12h4");
      stroke("M12 10v4");
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
  subtitle.textContent = "Generative Rhythmically Indeterministic\nDigital Instrument";

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
  mobileToggle.textContent = "⋯";

  titleWrap.append(h1, subtitle);

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

  const compactDock = document.createElement("div");
  compactDock.className = "transportCompactDock";

  const compactPrimary = document.createElement("div");
  compactPrimary.className = "transportCompactPrimary";

  const compactUtility = document.createElement("div");
  compactUtility.className = "transportCompactUtility";

  const compactPlay = document.createElement("button");
  compactPlay.className = "transportCompactBtn transportPrimaryBtn transportIconBtn";
  compactPlay.type = "button";
  compactPlay.onclick = params.onTogglePlay;
  params.attachTooltip(compactPlay, {
    text: "Play or stop the current patch.",
    ariaLabel: "Transport play stop",
  });

  const compactAudio = document.createElement("button");
  compactAudio.className = "transportCompactBtn transportAudioChip transportIconBtn";
  compactAudio.type = "button";
  compactAudio.onclick = params.onToggleAudio;
  params.attachTooltip(compactAudio, {
    text: "Start or suspend the audio engine for this tab.",
    ariaLabel: "Audio engine",
  });

  const compactMute = document.createElement("button");
  compactMute.className = "transportCompactBtn transportGhostBtn transportIconBtn";
  compactMute.type = "button";
  compactMute.onclick = params.onToggleMute;
  params.attachTooltip(compactMute, {
    text: "Mute or unmute the master output.",
    ariaLabel: "Master mute",
  });

  const compactSettings = document.createElement("button");
  compactSettings.className = "transportCompactBtn transportGhostBtn transportIconBtn";
  compactSettings.type = "button";
  compactSettings.onclick = params.onOpenSettings;
  compactSettings.append(makeIcon("settings"));
  params.attachTooltip(compactSettings, {
    text: "Open app settings and UI preferences.",
    ariaLabel: "Settings",
  });

  const compactStatus = document.createElement("div");
  compactStatus.className = "small transportCompactStatus";

  compactPrimary.append(compactPlay, compactAudio, compactMute);
  compactUtility.append(compactStatus, mobileToggle, compactSettings);
  compactDock.append(compactPrimary, compactUtility);

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

  const sessionActions = document.createElement("div");
  sessionActions.className = "transportActionRow";

  const sessionMenu = document.createElement("div");
  sessionMenu.className = "transportUtilityMenu transportSecondaryMenu";

  const sessionSummary = document.createElement("button");
  sessionSummary.type = "button";
  sessionSummary.className = "transportGhostBtn transportUtilitySummary transportUtilitySummarySession";
  const sessionSummaryIcon = document.createElement("span");
  sessionSummaryIcon.className = "transportUtilitySummaryIcon";
  sessionSummaryIcon.append(makeIcon("session"));
  const sessionSummaryLabel = document.createElement("span");
  sessionSummaryLabel.className = "transportUtilitySummaryLabel";
  sessionSummaryLabel.textContent = "Session";
  sessionSummary.append(sessionSummaryIcon, sessionSummaryLabel);
  sessionSummary.setAttribute("aria-label", "Open session patch actions");
  sessionSummary.setAttribute("aria-haspopup", "menu");
  sessionSummary.setAttribute("aria-expanded", "false");

  const sessionPanel = document.createElement("div");
  sessionPanel.className = "floatingPanel transportUtilityPanel hidden";
  sessionPanel.setAttribute("role", "menu");

  const generatorMenu = document.createElement("div");
  generatorMenu.className = "transportUtilityMenu transportSecondaryMenu";

  const generatorSummary = document.createElement("button");
  generatorSummary.type = "button";
  generatorSummary.className = "transportGhostBtn transportUtilitySummary transportUtilitySummaryGenerator";
  const generatorSummaryIcon = document.createElement("span");
  generatorSummaryIcon.className = "transportUtilitySummaryIcon";
  generatorSummaryIcon.append(makeIcon("generator"));
  const generatorSummaryLabel = document.createElement("span");
  generatorSummaryLabel.className = "transportUtilitySummaryLabel";
  generatorSummaryLabel.textContent = "Generators";
  generatorSummary.append(generatorSummaryIcon, generatorSummaryLabel);
  generatorSummary.setAttribute("aria-label", "Open generator and randomizer actions");
  generatorSummary.setAttribute("aria-haspopup", "menu");
  generatorSummary.setAttribute("aria-expanded", "false");

  const generatorPanel = document.createElement("div");
  generatorPanel.className = "floatingPanel transportUtilityPanel hidden";
  generatorPanel.setAttribute("role", "menu");

  const makeUtilityBtn = (label: string, onClick: () => void, tooltip: string, ariaLabel: string) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "transportGhostBtn transportUtilityBtn";
    btn.textContent = label;
    btn.setAttribute("role", "menuitem");
    btn.onclick = () => {
      onClick();
      closeSessionMenu();
      closeGeneratorMenu();
    };
    params.attachTooltip(btn, { text: tooltip, ariaLabel });
    return btn;
  };

  const btnReset = makeUtilityBtn(
    "Reset session patch",
    params.onReset,
    "Replace the working session patch with the default module layout. This does not change module preset libraries.",
    "Reset session patch",
  );
  const btnRandom = makeUtilityBtn(
    "Randomize patch",
    params.onRandomize,
    "Randomize generator and voice parameters in the current session patch.",
    "Randomize session patch",
  );
  const btnRegen = makeUtilityBtn(
    "Regen generators",
    params.onRegen,
    "Regenerate generator outputs from current generator parameters without changing patch topology.",
    "Regenerate generators",
  );
  const btnReseed = makeUtilityBtn(
    "Reseed generators",
    params.onReseed,
    "Assign fresh random seeds to all generator modules in this patch.",
    "Reseed generators",
  );

  const btnNewSession = makeUtilityBtn(
    "New session",
    params.onNewSession,
    "Create and switch to a fresh session patch without changing module preset libraries.",
    "New session",
  );
  const btnSaveAs = makeUtilityBtn(
    "Save As…",
    params.onSaveAsPreset,
    "Create a new session from the current patch state.",
    "Save current patch as a new session",
  );
  const btnSessionManagerMenu = makeUtilityBtn(
    "Session manager…",
    params.onOpenPresetManager,
    "Open session manager to organize sessions and import/export files.",
    "Open session manager",
  );

  const btnSaveSession = makeUtilityBtn(
    "Save session",
    params.onSavePreset,
    "Save changes to the active session patch.",
    "Save current session",
  );

  const sessionPresetSectionLabel = document.createElement("div");
  sessionPresetSectionLabel.className = "small transportUtilitySectionLabel";
  sessionPresetSectionLabel.textContent = "Load session";
  const sessionPresetFilter = document.createElement("input");
  sessionPresetFilter.type = "search";
  sessionPresetFilter.className = "transportSessionFilter";
  sessionPresetFilter.placeholder = "Search sessions";
  sessionPresetFilter.maxLength = 72;
  sessionPresetFilter.spellcheck = false;
  const sessionPresetSection = document.createElement("div");
  sessionPresetSection.className = "transportUtilitySection transportSessionList";

  const refreshSessionList = () => {
    const selectedId = params.selectedPresetId();
    const filter = sessionPresetFilter.value.trim().toLowerCase();
    sessionPresetSection.replaceChildren();
    const presets = params.presetNames().filter((preset) => !filter || preset.name.toLowerCase().includes(filter));
    for (const preset of presets) {
      const presetBtn = document.createElement("button");
      presetBtn.type = "button";
      presetBtn.className = "transportGhostBtn transportUtilityBtn transportSessionOption";
      presetBtn.textContent = preset.name;
      presetBtn.setAttribute("role", "menuitemradio");
      const isSelected = preset.id === selectedId;
      presetBtn.setAttribute("aria-checked", isSelected ? "true" : "false");
      presetBtn.classList.toggle("isSelected", isSelected);
      if (isSelected) presetBtn.title = "Active session";
      presetBtn.onclick = () => {
        params.onSelectPreset(preset.id);
        closeSessionMenu();
        sessionSummary.focus();
      };
      sessionPresetSection.append(presetBtn);
    }
    if (!presets.length) {
      const emptyState = document.createElement("div");
      emptyState.className = "small transportSessionEmpty";
      emptyState.textContent = "No sessions match this filter.";
      sessionPresetSection.append(emptyState);
    }
    sessionPresetSectionLabel.textContent = filter
      ? `Load session · ${presets.length} match${presets.length === 1 ? "" : "es"}`
      : "Load session";
  };

  const appendMenuSection = (panel: HTMLElement, title: string, buttons: HTMLButtonElement[]) => {
    const label = document.createElement("div");
    label.className = "small transportUtilitySectionLabel";
    label.textContent = title;
    const row = document.createElement("div");
    row.className = "transportUtilitySection";
    row.append(...buttons);
    panel.append(label, row);
  };

  sessionPresetFilter.addEventListener("input", refreshSessionList);
  sessionPanel.append(sessionPresetSectionLabel, sessionPresetFilter, sessionPresetSection);
  appendMenuSection(sessionPanel, "Session patch", [btnNewSession, btnSaveSession, btnSaveAs, btnSessionManagerMenu, btnReset]);
  appendMenuSection(generatorPanel, "Generator tools", [btnRegen, btnReseed, btnRandom]);
  sessionMenu.append(sessionSummary);
  generatorMenu.append(generatorSummary);

  sessionActions.append(sessionMenu, generatorMenu);
  sessionBlock.append(sessionActions);
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
  header.append(compactDock, main);

  const supportsMedia = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const compactGlobalMql = supportsMedia
    ? window.matchMedia("(max-width: 760px), ((orientation: portrait) and (max-width: 1024px))")
    : null;
  const shortHeightCompactMql = supportsMedia
    ? window.matchMedia("(max-height: 760px) and (max-width: 1366px)")
    : null;

  let compactExpanded = false;
  const syncCompactHeaderState = () => {
    const compactActive = (compactGlobalMql?.matches ?? false) || (shortHeightCompactMql?.matches ?? false);
    const shortHeightActive = shortHeightCompactMql?.matches ?? false;
    header.classList.toggle("isCompactGlobal", compactActive);
    header.classList.toggle("isShortHeightCompact", compactActive && shortHeightActive);
    header.classList.toggle("compactExpanded", compactActive && compactExpanded);
    header.classList.toggle("mobileCollapsed", compactActive && !compactExpanded);
    mobileToggle.setAttribute("aria-expanded", compactExpanded ? "true" : "false");
    mobileToggle.textContent = compactExpanded ? "✕" : "⋯";
    mobileToggle.setAttribute("aria-label", compactExpanded ? "Hide global controls" : "Show global controls");
    mobileToggle.hidden = !compactActive;
    compactDock.setAttribute("aria-hidden", compactActive ? "false" : "true");
  };

  const setCompactExpanded = (next: boolean) => {
    compactExpanded = next;
    syncCompactHeaderState();
  };

  mobileToggle.onclick = () => setCompactExpanded(!compactExpanded);

  const handleCompactQueryChange = () => {
    const active = (compactGlobalMql?.matches ?? false) || (shortHeightCompactMql?.matches ?? false);
    if (!active) compactExpanded = false;
    syncCompactHeaderState();
  };

  compactGlobalMql?.addEventListener("change", handleCompactQueryChange);
  shortHeightCompactMql?.addEventListener("change", handleCompactQueryChange);

  if (!compactGlobalMql && !shortHeightCompactMql) {
    compactExpanded = false;
  }

  syncCompactHeaderState();

  params.root.appendChild(header);

  let sessionPanelCleanup: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let generatorPanelCleanup: ReturnType<typeof bindFloatingPanelReposition> | null = null;

  const closeSessionMenu = () => {
    if (sessionPanel.classList.contains("hidden")) return;
    sessionPanel.classList.add("hidden");
    sessionSummary.setAttribute("aria-expanded", "false");
    sessionPanelCleanup?.destroy();
    sessionPanelCleanup = null;
  };

  const closeGeneratorMenu = () => {
    if (generatorPanel.classList.contains("hidden")) return;
    generatorPanel.classList.add("hidden");
    generatorSummary.setAttribute("aria-expanded", "false");
    generatorPanelCleanup?.destroy();
    generatorPanelCleanup = null;
  };

  const openSessionMenu = () => {
    if (sessionPanel.isConnected) sessionPanel.remove();
    document.body.appendChild(sessionPanel);
    sessionPanel.classList.remove("hidden");
    sessionSummary.setAttribute("aria-expanded", "true");
    refreshSessionList();
    closeGeneratorMenu();
    placeFloatingPanel(sessionPanel, sessionSummary.getBoundingClientRect(), {
      offset: 8,
      align: "end",
      preferredSide: "bottom",
      minWidth: 180,
      maxWidth: 220,
    });
    sessionPanelCleanup = bindFloatingPanelReposition(
      sessionPanel,
      () => (sessionSummary.isConnected ? sessionSummary.getBoundingClientRect() : null),
      {
        offset: 8,
        align: "end",
        preferredSide: "bottom",
        minWidth: 180,
        maxWidth: 220,
      }
    );
    queueMicrotask(() => sessionPresetFilter.focus());
  };

  const openGeneratorMenu = () => {
    if (generatorPanel.isConnected) generatorPanel.remove();
    document.body.appendChild(generatorPanel);
    generatorPanel.classList.remove("hidden");
    generatorSummary.setAttribute("aria-expanded", "true");
    closeSessionMenu();
    placeFloatingPanel(generatorPanel, generatorSummary.getBoundingClientRect(), {
      offset: 8,
      align: "end",
      preferredSide: "bottom",
      minWidth: 180,
      maxWidth: 220,
    });
    generatorPanelCleanup = bindFloatingPanelReposition(
      generatorPanel,
      () => (generatorSummary.isConnected ? generatorSummary.getBoundingClientRect() : null),
      {
        offset: 8,
        align: "end",
        preferredSide: "bottom",
        minWidth: 180,
        maxWidth: 220,
      }
    );
  };

  sessionSummary.onclick = () => {
    if (sessionPanel.classList.contains("hidden")) openSessionMenu();
    else closeSessionMenu();
  };

  generatorSummary.onclick = () => {
    if (generatorPanel.classList.contains("hidden")) openGeneratorMenu();
    else closeGeneratorMenu();
  };

  sessionPanel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSessionMenu();
      sessionSummary.focus();
    }
  });

  generatorPanel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeGeneratorMenu();
      generatorSummary.focus();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node | null;
    if (target && !sessionPanel.classList.contains("hidden")) {
      if (!sessionPanel.contains(target) && !sessionSummary.contains(target)) closeSessionMenu();
    }
    if (target && !generatorPanel.classList.contains("hidden")) {
      if (!generatorPanel.contains(target) && !generatorSummary.contains(target)) closeGeneratorMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSessionMenu();
      closeGeneratorMenu();
    }
  });

  const updateStatus = () => {
    const play = params.isPlaying() ? "playing" : "stopped";
    const audio = params.audioState() === "running" ? "ready" : "suspended";
    const experimental = params.settingsExperimental() ? " (exp)" : "";
    statusPlayback.textContent = `status: ${play}`;
    statusAudio.textContent = `audio: ${audio}${experimental}`;
    compactStatus.textContent = `${params.patch().bpm} BPM · ${play}`;
  };

  const updateAudioBtn = () => {
    const running = params.audioState() === "running";
    btnAudio.replaceChildren(makeIcon(running ? "audioOn" : "audioOff"));
    compactAudio.replaceChildren(makeIcon(running ? "audioOn" : "audioOff"));
    btnAudio.classList.toggle("isOn", running);
    compactAudio.classList.toggle("isOn", running);
    btnAudio.setAttribute("aria-pressed", running ? "true" : "false");
    compactAudio.setAttribute("aria-pressed", running ? "true" : "false");
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
    compactPlay.replaceChildren(makeIcon("play"));
    btnPlay.classList.toggle("isOn", playing);
    compactPlay.classList.toggle("isOn", playing);
    btnPlay.setAttribute("aria-pressed", playing ? "true" : "false");
    compactPlay.setAttribute("aria-pressed", playing ? "true" : "false");
    btnStop.disabled = !playing;
  };

  const updateMuteBtn = () => {
    const patch = params.patch();
    btnMute.replaceChildren(makeIcon(patch.masterMute ? "mute" : "unmute"));
    compactMute.replaceChildren(makeIcon(patch.masterMute ? "mute" : "unmute"));
    btnMute.classList.toggle("isOn", patch.masterMute);
    compactMute.classList.toggle("isOn", patch.masterMute);
    btnMute.setAttribute("aria-pressed", patch.masterMute ? "true" : "false");
    compactMute.setAttribute("aria-pressed", patch.masterMute ? "true" : "false");
  };

  const updateMasterGainUI = () => {
    const patch = params.patch();
    master.value = String(patch.masterGain);
    masterNum.value = String(patch.masterGain);
  };

  const updatePresetUI = () => {
    const names = params.presetNames();
    const selected = names.find((preset) => preset.id === params.selectedPresetId());
    const activeName = selected?.name ?? "Session";
    const pending = params.hasUnsavedChanges();
    sessionSummaryLabel.textContent = pending ? "Session*" : "Session";
    sessionSummary.title = `${activeName}${pending ? " (unsaved)" : ""}`;
    sessionSummary.setAttribute("aria-label", `Open session patch actions for ${activeName}`);
    if (!sessionPanel.classList.contains("hidden")) refreshSessionList();
    btnSaveSession.classList.toggle("primary", pending);
    btnSaveSession.classList.toggle("hasPending", pending);
    btnSaveSession.textContent = pending ? "Save session*" : "Save session";
  };

  const updateBpmUI = () => {
    const patch = params.patch();
    bpm.value = String(patch.bpm);
    bpmNum.value = String(patch.bpm);
    compactStatus.textContent = `${patch.bpm} BPM · ${params.isPlaying() ? "playing" : "stopped"}`;
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
