import type { Patch } from "../../patch";
import { APP_NAME, getVersionTooltipText } from "../../version";
import { bindFloatingPanelReposition, placeFloatingPanel } from "../floatingPanel";
import { createRoutingOverviewPanel } from "./routingOverviewPanel";
import { el } from "../modals/modal";
import type { TooltipBinder } from "../tooltip";
import type { MidiInputStatus } from "../midiInput";

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
  onStop: () => void;
  onToggleMute: () => void;
  onReset: () => void;
  onReseed: () => void;
  onRandomize: () => void;
  onRegen: () => void;
  onSetBpm: (v: number) => void;
  onSetMasterGain: (v: number) => void;
  onInspectRoutingModule?: (moduleId: string | null) => void;
  attachTooltip: TooltipBinder;
  midiStatus: () => MidiInputStatus;
  midiTargetLabel: () => string | null;
  onSelectMidiInput: (inputId: string | null) => void;
  onSetMidiTargetModule: (moduleId: string | null) => void;
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
      | "routing"
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
    if (name === "routing") {
      stroke("M5 6h6");
      stroke("M13 18h6");
      stroke("M8 6v4");
      stroke("M16 14v4");
      stroke("M8 10h8");
      stroke("M16 14h-8");
      stroke("M16 10l2 2-2 2");
      stroke("M8 14l-2-2 2-2");
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
  mobileToggle.textContent = "Controls";

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
  btnStop.onclick = params.onStop;
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
  const midiChip = document.createElement("button");
  midiChip.type = "button";
  midiChip.className = "transportMidiChip transportGhostBtn";
  midiChip.setAttribute("aria-label", "Open MIDI input selector");
  midiChip.setAttribute("aria-haspopup", "menu");
  midiChip.setAttribute("aria-expanded", "false");
  const midiPanel = document.createElement("div");
  midiPanel.className = "floatingPanel transportUtilityPanel hidden";
  midiPanel.setAttribute("role", "menu");
  statusCluster.append(btnAudio, midiChip, outputCenter);
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

  const routingMenu = document.createElement("div");
  routingMenu.className = "transportUtilityMenu transportSecondaryMenu";

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

  const routingSummary = document.createElement("button");
  routingSummary.type = "button";
  routingSummary.className = "transportGhostBtn transportUtilitySummary transportUtilitySummaryRouting";
  const routingSummaryIcon = document.createElement("span");
  routingSummaryIcon.className = "transportUtilitySummaryIcon";
  routingSummaryIcon.append(makeIcon("routing"));
  const routingSummaryLabel = document.createElement("span");
  routingSummaryLabel.className = "transportUtilitySummaryLabel";
  routingSummaryLabel.textContent = "Routing";
  routingSummary.append(routingSummaryIcon, routingSummaryLabel);
  routingSummary.setAttribute("aria-label", "Open global routing overview");
  routingSummary.setAttribute("aria-haspopup", "dialog");
  routingSummary.setAttribute("aria-expanded", "false");

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

  routingMenu.append(routingSummary);
  sessionActions.append(sessionMenu, generatorMenu, routingMenu);
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

  const compactLauncher = document.createElement("button");
  compactLauncher.className = "transportCompactLauncher";
  compactLauncher.type = "button";
  compactLauncher.textContent = "Global";
  compactLauncher.hidden = true;
  compactLauncher.setAttribute("aria-controls", main.id);

  mobileToggle.setAttribute("aria-controls", main.id);
  header.append(main);
  params.root.append(compactLauncher);

  const supportsMedia = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const compactGlobalMql = supportsMedia
    ? window.matchMedia("(max-width: 760px), ((orientation: portrait) and (max-width: 1024px))")
    : null;
  const shortHeightCompactMql = supportsMedia
    ? window.matchMedia("(max-height: 760px) and (max-width: 1366px)")
    : null;

  const syncCompactHeaderState = () => {
    const compactActive = (compactGlobalMql?.matches ?? false) || (shortHeightCompactMql?.matches ?? false);
    const shortHeightActive = shortHeightCompactMql?.matches ?? false;
    header.classList.toggle("isCompactGlobal", compactActive);
    header.classList.toggle("isShortHeightCompact", compactActive && shortHeightActive);
    header.classList.remove("compactExpanded");
    header.classList.toggle("mobileCollapsed", compactActive);
    mobileToggle.setAttribute("aria-expanded", "false");
    compactLauncher.setAttribute("aria-expanded", "false");
    compactLauncher.textContent = "Global";
    mobileToggle.hidden = true;
    compactLauncher.hidden = !compactActive;
  };

  compactLauncher.setAttribute("aria-label", "Open global controls drawer");

  const handleCompactQueryChange = () => {
    syncCompactHeaderState();
  };

  compactGlobalMql?.addEventListener("change", handleCompactQueryChange);
  shortHeightCompactMql?.addEventListener("change", handleCompactQueryChange);

  syncCompactHeaderState();

  params.root.appendChild(header);

  let sessionPanelCleanup: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let generatorPanelCleanup: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let midiPanelCleanup: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  const routingOverview = createRoutingOverviewPanel({
    patch: params.patch,
    attachTo: routingSummary,
    onInspectModule: params.onInspectRoutingModule,
    midiStatus: params.midiStatus,
    onSelectMidiInput: params.onSelectMidiInput,
    onSetMidiTargetModule: params.onSetMidiTargetModule,
  });

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

  const closeRoutingMenu = () => {
    routingOverview.close();
  };

  const closeMidiMenu = () => {
    if (midiPanel.classList.contains("hidden")) return;
    midiPanel.classList.add("hidden");
    midiChip.setAttribute("aria-expanded", "false");
    midiPanelCleanup?.destroy();
    midiPanelCleanup = null;
  };

  const renderMidiPanel = () => {
    midiPanel.replaceChildren();
    const status = params.midiStatus();
    const title = document.createElement("div");
    title.className = "small transportUtilitySectionLabel";
    title.textContent = "MIDI input";
    midiPanel.appendChild(title);

    const section = document.createElement("div");
    section.className = "transportUtilitySection";
    const autoBtn = document.createElement("button");
    autoBtn.type = "button";
    autoBtn.className = "transportGhostBtn transportUtilityBtn";
    autoBtn.setAttribute("role", "menuitemradio");
    const selectedAuto = status.kind === "connected" ? status.selection !== "manual" : true;
    autoBtn.setAttribute("aria-checked", selectedAuto ? "true" : "false");
    autoBtn.classList.toggle("isSelected", selectedAuto);
    autoBtn.textContent = "Auto (prefer hardware)";
    autoBtn.onclick = () => {
      params.onSelectMidiInput(null);
      renderMidiPanel();
    };
    section.appendChild(autoBtn);

    const inputs = status.kind === "connected" || status.kind === "idle" ? status.inputs : [];
    for (const input of inputs) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "transportGhostBtn transportUtilityBtn transportSessionOption";
      button.setAttribute("role", "menuitemradio");
      const selected = status.kind === "connected" && status.inputId === input.id;
      button.classList.toggle("isSelected", selected);
      button.setAttribute("aria-checked", selected ? "true" : "false");
      const virtualTag = input.likelyVirtual ? " · virtual" : "";
      button.textContent = `${input.name}${virtualTag}`;
      button.onclick = () => {
        params.onSelectMidiInput(input.id);
        renderMidiPanel();
      };
      section.appendChild(button);
    }

    if (!inputs.length) {
      const empty = document.createElement("div");
      empty.className = "small transportSessionEmpty";
      empty.textContent = "No MIDI inputs available.";
      section.appendChild(empty);
    }

    midiPanel.appendChild(section);
  };

  const openMidiMenu = () => {
    if (midiPanel.isConnected) midiPanel.remove();
    document.body.appendChild(midiPanel);
    midiPanel.classList.remove("hidden");
    midiChip.setAttribute("aria-expanded", "true");
    renderMidiPanel();
    closeSessionMenu();
    closeGeneratorMenu();
    closeRoutingMenu();
    placeFloatingPanel(midiPanel, midiChip.getBoundingClientRect(), {
      offset: 8,
      align: "end",
      preferredSide: "bottom",
      minWidth: 220,
      maxWidth: 280,
    });
    midiPanelCleanup = bindFloatingPanelReposition(
      midiPanel,
      () => (midiChip.isConnected ? midiChip.getBoundingClientRect() : null),
      {
        offset: 8,
        align: "end",
        preferredSide: "bottom",
        minWidth: 220,
        maxWidth: 280,
      }
    );
  };

  const openSessionMenu = () => {
    if (sessionPanel.isConnected) sessionPanel.remove();
    document.body.appendChild(sessionPanel);
    sessionPanel.classList.remove("hidden");
    sessionSummary.setAttribute("aria-expanded", "true");
    refreshSessionList();
    closeGeneratorMenu();
    closeMidiMenu();
    closeRoutingMenu();
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
    closeMidiMenu();
    closeRoutingMenu();
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

  routingSummary.onclick = () => {
    closeSessionMenu();
    closeGeneratorMenu();
    closeMidiMenu();
    routingOverview.toggle();
  };

  midiChip.onclick = () => {
    if (midiPanel.classList.contains("hidden")) openMidiMenu();
    else closeMidiMenu();
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
    if (target && !midiPanel.classList.contains("hidden")) {
      if (!midiPanel.contains(target) && !midiChip.contains(target)) closeMidiMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSessionMenu();
      closeGeneratorMenu();
      closeMidiMenu();
      closeRoutingMenu();
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
    drawerAudioBtn.replaceChildren(makeIcon(running ? "audioOn" : "audioOff"));
    drawerAudioBtn.classList.toggle("isOn", running);
    drawerAudioBtn.setAttribute("aria-pressed", running ? "true" : "false");
    drawerAudioBtn.setAttribute("aria-label", running ? "Suspend audio engine" : "Start audio engine");
    drawerAudioText.textContent = running ? "Suspend audio" : "Start audio";
    audioDot.classList.toggle("isOn", running);
    audioLabel.textContent = running ? "Audio ready" : "Audio suspended";
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
    drawerPlayBtn.classList.toggle("isOn", playing);
    drawerStopBtn.disabled = !playing;
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
    setChipText();
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
    setChipText();
  };

  const updateMidiUI = () => {
    const status = params.midiStatus();
    const target = params.midiTargetLabel();
    if (status.kind === "unsupported") {
      midiChip.textContent = "MIDI: unsupported";
      midiLabel.textContent = "MIDI unsupported";
      return;
    }
    if (status.kind === "pending") {
      midiChip.textContent = "MIDI: pending";
      midiLabel.textContent = "MIDI pending";
      return;
    }
    if (status.kind === "denied") {
      midiChip.textContent = "MIDI: denied";
      midiLabel.textContent = "MIDI denied";
      return;
    }
    if (status.kind === "idle") {
      midiChip.textContent = "MIDI: unavailable";
      midiLabel.textContent = "MIDI unavailable";
      return;
    }
    if (status.selectedLikelyVirtual) {
      midiChip.textContent = `MIDI: ${status.name} (virtual)`;
      midiLabel.textContent = `MIDI ${status.name}`;
      return;
    }
    const targetLabel = target ? ` → ${target}` : "";
    midiChip.textContent = `MIDI: ${status.name}${targetLabel}`;
    midiLabel.textContent = status.warning ? "MIDI fallback active" : `MIDI ${status.name}`;
    if (status.warning) midiChip.textContent = "MIDI: fallback active";
  };


  const drawer = document.createElement("aside");
  drawer.className = "globalControlsDrawer";
  drawer.setAttribute("aria-label", "Global controls drawer");

  const drawerBackdrop = document.createElement("button");
  drawerBackdrop.type = "button";
  drawerBackdrop.className = "globalControlsDrawerBackdrop";
  drawerBackdrop.setAttribute("aria-label", "Close global controls drawer");

  const drawerPanel = document.createElement("div");
  drawerPanel.className = "globalControlsDrawerPanel";

  const makeDrawerIconButton = (name: "generator" | "routing" | "session", label: string, onClick: () => void) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "globalControlsDrawerIconBtn";
    btn.setAttribute("aria-label", label);
    btn.append(makeIcon(name));
    btn.onclick = onClick;
    return btn;
  };

  const drawerCore = document.createElement("section");
  drawerCore.className = "globalControlsDrawerSection";
  const drawerPlayBtn = document.createElement("button");
  drawerPlayBtn.type = "button";
  drawerPlayBtn.className = "globalControlsDrawerCoreBtn";
  drawerPlayBtn.setAttribute("aria-label", "Play");
  drawerPlayBtn.append(makeIcon("play"));
  drawerPlayBtn.onclick = params.onTogglePlay;

  const drawerStopBtn = document.createElement("button");
  drawerStopBtn.type = "button";
  drawerStopBtn.className = "globalControlsDrawerCoreBtn";
  drawerStopBtn.setAttribute("aria-label", "Stop");
  drawerStopBtn.append(makeIcon("stop"));
  drawerStopBtn.onclick = params.onStop;
  drawerCore.append(drawerPlayBtn, drawerStopBtn);

  const drawerAudioSection = document.createElement("section");
  drawerAudioSection.className = "globalControlsDrawerSection";
  const drawerAudioBtn = document.createElement("button");
  drawerAudioBtn.type = "button";
  drawerAudioBtn.className = "globalControlsDrawerCoreBtn globalControlsDrawerAudioBtn";
  drawerAudioBtn.onclick = params.onToggleAudio;
  const drawerAudioText = document.createElement("span");
  drawerAudioText.className = "globalControlsDrawerAudioText";
  drawerAudioBtn.append(makeIcon("audioOff"), drawerAudioText);
  drawerAudioSection.append(drawerAudioBtn);

  const drawerTempo = document.createElement("section");
  drawerTempo.className = "globalControlsDrawerSection";
  const bpmChip = document.createElement("button");
  bpmChip.type = "button";
  bpmChip.className = "globalControlsDrawerChip";
  const gainChip = document.createElement("button");
  gainChip.type = "button";
  gainChip.className = "globalControlsDrawerChip";
  drawerTempo.append(bpmChip, gainChip);

  const drawerAccess = document.createElement("section");
  drawerAccess.className = "globalControlsDrawerSection globalControlsDrawerAccess";
  const regenBtn = makeDrawerIconButton("generator", "Regeneration tools", () => {
    openGeneratorMenu();
    closeGlobalDrawer();
  });
  const routingBtn = makeDrawerIconButton("routing", "Routing overview", () => {
    routingOverview.toggle();
    closeGlobalDrawer();
  });
  const sessionBtn = makeDrawerIconButton("session", "Session actions", () => {
    openSessionMenu();
    closeGlobalDrawer();
  });
  drawerAccess.append(regenBtn, routingBtn, sessionBtn);

  const drawerStatus = document.createElement("section");
  drawerStatus.className = "globalControlsDrawerSection globalControlsDrawerStatus";
  const audioDot = document.createElement("span");
  audioDot.className = "globalControlsDrawerStatusDot";
  const audioLabel = document.createElement("span");
  audioLabel.className = "globalControlsDrawerStatusText";
  const midiLabel = document.createElement("span");
  midiLabel.className = "globalControlsDrawerStatusText";
  drawerStatus.append(audioDot, audioLabel, midiLabel);

  const drawerSettingsSection = document.createElement("section");
  drawerSettingsSection.className = "globalControlsDrawerSection";
  const drawerSettings = document.createElement("button");
  drawerSettings.type = "button";
  drawerSettings.className = "globalControlsDrawerCoreBtn globalControlsDrawerSettings";
  drawerSettings.setAttribute("aria-label", "Open settings");
  drawerSettings.append(makeIcon("settings"));
  drawerSettings.onclick = () => {
    params.onOpenSettings();
    closeGlobalDrawer();
  };
  drawerSettingsSection.append(drawerSettings);

  drawerPanel.append(drawerCore, drawerAudioSection, drawerTempo, drawerAccess, drawerStatus, drawerSettingsSection);
  drawer.append(drawerBackdrop, drawerPanel);
  document.body.appendChild(drawer);

  const supportsDrawerMedia = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const drawerMql = supportsDrawerMedia
    ? window.matchMedia("(max-width: 760px), ((orientation: portrait) and (max-width: 1024px))")
    : null;

  let drawerOpen = false;
  let drawerPointerId: number | null = null;
  let drawerStartX = 0;
  let drawerSwipeMode: "open" | "close" | null = null;

  let chipPanel: HTMLElement | null = null;
  let chipPanelCleanup: ReturnType<typeof bindFloatingPanelReposition> | null = null;
  let chipPanelAnchor: HTMLElement | null = null;

  const closeChipEditor = () => {
    if (!chipPanel) return;
    chipPanelCleanup?.destroy();
    chipPanelCleanup = null;
    chipPanel.remove();
    chipPanel = null;
    chipPanelAnchor = null;
  };

  const setDrawerInteractionOwner = (active: boolean) => {
    if (active) document.body.dataset.interactionOwner = "edge-nav";
    else if (document.body.dataset.interactionOwner === "edge-nav") delete document.body.dataset.interactionOwner;
  };

  function closeGlobalDrawer() {
    drawerOpen = false;
    drawer.classList.remove("isOpen");
    setDrawerInteractionOwner(false);
    closeChipEditor();
  }

  function openGlobalDrawer() {
    drawerOpen = true;
    drawer.classList.add("isOpen");
    setDrawerInteractionOwner(true);
  }

  compactLauncher.onclick = () => {
    if (drawerOpen) closeGlobalDrawer();
    else openGlobalDrawer();
  };

  const setChipText = () => {
    const patch = params.patch();
    bpmChip.textContent = `BPM ${Math.round(patch.bpm)}`;
    gainChip.textContent = `VOL ${Math.round(patch.masterGain * 100)}`;
  };

  const buildChipEditor = (title: string, value: number, min: number, max: number, step: number, onApply: (next: number) => void) => {
    closeChipEditor();
    const panel = document.createElement("div");
    panel.className = "floatingPanel globalControlsChipEditor";

    const heading = document.createElement("div");
    heading.className = "small transportUtilitySectionLabel";
    heading.textContent = title;

    const row = document.createElement("div");
    row.className = "globalControlsChipEditorRow";
    const dec = document.createElement("button");
    dec.type = "button";
    dec.className = "globalControlsChipEditorStep";
    dec.textContent = "−";
    const num = document.createElement("input");
    num.type = "number";
    num.className = "globalControlsChipEditorInput";
    num.min = String(min);
    num.max = String(max);
    num.step = String(step);
    num.value = String(value);
    const inc = document.createElement("button");
    inc.type = "button";
    inc.className = "globalControlsChipEditorStep";
    inc.textContent = "+";

    const apply = (next: number) => {
      const safe = Math.min(max, Math.max(min, next));
      onApply(safe);
      num.value = String(safe);
      setChipText();
    };

    dec.onclick = () => apply((Number(num.value) || value) - step);
    inc.onclick = () => apply((Number(num.value) || value) + step);
    num.onchange = () => apply(Number(num.value) || value);

    row.append(dec, num, inc);
    panel.append(heading, row);
    document.body.appendChild(panel);
    chipPanel = panel;
    const anchor = chipPanelAnchor;
    if (!anchor) return;

    placeFloatingPanel(panel, anchor.getBoundingClientRect(), {
      offset: 8,
      align: "start",
      preferredSide: "bottom",
      minWidth: 200,
      maxWidth: 260,
    });
    chipPanelCleanup = bindFloatingPanelReposition(panel, () => (anchor.isConnected ? anchor.getBoundingClientRect() : null), {
      offset: 8,
      align: "start",
      preferredSide: "bottom",
      minWidth: 200,
      maxWidth: 260,
    });
    queueMicrotask(() => num.focus());
  };

  bpmChip.onclick = () => {
    chipPanelAnchor = bpmChip;
    buildChipEditor("Tempo", Math.round(params.patch().bpm), 40, 240, 1, (next) => params.onSetBpm(next));
  };

  gainChip.onclick = () => {
    chipPanelAnchor = gainChip;
    buildChipEditor("Master level", Math.round(params.patch().masterGain * 100), 0, 100, 1, (next) => params.onSetMasterGain(next / 100));
  };

  drawerBackdrop.onclick = () => closeGlobalDrawer();

  const onDrawerPointerDown = (event: PointerEvent) => {
    if (!drawerMql?.matches) return;
    const startAtEdge = !drawerOpen && event.clientX <= 22;
    const startOnDrawer = drawerOpen && drawerPanel.contains(event.target as Node);
    if (!startAtEdge && !startOnDrawer) return;

    drawerPointerId = event.pointerId;
    drawerStartX = event.clientX;
    drawerSwipeMode = startAtEdge ? "open" : "close";
    setDrawerInteractionOwner(true);
  };

  const onDrawerPointerMove = (event: PointerEvent) => {
    if (drawerPointerId !== event.pointerId || !drawerSwipeMode) return;
    const dx = event.clientX - drawerStartX;
    if (drawerSwipeMode === "open" && dx > 42) {
      openGlobalDrawer();
      drawerSwipeMode = null;
      drawerPointerId = null;
    }
    if (drawerSwipeMode === "close" && dx < -42) {
      closeGlobalDrawer();
      drawerSwipeMode = null;
      drawerPointerId = null;
    }
  };

  const onDrawerPointerEnd = (event: PointerEvent) => {
    if (drawerPointerId !== event.pointerId) return;
    drawerPointerId = null;
    drawerSwipeMode = null;
    if (!drawerOpen) setDrawerInteractionOwner(false);
  };

  const handleDrawerMedia = () => {
    if (!drawerMql?.matches) closeGlobalDrawer();
  };

  drawerMql?.addEventListener("change", handleDrawerMedia);
  document.addEventListener("pointerdown", onDrawerPointerDown, true);
  document.addEventListener("pointermove", onDrawerPointerMove, true);
  document.addEventListener("pointerup", onDrawerPointerEnd, true);
  document.addEventListener("pointercancel", onDrawerPointerEnd, true);

  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node | null;
    if (!target) return;
    if (chipPanel && chipPanelAnchor && !chipPanel.contains(target) && !chipPanelAnchor.contains(target)) closeChipEditor();
  }, true);
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
    updateRoutingOverview: routingOverview.refresh,
    updateMidiUI,
  };
}
