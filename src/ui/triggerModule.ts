import type { Mode, Patch, TriggerModule } from "../patch";
import { getPatternPreview } from "../engine/pattern/module";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createFaceplateMainPanel, createFaceplateSection, createFaceplateSpacer, createFaceplateStackPanel } from "./faceplateSections";
import { createModuleTabShell } from "./moduleShell";
import { createModulePresetControl } from "./modulePresetControl";
import type { ModulePresetRecord } from "./persistence/modulePresetStore";
import {
  createCompactSelectField,
  createModuleRefChip,
  createRoutingCard,
  createRoutingChip,
  type RoutingSnapshot,
} from "./routingVisibility";
import { createTriggerDisplaySurface } from "./triggerDisplaySurface";
import type { TooltipBinder } from "./tooltip";

const GENERATOR_MODES: Array<{ value: Mode; label: string }> = [
  { value: "step-sequencer", label: "Step Sequencer" },
  { value: "cellular-automata", label: "Cellular Automata" },
  { value: "euclidean", label: "Euclidean" },
  { value: "non-euclidean", label: "Non-Euclidean" },
  { value: "fractal", label: "Fractal" },
  { value: "hybrid", label: "Hybrid" },
  { value: "markov-chains", label: "Markov Chains" },
  { value: "l-systems", label: "L-Systems" },
  { value: "xronomorph", label: "XronoMorph" },
  { value: "genetic-algorithms", label: "Genetic Algorithms" },
  { value: "one-over-f-noise", label: "1/f Noise" },
];

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
  surface.className = "moduleSurface triggerSurface triggerSurface--withStatus";
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

  const identity = document.createElement("div");
  identity.className = "surfaceIdentity surfaceIdentity--canonical drumIdentity";

  const badge = document.createElement("div");
  badge.className = "surfaceBadge surfaceBadge--triggerFamily";
  badge.textContent = "GEN";
  identity.append(badge, presetControl.button);

  const right = document.createElement("div");
  right.className = "rightControls";

  const toggle = document.createElement("button");
  toggle.className = "surfaceHeaderAction";
  const syncToggle = () => {
    toggle.textContent = t.enabled ? "On" : "Off";
    toggle.classList.toggle("primary", t.enabled);
  };
  syncToggle();
  toggle.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type === "trigger") m.enabled = !m.enabled;
  }, { regen: false });
  attachTooltip?.(toggle, {
    text: "Enable or bypass this generator module.",
    ariaLabel: `${t.name} power`,
  });

  const btnX = document.createElement("button");
  btnX.textContent = "×";
  btnX.className = "danger surfaceHeaderAction";
  wireSafeDeleteButton(btnX, () => onRemove?.());
  attachTooltip?.(btnX, {
    text: "Remove this generator module from the grid.",
    ariaLabel: `Remove ${t.name}`,
  });
  right.append(toggle, btnX);
  header.append(identity, right);

  const panelMain = createFaceplateMainPanel();
  panelMain.classList.add("triggerPrimary");

  let selectTab: (tab: "MAIN" | "ROUTING" | "SETTINGS") => void = () => {};

  const metaRow = createFaceplateSection("io", "triggerMetaRow");

  const generatorChip = document.createElement("div");
  generatorChip.className = "triggerMetaChip triggerMetaChip--gen";

  const generatorLabel = document.createElement("span");
  generatorLabel.className = "triggerMetaChipLabel";
  generatorLabel.textContent = "GEN MODE";

  const generatorSelect = document.createElement("select");
  generatorSelect.className = "triggerModeSelect";
  generatorSelect.setAttribute("aria-label", `${t.name} generator mode`);
  GENERATOR_MODES.forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode.value;
    option.textContent = mode.label;
    generatorSelect.appendChild(option);
  });
  generatorSelect.onchange = () => {
    const nextMode = generatorSelect.value as Mode;
    onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type === "trigger") m.mode = nextMode;
    }, { regen: true });
  };
  attachTooltip?.(generatorSelect, {
    text: "Select the active generator mode for this module.",
    ariaLabel: `${t.name} generator mode`,
  });

  generatorChip.append(generatorLabel, generatorSelect);

  const seedGroup = document.createElement("div");
  seedGroup.className = "triggerSeedGroup";

  const seedInput = document.createElement("input");
  seedInput.className = "triggerSeedInput";
  seedInput.type = "number";
  seedInput.min = "0";
  seedInput.max = "999999";
  seedInput.step = "1";
  seedInput.inputMode = "numeric";
  seedInput.setAttribute("aria-label", `${t.name} seed value`);
  seedInput.addEventListener("change", () => {
    const nextSeed = Number(seedInput.value);
    if (!Number.isFinite(nextSeed)) return;
    onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type === "trigger") m.seed = Math.max(0, Math.min(999_999, Math.round(nextSeed)));
    }, { regen: true });
  });
  seedInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") seedInput.blur();
  });
  attachTooltip?.(seedInput, {
    text: "Edit the deterministic seed value for this generator.",
    ariaLabel: `${t.name} seed value`,
  });

  const randomizeSeed = document.createElement("button");
  randomizeSeed.type = "button";
  randomizeSeed.className = "triggerSeedRandomize";
  randomizeSeed.textContent = "↻";
  attachTooltip?.(randomizeSeed, {
    text: "Generate a fresh seed value.",
    ariaLabel: `${t.name} randomize seed`,
  });
  randomizeSeed.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type === "trigger") m.seed = (Math.random() * 999_999) | 0;
  }, { regen: true });

  const seedLabel = document.createElement("span");
  seedLabel.className = "triggerSeedLabel";
  seedLabel.textContent = "SEED";

  seedGroup.append(seedLabel, seedInput, randomizeSeed);

  const routingChip = document.createElement("button");
  routingChip.className = "triggerMetaChip triggerMetaChip--routing";
  routingChip.type = "button";
  routingChip.onclick = () => selectTab("ROUTING");
  attachTooltip?.(routingChip, {
    text: "Open generator routing controls.",
    ariaLabel: `${t.name} routing`,
  });

  metaRow.append(generatorChip, seedGroup, routingChip);

  const display = createTriggerDisplaySurface({
    module: t,
    getStepPattern: () => patternPreviewText(),
  });

  const mainControlRack = createFaceplateSection("controls", "triggerPulseRack triggerPrimaryControls");
  mainControlRack.append(
    ctlFloat({
      label: "Dense",
      value: t.density,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Adjust how often this generator lane produces steps.",
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
      label: "Div",
      value: t.subdiv,
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Change the timing division for this generator lane.",
      attachTooltip,
      onChange: (x) => setParam("subdiv", x),
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

  const idToken = document.createElement("span");
  idToken.className = "drumInfoToken";
  idToken.textContent = t.id.slice(-6).toUpperCase();

  const stateToken = document.createElement("span");
  stateToken.className = "drumInfoToken";

  const modeToken = document.createElement("span");
  modeToken.className = "drumInfoToken";

  const transportReadout = document.createElement("span");
  transportReadout.className = "drumInfoToken drumInfoToken--meta triggerTransportReadout";

  const infoBar = document.createElement("div");
  infoBar.className = "drumInfoBar triggerInfoBar";
  infoBar.append(idToken, stateToken, modeToken, transportReadout);

  panelMain.append(metaRow, display.wrap, mainControlRack, createFaceplateSpacer());

  const outgoingVoices = routing.triggerTargets.get(t.id) ?? [];
  const incomingMods = routing.triggerIncoming.get(t.id) ?? [];

  const panelRouting = createFaceplateStackPanel("utilityPanel utilityPanel--triggerRouting");

  const targetsCard = createRoutingCard("Voice out", outgoingVoices.length ? `${outgoingVoices.length} sink${outgoingVoices.length === 1 ? "" : "s"}` : "No sinks");
  const targetsList = document.createElement("div");
  targetsList.className = "routingChipList";
  if (outgoingVoices.length) {
    const visibleTargets = outgoingVoices.slice(0, 6);
    visibleTargets.forEach((voice) => targetsList.appendChild(createModuleRefChip(voice)));
    if (outgoingVoices.length > visibleTargets.length) {
      targetsList.appendChild(createRoutingChip(`+${outgoingVoices.length - visibleTargets.length} more`, "muted"));
    }
  } else targetsList.appendChild(createRoutingChip("Unassigned", "muted"));
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
  if (incomingMods.length) {
    const visibleMods = incomingMods.slice(0, 6);
    visibleMods.forEach((modulation) => modList.appendChild(createModuleRefChip(modulation.source, modulation.parameterLabel)));
    if (incomingMods.length > visibleMods.length) {
      modList.appendChild(createRoutingChip(`+${incomingMods.length - visibleMods.length} more`, "muted"));
    }
  } else modList.appendChild(createRoutingChip("No mod", "muted"));
  modulationCard.append(modField.wrap, modList);
  panelRouting.appendChild(modulationCard);

  const panelSettings = createFaceplateStackPanel("surfaceSettingsPanel triggerSettingsPanel");
  const settingsGrid = createFaceplateSection("controls", "moduleKnobGrid moduleKnobGrid-2");
  settingsGrid.append(
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
      label: "Grav",
      value: t.gravity,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Pull generated hits toward denser clusters.",
      attachTooltip,
      onChange: (x) => setParam("gravity", x),
    }),
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
  );
  panelSettings.append(settingsGrid);

  const shell = createModuleTabShell({
    specs: [
      { id: "MAIN", label: "Main", panel: panelMain },
      { id: "ROUTING", label: "Routing", panel: panelRouting },
      { id: "SETTINGS", label: "Advanced", panel: panelSettings },
    ],
    activeTab: "MAIN",
  });
  selectTab = shell.setTab;

  surface.append(header, shell.face, shell.tabs, infoBar);
  root.appendChild(surface);
  syncTriggerFace();

  function patternPreviewText() {
    return getPatternPreview(t, `${t.id}:preview`, 64);
  }

  function syncTriggerFace() {
    generatorSelect.value = t.mode;
    seedInput.value = String(t.seed).padStart(6, "0");
    routingChip.textContent = outgoingVoices.length ? `ROUTING ${outgoingVoices.length}` : "ROUTING";
    stateToken.textContent = t.enabled ? "ACTIVE" : "BYPASS";
    modeToken.textContent = `MODE ${GENERATOR_MODES.find((mode) => mode.value === t.mode)?.label ?? "GEN"}`;
    display.sync(t);
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
    syncTriggerFace();
  };
}

export const renderTriggerModule = renderTriggerSurface;
