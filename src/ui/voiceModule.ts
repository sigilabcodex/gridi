import type { DrumModule, Patch, SoundModule, TonalModule } from "../patch";
import { ctlFloat } from "./ctl";

export type VoiceTab = "MAIN" | "CONNECTIONS" | "MIDI" | "SETTINGS";

type UiState = {
  tab: VoiceTab;
  setTab: (t: VoiceTab) => void;
};

type TriggerOption = { id: string; label: string };

type TabSpec = { id: VoiceTab; label: string; panel: HTMLElement };

type SurfaceParams = {
  root: HTMLElement;
  v: SoundModule;
  getLedState: (moduleId: string) => { active: boolean; hit: boolean };
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void;
  ui: UiState;
  triggerOptions: TriggerOption[];
  onRemove?: () => void;
};

function createHeader(v: SoundModule, familyLabel: string, typeLabel: string, onPatchChange: SurfaceParams["onPatchChange"], onRemove?: () => void) {
  const header = document.createElement("div");
  header.className = "surfaceHeader";

  const left = document.createElement("div");
  left.className = "surfaceIdentity";

  const badge = document.createElement("div");
  badge.className = "surfaceBadge";
  badge.textContent = familyLabel;

  const nameWrap = document.createElement("div");
  nameWrap.className = "surfaceNameWrap";
  const kind = document.createElement("div");
  kind.className = "small";
  kind.textContent = typeLabel;
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = v.name;
  const idRef = document.createElement("div");
  idRef.className = "small moduleId";
  idRef.textContent = `ID ${v.id.slice(-6).toUpperCase()}`;
  nameWrap.append(kind, name, idRef);

  left.append(badge, nameWrap);

  const right = document.createElement("div");
  right.className = "rightControls";

  const ledA = document.createElement("div");
  ledA.className = "led";
  const ledHit = document.createElement("div");
  ledHit.className = "led";

  const toggle = document.createElement("button");
  const syncToggle = () => {
    toggle.textContent = v.enabled ? "On" : "Off";
    toggle.className = v.enabled ? "primary" : "";
  };
  syncToggle();
  toggle.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === v.id);
    if (m && (m.type === "drum" || m.type === "tonal")) m.enabled = !m.enabled;
  }, { regen: false });

  const btnX = document.createElement("button");
  btnX.textContent = "×";
  btnX.className = "danger";
  btnX.onclick = () => onRemove?.();

  right.append(ledA, ledHit, toggle, btnX);
  header.append(left, right);

  return { header, ledA, ledHit, syncToggle };
}

function createTabs(mainPanel: HTMLElement, ui: UiState, triggerOptions: TriggerOption[], v: SoundModule, onPatchChange: SurfaceParams["onPatchChange"]) {
  const tabs = document.createElement("div");
  tabs.className = "surfaceTabs";

  const panelConnections = document.createElement("div");
  panelConnections.className = "surfaceTabPanel utilityPanel";

  const sourceRow = document.createElement("div");
  sourceRow.className = "utilityRouteCard";
  const sourceTitle = document.createElement("div");
  sourceTitle.className = "utilityRouteTitle";
  sourceTitle.textContent = "Trigger route";
  const sourceLabel = document.createElement("div");
  sourceLabel.className = "small";
  sourceLabel.textContent = "Map this voice to a trigger module";
  const sourceSel = document.createElement("select");
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "Unassigned";
  if (!v.triggerSource) none.selected = true;
  sourceSel.appendChild(none);
  for (const opt of triggerOptions) {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === v.triggerSource) o.selected = true;
    sourceSel.appendChild(o);
  }
  sourceSel.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === v.id);
    if (m && (m.type === "drum" || m.type === "tonal")) m.triggerSource = sourceSel.value || null;
  }, { regen: true });

  const routeMap = document.createElement("div");
  routeMap.className = "utilityRouteMap small";
  routeMap.textContent = `voice ${v.id.slice(-4).toUpperCase()} → ${v.triggerSource ? `trigger ${v.triggerSource.slice(-4).toUpperCase()}` : "no trigger"}`;

  sourceRow.append(sourceTitle, sourceLabel, sourceSel, routeMap);

  const panelMidi = document.createElement("div");
  panelMidi.className = "surfaceTabPanel hidden";
  panelMidi.textContent = "MIDI mapping (coming soon)";

  const panelSettings = document.createElement("div");
  panelSettings.className = "surfaceTabPanel hidden";
  panelSettings.textContent = "Advanced configuration (coming soon)";

  panelConnections.append(sourceRow);

  const specs: TabSpec[] = [
    { id: "CONNECTIONS", label: "Routing", panel: panelConnections },
    { id: "MIDI", label: "MIDI", panel: panelMidi },
    { id: "SETTINGS", label: "Debug", panel: panelSettings },
  ];

  const setTab = (tab: VoiceTab) => {
    ui.setTab(tab);
    mainPanel.classList.toggle("hidden", tab !== "MAIN");
    mainBtn.classList.toggle("active", tab === "MAIN");
    for (const spec of specs) {
      const active = spec.id === tab;
      spec.panel.classList.toggle("hidden", !active);
      (spec.panel as any)._btn?.classList.toggle("active", active);
    }
  };

  const mainBtn = document.createElement("button");
  mainBtn.className = "modTab";
  mainBtn.textContent = "Main";
  mainBtn.onclick = () => setTab("MAIN");
  tabs.append(mainBtn);

  for (const spec of specs) {
    const btn = document.createElement("button");
    btn.className = "modTab";
    btn.textContent = spec.label;
    btn.onclick = () => setTab(spec.id);
    (spec.panel as any)._btn = btn;
    tabs.append(btn);
  }

  setTab(ui.tab);
  return { tabs, panelConnections, panelMidi, panelSettings };
}

