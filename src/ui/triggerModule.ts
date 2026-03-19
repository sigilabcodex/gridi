import type { Mode, Patch, TriggerModule } from "../patch";
import { getPatternPreview } from "../engine/pattern/module";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createModuleTabShell } from "./moduleShell";
import {
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
    createRoutingSummary("Feeds", outgoingVoices.map((voice) => createModuleRefChip(voice)), "No voices"),
    createRoutingSummary("Density mod", incomingMods.map((modulation) => createModuleRefChip(modulation.source, modulation.parameterLabel)), "No modulation"),
  ]));

  const pulseRail = document.createElement("div");
  pulseRail.className = "triggerPulseRail";

  const generatorReadout = document.createElement("button");
  generatorReadout.className = "triggerGeneratorReadout";
  generatorReadout.type = "button";
  const generatorLabel = document.createElement("div");
  generatorLabel.className = "triggerReadoutLabel";
  generatorLabel.textContent = "generator";
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
  seedHint.textContent = "tap to reseed";
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
    ctlFloat({ label: "Density", value: t.density, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("density", x) }),
    ctlFloat({ label: "Length", value: t.length, min: 1, max: 128, step: 1, integer: true, onChange: (x) => setParam("length", x) }),
    ctlFloat({ label: "Drop", value: t.drop, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("drop", x) }),
    ctlFloat({ label: "Subdiv", value: t.subdiv, min: 1, max: 8, step: 1, integer: true, onChange: (x) => setParam("subdiv", x) }),
    ctlFloat({ label: "Determinism", value: t.determinism, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("determinism", x) }),
    ctlFloat({ label: "Weird", value: t.weird, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("weird", x) }),
  );
  panelMain.append(pulseRail, mainControlRack);

  const panelRouting = document.createElement("div");
  panelRouting.className = "utilityPanel";

  const targetsCard = createRoutingCard("Feeds voices", outgoingVoices.length ? `${outgoingVoices.length} connected` : "No voices currently listening");
  const targetsList = document.createElement("div");
  targetsList.className = "routingChipList";
  if (outgoingVoices.length) outgoingVoices.forEach((voice) => targetsList.appendChild(createModuleRefChip(voice)));
  else targetsList.appendChild(createRoutingChip("Unassigned", "muted"));
  targetsCard.appendChild(targetsList);
  panelRouting.appendChild(targetsCard);

  const modulationCard = createRoutingCard("Density modulation", incomingMods.length ? "Control assigned" : "No density modulation");
  const modLabel = document.createElement("div");
  modLabel.className = "small utilityRouteTitle";
  modLabel.textContent = "Density mod source";
  const modSel = document.createElement("select");
  const modNone = document.createElement("option");
  modNone.value = "";
  modNone.textContent = "None";
  if (!t.modulations?.density) modNone.selected = true;
  modSel.appendChild(modNone);
  for (const opt of controlOptions) {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === t.modulations?.density) o.selected = true;
    modSel.appendChild(o);
  }
  modSel.onchange = () => onRoutingChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type !== "trigger") return;
    m.modulations = m.modulations ?? {};
    if (modSel.value) m.modulations.density = modSel.value;
    else delete m.modulations.density;
  }, { regen: false });
  const modList = document.createElement("div");
  modList.className = "routingChipList";
  if (incomingMods.length) incomingMods.forEach((modulation) => modList.appendChild(createModuleRefChip(modulation.source, modulation.parameterLabel)));
  else modList.appendChild(createRoutingChip("None", "muted"));
  modulationCard.append(modLabel, modSel, modList);
  panelRouting.appendChild(modulationCard);

  const panelSettings = document.createElement("div");
  panelSettings.append(
    ctlFloat({ label: "Rotation", value: t.euclidRot, min: -32, max: 32, step: 1, integer: true, onChange: (x) => setParam("euclidRot", x) }),
    ctlFloat({ label: "CA Rule", value: t.caRule, min: 0, max: 255, step: 1, integer: true, onChange: (x) => setParam("caRule", x) }),
    ctlFloat({ label: "CA Init", value: t.caInit, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("caInit", x) }),
    ctlFloat({ label: "Gravity", value: t.gravity, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("gravity", x) }),
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
    transportReadout.textContent = `${t.length} steps · /${t.subdiv} · ${Math.round(t.density * 100)}%`;
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
