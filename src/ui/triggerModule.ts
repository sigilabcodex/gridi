import type { Mode, Patch, TriggerModule } from "../patch";
import { getPatternPreview } from "../engine/pattern/module";
import { ctlFloat } from "./ctl";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

type TriggerFaceTab = "MAIN" | "ROUTING" | "DEBUG" | "SETTINGS";

export function renderTriggerSurface(
  root: HTMLElement,
  t: TriggerModule,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
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
  meta.innerHTML = `<div class="name">${t.name}</div><div class="small moduleId">${t.id.slice(-6).toUpperCase()}</div>`;
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
  btnX.onclick = () => onRemove?.();
  right.append(toggle, btnX);
  header.append(identity, right);

  const face = document.createElement("div");
  face.className = "surfaceFace";

  const panelMain = document.createElement("div");
  panelMain.className = "surfaceTabPanel triggerPrimary";

  const pulseRail = document.createElement("div");
  pulseRail.className = "triggerPulseRail";
  const stepGrid = document.createElement("div");
  stepGrid.className = "triggerStepGrid";
  const transportReadout = document.createElement("div");
  transportReadout.className = "triggerTransportReadout small";
  pulseRail.append(stepGrid, transportReadout);

  const modeRack = document.createElement("div");
  modeRack.className = "triggerModeRack";
  const sel = document.createElement("select");
  for (const m of MODES) {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = m;
    if (m === t.mode) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type === "trigger") m.mode = sel.value as Mode;
  }, { regen: true });

  const seed = document.createElement("input");
  seed.type = "number";
  seed.value = String(t.seed);
  seed.className = "seedInput";
  seed.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type === "trigger") m.seed = seed.valueAsNumber | 0;
  }, { regen: true });
  modeRack.append(sel, seed);

  const mainControlRack = document.createElement("div");
  mainControlRack.className = "triggerPulseRack";
  mainControlRack.append(
    ctlFloat({ label: "Density", value: t.density, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("density", x) }),
    ctlFloat({ label: "Drop", value: t.drop, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("drop", x) }),
    ctlFloat({ label: "Length", value: t.length, min: 1, max: 128, step: 1, integer: true, onChange: (x) => setParam("length", x) }),
    ctlFloat({ label: "Subdiv", value: t.subdiv, min: 1, max: 8, step: 1, integer: true, onChange: (x) => setParam("subdiv", x) }),
  );
  panelMain.append(pulseRail, modeRack, mainControlRack);

  const panelRouting = document.createElement("div");
  panelRouting.className = "surfaceTabPanel hidden";
  panelRouting.textContent = "Select this trigger from a voice module Routing tab.";

  const panelDebug = document.createElement("div");
  panelDebug.className = "surfaceTabPanel hidden";
  const patternPreview = document.createElement("pre");
  patternPreview.className = "triggerPatternPanel";
  panelDebug.append(
    patternPreview,
    ctlFloat({ label: "Rotation", value: t.euclidRot, min: -32, max: 32, step: 1, integer: true, onChange: (x) => setParam("euclidRot", x) }),
    ctlFloat({ label: "CA Rule", value: t.caRule, min: 0, max: 255, step: 1, integer: true, onChange: (x) => setParam("caRule", x) }),
    ctlFloat({ label: "CA Init", value: t.caInit, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("caInit", x) }),
  );

  const panelSettings = document.createElement("div");
  panelSettings.className = "surfaceTabPanel hidden";
  panelSettings.append(
    ctlFloat({ label: "Determinism", value: t.determinism, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("determinism", x) }),
    ctlFloat({ label: "Weird", value: t.weird, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("weird", x) }),
  );

  face.append(panelMain, panelRouting, panelDebug, panelSettings);

  const tabs = document.createElement("div");
  tabs.className = "surfaceTabs";
  const tabSpecs: Array<{ id: TriggerFaceTab; label: string; panel: HTMLElement }> = [
    { id: "MAIN", label: "Main", panel: panelMain },
    { id: "ROUTING", label: "Routing", panel: panelRouting },
    { id: "DEBUG", label: "Debug", panel: panelDebug },
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
    const compact = patternPreviewText().replace(/\s+/g, "").slice(0, 32);
    stepGrid.textContent = "";
    for (let i = 0; i < 32; i++) {
      const cell = document.createElement("span");
      const c = compact[i] ?? ".";
      cell.className = `triggerStepCell ${c !== "." ? "on" : "off"}`;
      stepGrid.appendChild(cell);
    }
    transportReadout.textContent = `${t.length} steps · /${t.subdiv} · ${Math.round(t.density * 100)}%`;
    patternPreview.textContent = patternPreviewText();
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
