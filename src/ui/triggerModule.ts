import type { Mode, Patch, TriggerModule } from "../patch";
import { getPatternPreview } from "../engine/pattern/module";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

type TriggerFaceTab = "MAIN" | "SETTINGS";

type ControlOption = { id: string; label: string };

export function renderTriggerSurface(
  root: HTMLElement,
  t: TriggerModule,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
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

  const face = document.createElement("div");
  face.className = "surfaceFace";

  const panelMain = document.createElement("div");
  panelMain.className = "surfaceTabPanel triggerPrimary";

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

  const panelSettings = document.createElement("div");
  panelSettings.className = "surfaceTabPanel hidden";
  const modulationRow = document.createElement("div");
  modulationRow.className = "utilityRouteCard";
  const modLabel = document.createElement("div");
  modLabel.className = "small utilityRouteTitle";
  modLabel.textContent = "Density Mod";
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
  modSel.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type !== "trigger") return;
    m.modulations = m.modulations ?? {};
    if (modSel.value) m.modulations.density = modSel.value;
    else delete m.modulations.density;
  }, { regen: false });
  modulationRow.append(modLabel, modSel);

  panelSettings.append(
    ctlFloat({ label: "Rotation", value: t.euclidRot, min: -32, max: 32, step: 1, integer: true, onChange: (x) => setParam("euclidRot", x) }),
    ctlFloat({ label: "CA Rule", value: t.caRule, min: 0, max: 255, step: 1, integer: true, onChange: (x) => setParam("caRule", x) }),
    ctlFloat({ label: "CA Init", value: t.caInit, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("caInit", x) }),
    ctlFloat({ label: "Gravity", value: t.gravity, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("gravity", x) }),
    modulationRow,
  );

  face.append(panelMain, panelSettings);

  const tabs = document.createElement("div");
  tabs.className = "surfaceTabs";
  const tabSpecs: Array<{ id: TriggerFaceTab; label: string; panel: HTMLElement }> = [
    { id: "MAIN", label: "Main", panel: panelMain },
    { id: "SETTINGS", label: "Settings", panel: panelSettings },
  ];

  const buttons = new Map<TriggerFaceTab, HTMLButtonElement>();
  const setTab = (tab: TriggerFaceTab) => {
    for (const spec of tabSpecs) {
      const isActive = spec.id === tab;
      spec.panel.classList.toggle("hidden", !isActive);
      buttons.get(spec.id)?.classList.toggle("active", isActive);
    }
  };

  for (const spec of tabSpecs) {
    const btn = document.createElement("button");
    btn.className = "modTab";
    btn.textContent = spec.label;
    btn.onclick = () => setTab(spec.id);
    tabs.appendChild(btn);
    buttons.set(spec.id, btn);
  }

  surface.append(header, face, tabs);
  root.appendChild(surface);

  setTab("MAIN");
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
