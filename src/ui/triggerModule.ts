import type { Mode, Patch, TriggerModule } from "../patch";
import { getPatternPreview } from "../engine/pattern/module";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createModuleIdentityMeta, createModuleTabShell } from "./moduleShell";
import { createModulePresetControl } from "./modulePresetControl";
import type { ModulePresetRecord } from "./persistence/modulePresetStore";
import {
  createCompactSelectField,
  createModuleRefChip,
  createRoutingCard,
  createRoutingChip,
  createRoutingSummary,
  createRoutingSummaryStrip,
  type RoutingSnapshot,
} from "./routingVisibility";
import type { TooltipBinder } from "./tooltip";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

type ControlOption = { id: string; label: string };

export function renderTriggerSurface(
  root: HTMLElement,
  t: TriggerModule,
  routing: RoutingSnapshot,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  onRoutingChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  controlOptions: ControlOption[],
  attachTooltip?: TooltipBinder,
  modulePresetRecords: ModulePresetRecord[] = [],
  onLoadModulePreset?: (moduleId: string, presetId: string) => void,
  onSaveModulePreset?: (moduleId: string, name: string, overwritePresetId?: string | null) => void,
  onRemove?: () => void,
) {
  const surface = document.createElement("section");
  surface.className = "moduleSurface triggerSurface";
  surface.dataset.type = "trigger";

  const header = document.createElement("div");
  header.className = "surfaceHeader";

  const presetControl = createModulePresetControl({
    module: t,
    records: modulePresetRecords,
    onLoadPreset: (presetId) => onLoadModulePreset?.(t.id, presetId),
    onSavePreset: (name, overwritePresetId) => onSaveModulePreset?.(t.id, name, overwritePresetId),
    attachTooltip,
  });

  const identity = createModuleIdentityMeta({
    badgeText: "TRIGGER",
    instanceName: t.name,
    instanceId: t.id.slice(-6).toUpperCase(),
    presetButton: presetControl.button,
  });

  const right = document.createElement("div");
  right.className = "rightControls";
  const toggle = document.createElement("button");
  const syncToggle = () => {
    toggle.textContent = t.enabled ? "On" : "Off";
    toggle.className = t.enabled ? "primary" : "";
  };
  syncToggle();
  toggle.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type === "trigger") m.enabled = !m.enabled;
  }, { regen: false });
  attachTooltip?.(toggle, {
    text: "Enable or bypass this trigger module.",
    ariaLabel: `${t.name} power`,
  });

  const btnX = document.createElement("button");
  btnX.textContent = "×";
  btnX.className = "danger";
  wireSafeDeleteButton(btnX, () => onRemove?.());
  attachTooltip?.(btnX, {
    text: "Remove this trigger module from the grid.",
    ariaLabel: `Remove ${t.name}`,
  });
  right.append(toggle, btnX);
  header.append(identity, right);

  const outgoingVoices = routing.triggerTargets.get(t.id) ?? [];
  const incomingMods = routing.triggerIncoming.get(t.id) ?? [];

  const panelMain = document.createElement("div");
  panelMain.className = "triggerPrimary";
  panelMain.appendChild(createRoutingSummaryStrip([
    createRoutingSummary("Out", outgoingVoices.map((voice) => createModuleRefChip(voice)), "No voices"),
    createRoutingSummary("Mod", incomingMods.map((modulation) => createModuleRefChip(modulation.source, modulation.parameterLabel)), "No mod"),
  ]));

  const pulseRail = document.createElement("div");
  pulseRail.className = "triggerPulseRail";

  const generatorReadout = document.createElement("button");
  generatorReadout.className = "triggerGeneratorReadout";
  generatorReadout.type = "button";
  const generatorLabel = document.createElement("div");
  generatorLabel.className = "triggerReadoutLabel";
  generatorLabel.textContent = "gen";
  const generatorValue = document.createElement("div");
  generatorValue.className = "triggerReadoutValue";
  generatorReadout.append(generatorLabel, generatorValue);
  attachTooltip?.(generatorReadout, {
    text: "Cycle the trigger generator mode.",
    ariaLabel: `${t.name} generator mode`,
  });
  generatorReadout.onclick = () => {
    const idx = MODES.findIndex((mode) => mode === t.mode);
    const nextMode = MODES[(idx + 1) % MODES.length];
    onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type === "trigger") m.mode = nextMode;
    }, { regen: true });
  };

  const seedReadout = document.createElement("button");
  seedReadout.className = "triggerSeedReadout";
  seedReadout.type = "button";
  const seedLabel = document.createElement("div");
  seedLabel.className = "triggerReadoutLabel";
  seedLabel.textContent = "seed";
  const seedValue = document.createElement("div");
  seedValue.className = "triggerReadoutValue";
  const seedHint = document.createElement("div");
  seedHint.className = "triggerReadoutHint";
  seedHint.textContent = "tap = new";
  seedReadout.append(seedLabel, seedValue, seedHint);
  attachTooltip?.(seedReadout, {
    text: "Generate a fresh seed for this pattern.",
    ariaLabel: `${t.name} pattern seed`,
  });
  seedReadout.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type === "trigger") m.seed = (Math.random() * 999_999) | 0;
  }, { regen: true });

  const stepGrid = document.createElement("div");
  stepGrid.className = "triggerStepGrid";
  const transportReadout = document.createElement("div");
  transportReadout.className = "triggerTransportReadout small";

  pulseRail.append(generatorReadout, seedReadout, stepGrid, transportReadout);

  const mainControlRack = document.createElement("div");
  mainControlRack.className = "triggerPulseRack";
  mainControlRack.append(
    ctlFloat({
      label: "Dense",
      value: t.density,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Adjust how often this trigger lane produces steps.",
      attachTooltip,
      onChange: (x) => setParam("density", x),
    }),
    ctlFloat({
      label: "Len",
      value: t.length,
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set the loop length in sequencer steps.",
      attachTooltip,
      onChange: (x) => setParam("length", x),
    }),
    ctlFloat({
      label: "Drop",
      value: t.drop,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Thin the pattern by dropping hits after generation.",
      attachTooltip,
      onChange: (x) => setParam("drop", x),
    }),
    ctlFloat({
      label: "Div",
      value: t.subdiv,
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Change the timing division for this trigger lane.",
      attachTooltip,
      onChange: (x) => setParam("subdiv", x),
    }),
    ctlFloat({
      label: "Det",
      value: t.determinism,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Bias the generator toward repeatable results.",
      attachTooltip,
      onChange: (x) => setParam("determinism", x),
    }),
    ctlFloat({
      label: "Weird",
      value: t.weird,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Add more surprising variations to the pattern.",
      attachTooltip,
      onChange: (x) => setParam("weird", x),
    }),
  );
  panelMain.append(pulseRail, mainControlRack);

  const panelRouting = document.createElement("div");
  panelRouting.className = "utilityPanel utilityPanel--triggerRouting";

  const targetsCard = createRoutingCard("Voice out", outgoingVoices.length ? `${outgoingVoices.length} sink${outgoingVoices.length === 1 ? "" : "s"}` : "No sinks");
  const targetsList = document.createElement("div");
  targetsList.className = "routingChipList";
  if (outgoingVoices.length) outgoingVoices.forEach((voice) => targetsList.appendChild(createModuleRefChip(voice)));
  else targetsList.appendChild(createRoutingChip("Unassigned", "muted"));
  targetsCard.appendChild(targetsList);
  panelRouting.appendChild(targetsCard);

  const modulationCard = createRoutingCard("Density mod", incomingMods.length ? `${incomingMods.length} source${incomingMods.length === 1 ? "" : "s"}` : "No source");
  const modField = createCompactSelectField({
    label: "Source",
    options: controlOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    selected: t.modulations?.density,
    emptyLabel: "None",
    tooltip: "Choose a control source that modulates density.",
    attachTooltip,
    onChange: (value) => onRoutingChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type !== "trigger") return;
      m.modulations = m.modulations ?? {};
      if (value) m.modulations.density = value;
      else delete m.modulations.density;
    }, { regen: false }),
  });
  const modList = document.createElement("div");
  modList.className = "routingChipList";
  if (incomingMods.length) incomingMods.forEach((modulation) => modList.appendChild(createModuleRefChip(modulation.source, modulation.parameterLabel)));
  else modList.appendChild(createRoutingChip("No mod", "muted"));
  modulationCard.append(modField.wrap, modList);
  panelRouting.appendChild(modulationCard);

  const panelSettings = document.createElement("div");
  panelSettings.className = "surfaceSettingsPanel triggerSettingsPanel";
  const settingsGrid = document.createElement("div");
  settingsGrid.className = "moduleKnobGrid moduleKnobGrid-2";
  settingsGrid.append(
    ctlFloat({
      label: "Rotate",
      value: t.euclidRot,
      min: -32,
      max: 32,
      step: 1,
      integer: true,
      tooltip: "Rotate Euclidean hits around the loop.",
      attachTooltip,
      onChange: (x) => setParam("euclidRot", x),
    }),
    ctlFloat({
      label: "CA rule",
      value: t.caRule,
      min: 0,
      max: 255,
      step: 1,
      integer: true,
      tooltip: "Select the cellular automata rule number.",
      attachTooltip,
      onChange: (x) => setParam("caRule", x),
    }),
    ctlFloat({
      label: "CA init",
      value: t.caInit,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set the initial fill used by CA-based patterns.",
      attachTooltip,
      onChange: (x) => setParam("caInit", x),
    }),
    ctlFloat({
      label: "Grav",
      value: t.gravity,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Pull generated hits toward denser clusters.",
      attachTooltip,
      onChange: (x) => setParam("gravity", x),
    }),
  );
  panelSettings.append(settingsGrid);

  const shell = createModuleTabShell({
    specs: [
      { id: "MAIN", label: "Main", panel: panelMain },
      { id: "ROUTING", label: "Routing", panel: panelRouting },
      { id: "SETTINGS", label: "Settings", panel: panelSettings },
    ],
    activeTab: "MAIN",
  });

  surface.append(header, shell.face, shell.tabs);
  root.appendChild(surface);
  syncPatternRail();

  function patternPreviewText() {
    return getPatternPreview(t, `${t.id}:preview`, 64);
  }

  function syncPatternRail() {
    generatorValue.textContent = t.mode.toUpperCase();
    seedValue.textContent = String(t.seed).padStart(6, "0");

    const compact = patternPreviewText().replace(/\s+/g, "").slice(0, 32);
    stepGrid.textContent = "";
    for (let i = 0; i < 32; i++) {
      const cell = document.createElement("span");
      const c = compact[i] ?? ".";
      cell.className = `triggerStepCell ${c !== "." ? "on" : "off"}`;
      stepGrid.appendChild(cell);
    }
    transportReadout.textContent = `${t.length} st · /${t.subdiv} · ${Math.round(t.density * 100)}%`;
  }

  function setParam(key: keyof TriggerModule, value: number) {
    onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type === "trigger") (m as TriggerModule)[key] = value as never;
    }, { regen: true });
  }

  return () => {
    syncToggle();
    syncPatternRail();
  };
}

export const renderTriggerModule = renderTriggerSurface;
