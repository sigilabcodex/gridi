import type { DrumModule, Patch, SoundModule, TonalModule } from "../patch";
import { ctlFloat } from "./ctl";

export type VoiceTab = "MAIN" | "ROUTING" | "MIDI" | "SETTINGS";

type UiState = {
  tab: VoiceTab;
  setTab: (t: VoiceTab) => void;
};

type TriggerOption = { id: string; label: string };

type SurfaceParams = {
  root: HTMLElement;
  v: SoundModule;
  getLedState: (moduleId: string) => { active: boolean; hit: boolean };
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void;
  ui: UiState;
  triggerOptions: TriggerOption[];
  onRemove?: () => void;
};

function makeHeader(v: SoundModule, badgeText: string, onPatchChange: SurfaceParams["onPatchChange"], onRemove?: () => void) {
  const header = document.createElement("div");
  header.className = "surfaceHeader";

  const left = document.createElement("div");
  left.className = "surfaceIdentity";
  const badge = document.createElement("div");
  badge.className = "surfaceBadge";
  badge.textContent = badgeText;
  const nameWrap = document.createElement("div");
  nameWrap.className = "surfaceNameWrap";
  nameWrap.innerHTML = `<div class="name">${v.name}</div><div class="small">Preset: ${v.presetName ?? (v.type === "drum" ? "Deep Kick" : "Rubber Bass")}</div><div class="small moduleId">${v.id.slice(-6).toUpperCase()}</div>`;
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
  btnX.className = "danger";
  btnX.textContent = "×";
  btnX.onclick = () => onRemove?.();

  right.append(ledA, ledHit, toggle, btnX);
  header.append(left, right);
  return { header, ledA, ledHit, syncToggle };
}

function createFaceTabs(
  faceRoot: HTMLElement,
  mainPanel: HTMLElement,
  ui: UiState,
  triggerOptions: TriggerOption[],
  v: SoundModule,
  onPatchChange: SurfaceParams["onPatchChange"],
) {
  const panelRouting = document.createElement("div");
  panelRouting.className = "surfaceTabPanel utilityPanel";

  const sourceRow = document.createElement("div");
  sourceRow.className = "utilityRouteCard";
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
  routeMap.textContent = v.triggerSource ? `listening to ${v.triggerSource.slice(-4).toUpperCase()}` : "not listening";
  sourceRow.append(sourceSel, routeMap);
  panelRouting.appendChild(sourceRow);

  const panelMidi = document.createElement("div");
  panelMidi.className = "surfaceTabPanel hidden";
  panelMidi.textContent = "MIDI mapping will live here.";

  const panelSettings = document.createElement("div");
  panelSettings.className = "surfaceTabPanel hidden";
  panelSettings.textContent = "Advanced voice setup.";

  faceRoot.append(mainPanel, panelRouting, panelMidi, panelSettings);

  const tabs = document.createElement("div");
  tabs.className = "surfaceTabs";
  const specs: Array<{ id: VoiceTab; label: string; panel: HTMLElement }> = [
    { id: "MAIN", label: "Main", panel: mainPanel },
    { id: "ROUTING", label: "Routing", panel: panelRouting },
    { id: "MIDI", label: "MIDI", panel: panelMidi },
    { id: "SETTINGS", label: "Settings", panel: panelSettings },
  ];

  const buttons = new Map<VoiceTab, HTMLButtonElement>();
  const setTab = (tab: VoiceTab) => {
    ui.setTab(tab);
    for (const spec of specs) {
      const active = spec.id === tab;
      spec.panel.classList.toggle("hidden", !active);
      buttons.get(spec.id)?.classList.toggle("active", active);
    }
  };

  for (const spec of specs) {
    const btn = document.createElement("button");
    btn.className = "modTab";
    btn.textContent = spec.label;
    btn.onclick = () => setTab(spec.id);
    tabs.appendChild(btn);
    buttons.set(spec.id, btn);
  }

  setTab(ui.tab);
  return tabs;
}

export function renderDrumModuleSurface(params: SurfaceParams) {
  const { root, v, onPatchChange, getLedState, triggerOptions, ui, onRemove } = params;
  const d = v as DrumModule;

  const surface = document.createElement("section");
  surface.className = "moduleSurface drumSurface";
  surface.dataset.type = "drum";

  const h = makeHeader(v, "DRUM", onPatchChange, onRemove);
  const face = document.createElement("div");
  face.className = "surfaceFace";

  const main = document.createElement("div");
  main.className = "surfaceTabPanel drumSurfaceBody";
  main.append(
    ctlFloat({ label: "Punch", value: d.transient, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.transient = x; }, { regen: false }) }),
    ctlFloat({ label: "Body", value: d.bodyTone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.bodyTone = x; }, { regen: false }) }),
    ctlFloat({ label: "Decay", value: d.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.decay = x; }, { regen: false }) }),
    ctlFloat({ label: "Level", value: d.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.amp = x; }, { regen: false }) }),
  );

  const tabs = createFaceTabs(face, main, ui, triggerOptions, v, onPatchChange);
  surface.append(h.header, face, tabs);
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

  const h = makeHeader(v, "SYNTH", onPatchChange, onRemove);
  const face = document.createElement("div");
  face.className = "surfaceFace";

  const main = document.createElement("div");
  main.className = "surfaceTabPanel synthSurfaceBody";
  main.append(
    ctlFloat({ label: "Wave", value: t.waveform, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.waveform = x; }, { regen: false }) }),
    ctlFloat({ label: "Cutoff", value: t.cutoff, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.cutoff = x; }, { regen: false }) }),
    ctlFloat({ label: "Decay", value: t.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.decay = x; }, { regen: false }) }),
    ctlFloat({ label: "Level", value: t.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.amp = x; }, { regen: false }) }),
  );

  const tabs = createFaceTabs(face, main, ui, triggerOptions, v, onPatchChange);
  surface.append(h.header, face, tabs);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
  };
}
