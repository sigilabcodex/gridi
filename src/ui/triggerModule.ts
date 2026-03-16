import type { Mode, Patch, TriggerModule } from "../patch";
import { getPatternPreview } from "../engine/pattern/module";
import { ctlFloat } from "./ctl";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

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
  meta.innerHTML = `<div class="small">Pattern sequencer</div><div class="name">${t.name}</div><div class="small moduleId">ID ${t.id.slice(-6).toUpperCase()}</div>`;
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

  const primary = document.createElement("div");
  primary.className = "triggerPrimary";
  const patternPreviewText = () => getPatternPreview(t, `${t.id}:preview`, 64);

  const pulseRail = document.createElement("div");
  pulseRail.className = "triggerPulseRail";

  const pulseHeader = document.createElement("div");
  pulseHeader.className = "triggerSectionLabel";
  pulseHeader.textContent = "Pulse map";

  const stepGrid = document.createElement("div");
  stepGrid.className = "triggerStepGrid";

  const transportReadout = document.createElement("div");
  transportReadout.className = "triggerTransportReadout small";

  const syncPatternRail = () => {
    const compact = patternPreviewText().replace(/\s+/g, "").slice(0, 32);
    stepGrid.textContent = "";
    for (let i = 0; i < 32; i++) {
      const cell = document.createElement("span");
      const c = compact[i] ?? ".";
      cell.className = `triggerStepCell ${c !== "." ? "on" : "off"}`;
      stepGrid.appendChild(cell);
    }
    transportReadout.textContent = `${t.length} steps · /${t.subdiv} subdivision · ${Math.round(t.density * 100)}% density`;
  };

  pulseRail.append(pulseHeader, stepGrid, transportReadout);

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

  const pulseRack = document.createElement("div");
  pulseRack.className = "triggerPulseRack";
  pulseRack.append(
    ctlFloat({ label: "Density", value: t.density, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("density", x) }),
    ctlFloat({ label: "Drop", value: t.drop, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("drop", x) }),
    ctlFloat({ label: "Determinism", value: t.determinism, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("determinism", x) }),
    ctlFloat({ label: "Weird", value: t.weird, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("weird", x) }),
    ctlFloat({ label: "Length", value: t.length, min: 1, max: 128, step: 1, integer: true, onChange: (x) => setParam("length", x) }),
    ctlFloat({ label: "Subdiv", value: t.subdiv, min: 1, max: 8, step: 1, integer: true, onChange: (x) => setParam("subdiv", x) }),
  );

  const patternPreview = document.createElement("pre");
  patternPreview.className = "triggerPatternPanel";
  patternPreview.textContent = patternPreviewText();
  patternPreview.title = "Pulse stream preview";

  primary.append(pulseRail, modeRack, pulseRack, patternPreview);

  const tabs = document.createElement("div");
  tabs.className = "surfaceTabs";
  const panelConnections = document.createElement("div");
  panelConnections.className = "surfaceTabPanel hidden";
  panelConnections.textContent = "Connections: choose this trigger in a drum or synth module connection tab.";
  const panelDebug = document.createElement("div");
  panelDebug.className = "surfaceTabPanel hidden";
  panelDebug.append(
    ctlFloat({ label: "Rotation", value: t.euclidRot, min: -32, max: 32, step: 1, integer: true, onChange: (x) => setParam("euclidRot", x) }),
    ctlFloat({ label: "CA Rule", value: t.caRule, min: 0, max: 255, step: 1, integer: true, onChange: (x) => setParam("caRule", x) }),
    ctlFloat({ label: "CA Init", value: t.caInit, min: 0, max: 1, step: 0.001, onChange: (x) => setParam("caInit", x) }),
  );

  const btnMain = document.createElement("button");
  btnMain.className = "modTab active";
  btnMain.textContent = "Main";
  const btnConn = document.createElement("button");
  btnConn.className = "modTab";
  btnConn.textContent = "Connections";
  const btnDebug = document.createElement("button");
  btnDebug.className = "modTab";
  btnDebug.textContent = "Debug";

  const setTab = (tab: "MAIN" | "CON" | "DBG") => {
    primary.classList.toggle("hidden", tab !== "MAIN");
    panelConnections.classList.toggle("hidden", tab !== "CON");
    panelDebug.classList.toggle("hidden", tab !== "DBG");
    btnMain.classList.toggle("active", tab === "MAIN");
    btnConn.classList.toggle("active", tab === "CON");
    btnDebug.classList.toggle("active", tab === "DBG");
  };
  btnMain.onclick = () => setTab("MAIN");
  btnConn.onclick = () => setTab("CON");
  btnDebug.onclick = () => setTab("DBG");

  tabs.append(btnMain, btnConn, btnDebug);

  surface.append(header, primary, tabs, panelConnections, panelDebug);
  root.appendChild(surface);
  syncPatternRail();

  function setParam(key: keyof TriggerModule, value: number) {
    onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type === "trigger") (m as any)[key] = value;
    }, { regen: true });
  }

  return () => {
    syncToggle();
    patternPreview.textContent = patternPreviewText();
    syncPatternRail();
  };
}

export const renderTriggerModule = renderTriggerSurface;
