import type { Mode, Patch, TriggerModule } from "../patch";
import { getPatternPreview } from "../engine/pattern/module";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createModuleTabShell } from "./moduleShell";
import {
  createCompactSelectField,
  createModuleRefChip,
  createRoutingCard,
  createRoutingChip,
  createRoutingSummary,
  createRoutingSummaryStrip,
  type RoutingSnapshot,
} from "./routingVisibility";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

type ControlOption = { id: string; label: string };

export function renderTriggerSurface(
  root: HTMLElement,
  t: TriggerModule,
  routing: RoutingSnapshot,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  onRoutingChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  controlOptions: ControlOption[],
  onRemove?: () => void,
) {
  const surface = document.createElement("section");
  surface.className = "moduleSurface triggerSurface";
  surface.dataset.type = "trigger";

  const header = document.createElement("div");
  header.className = "surfaceHeader";

  const identity = document.createElement("div");
  identity.className = "surfaceIdentity";
  const badge = document.createElement("div");
  badge.className = "surfaceBadge";
  badge.textContent = "TRIGGER";
  const meta = document.createElement("div");
  meta.className = "surfaceNameWrap";
  meta.innerHTML = `<div class="name">${t.name}</div><div class="small">Preset: ${t.presetName ?? "Sparse Euclid"}</div><div class="small moduleId">${t.id.slice(-6).toUpperCase()}</div>`;
  identity.append(badge, meta);

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

  const btnX = document.createElement("button");
  btnX.textContent = "×";
  btnX.className = "danger";
  wireSafeDeleteButton(btnX, () => onRemove?.());
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
    ctlFloat({ label: "Dense", value: t.density, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("density", x) }),
    ctlFloat({ label: "Len", value: t.length, min: 1, max: 128, step: 1, integer: true, onChange: (x) => setParam("length", x) }),
    ctlFloat({ label: "Drop", value: t.drop, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("drop", x) }),
    ctlFloat({ label: "Div", value: t.subdiv, min: 1, max: 8, step: 1, integer: true, onChange: (x) => setParam("subdiv", x) }),
    ctlFloat({ label: "Det", value: t.determinism, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("determinism", x) }),
    ctlFloat({ label: "Weird", value: t.weird, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("weird", x) }),
  );
  panelMain.append(pulseRail, mainControlRack);

  const panelRouting = document.createElement("div");
  panelRouting.className = "utilityPanel";

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
  panelSettings.append(
    ctlFloat({ label: "Rotate", value: t.euclidRot, min: -32, max: 32, step: 1, integer: true, onChange: (x) => setParam("euclidRot", x) }),
    ctlFloat({ label: "CA rule", value: t.caRule, min: 0, max: 255, step: 1, integer: true, onChange: (x) => setParam("caRule", x) }),
    ctlFloat({ label: "CA init", value: t.caInit, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("caInit", x) }),
    ctlFloat({ label: "Grav", value: t.gravity, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("gravity", x) }),
  );

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