export function renderDrumModuleSurface(params: SurfaceParams) {
  const { root, v, onPatchChange, getLedState, triggerOptions, ui, onRemove } = params;
  const d = v as DrumModule;

  const surface = document.createElement("section");
  surface.className = "moduleSurface drumSurface";
  surface.dataset.type = "drum";

  const h = createHeader(v, "DRUM", "Percussive voice", onPatchChange, onRemove);

  const transientLane = document.createElement("div");
  transientLane.className = "drumLane";
  transientLane.innerHTML = `<div class="triggerSectionLabel">Transient</div>`;

  const bodyLane = document.createElement("div");
  bodyLane.className = "drumLane";
  bodyLane.innerHTML = `<div class="triggerSectionLabel">Body + pitch</div>`;

  const perfLane = document.createElement("div");
  perfLane.className = "drumLane";
  perfLane.innerHTML = `<div class="triggerSectionLabel">Performance</div>`;

  transientLane.append(
    ctlFloat({ label: "Transient", value: d.transient, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.transient = x; }, { regen: false }) }),
    ctlFloat({ label: "Snap", value: d.snap, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.snap = x; }, { regen: false }) }),
    ctlFloat({ label: "Noise", value: d.noise, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.noise = x; }, { regen: false }) }),
  );

  bodyLane.append(
    ctlFloat({ label: "Base Pitch", value: d.basePitch, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.basePitch = x; }, { regen: false }) }),
    ctlFloat({ label: "Pitch Env", value: d.pitchEnvAmt, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pitchEnvAmt = x; }, { regen: false }) }),
    ctlFloat({ label: "Pitch Decay", value: d.pitchEnvDecay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pitchEnvDecay = x; }, { regen: false }) }),
    ctlFloat({ label: "Body", value: d.bodyTone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.bodyTone = x; }, { regen: false }) }),
    ctlFloat({ label: "Tone", value: d.tone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.tone = x; }, { regen: false }) }),
  );

  perfLane.append(
    ctlFloat({ label: "Decay", value: d.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.decay = x; }, { regen: false }) }),
    ctlFloat({ label: "Level", value: d.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.amp = x; }, { regen: false }) }),
    ctlFloat({ label: "Pan", value: d.pan, min: -1, max: 1, step: 0.001, center: 0, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pan = x; }, { regen: false }) }),
  );

  const main = document.createElement("div");
  main.className = "drumSurfaceBody";
  main.append(transientLane, bodyLane, perfLane);

  const tabs = createTabs(main, ui, triggerOptions, v, onPatchChange);

  surface.append(h.header, main, tabs.tabs, tabs.panelConnections, tabs.panelMidi, tabs.panelSettings);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
  };
}

export function renderSynthModuleSurface(params: SurfaceParams) {
  const { root, v, onPatchChange, getLedState, triggerOptions, ui, onRemove } = params;
  const t = v as TonalModule;

  const surface = document.createElement("section");
  surface.className = "moduleSurface synthSurface";
  surface.dataset.type = "tonal";

  const h = createHeader(v, "SYNTH", "Tonal voice", onPatchChange, onRemove);

  const oscStrip = document.createElement("div");
  oscStrip.className = "synthBlock";
  oscStrip.innerHTML = `<div class="triggerSectionLabel">Oscillator + motion</div>`;

  const envStrip = document.createElement("div");
  envStrip.className = "synthBlock";
  envStrip.innerHTML = `<div class="triggerSectionLabel">Envelope</div>`;

  const toneStrip = document.createElement("div");
  toneStrip.className = "synthBlock";
  toneStrip.innerHTML = `<div class="triggerSectionLabel">Filter + tuning</div>`;

  oscStrip.append(
    ctlFloat({ label: "Wave", value: t.waveform, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.waveform = x; }, { regen: false }) }),
    ctlFloat({ label: "Mod Depth", value: t.modDepth, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modDepth = x; }, { regen: false }) }),
    ctlFloat({ label: "Mod Rate", value: t.modRate, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modRate = x; }, { regen: false }) }),
    ctlFloat({ label: "Glide", value: t.glide, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.glide = x; }, { regen: false }) }),
  );

  envStrip.append(
    ctlFloat({ label: "Attack", value: t.attack, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.attack = x; }, { regen: false }) }),
    ctlFloat({ label: "Decay", value: t.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.decay = x; }, { regen: false }) }),
    ctlFloat({ label: "Sustain", value: t.sustain, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.sustain = x; }, { regen: false }) }),
    ctlFloat({ label: "Release", value: t.release, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.release = x; }, { regen: false }) }),
  );

  toneStrip.append(
    ctlFloat({ label: "Cutoff", value: t.cutoff, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.cutoff = x; }, { regen: false }) }),
    ctlFloat({ label: "Res", value: t.resonance, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.resonance = x; }, { regen: false }) }),
    ctlFloat({ label: "Coarse", value: t.coarseTune, min: -24, max: 24, step: 1, integer: true, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.coarseTune = x; }, { regen: false }) }),
    ctlFloat({ label: "Fine", value: t.fineTune, min: -1, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.fineTune = x; }, { regen: false }) }),
    ctlFloat({ label: "Level", value: t.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.amp = x; }, { regen: false }) }),
  );

  const main = document.createElement("div");
  main.className = "synthSurfaceBody";
  main.append(oscStrip, envStrip, toneStrip);

  const tabs = createTabs(main, ui, triggerOptions, v, onPatchChange);

  surface.append(h.header, main, tabs.tabs, tabs.panelConnections, tabs.panelMidi, tabs.panelSettings);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
  };
}
