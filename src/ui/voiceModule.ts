import type { DrumModule, Patch, SoundModule, TonalModule } from "../patch";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createModuleTabShell } from "./moduleShell";

export type VoiceTab = "MAIN" | "ROUTING" | "SETTINGS";

type UiState = {
  tab: VoiceTab;
  setTab: (t: VoiceTab) => void;
};

type TriggerOption = { id: string; label: string };
type ControlOption = { id: string; label: string };

type SurfaceParams = {
  root: HTMLElement;
  v: SoundModule;
  getLedState: (moduleId: string) => { active: boolean; hit: boolean };
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void;
  ui: UiState;
  triggerOptions: TriggerOption[];
  controlOptions: ControlOption[];
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
  nameWrap.innerHTML = `<div class="name">${v.name}</div><div class="surfaceHeaderSubline small"><span class="surfacePresetLabel">Preset: ${v.presetName ?? (v.type === "drum" ? "Deep Kick" : "Rubber Bass")}</span><span class="moduleId">${v.id.slice(-6).toUpperCase()}</span></div>`;
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
  wireSafeDeleteButton(btnX, () => onRemove?.());

  right.append(ledA, ledHit, toggle, btnX);
  header.append(left, right);
  return { header, ledA, ledHit, syncToggle };
}

function createFaceTabs(
  ui: UiState,
  mainPanel: HTMLElement,
  triggerOptions: TriggerOption[],
  v: SoundModule,
  onPatchChange: SurfaceParams["onPatchChange"],
) {
  const panelRouting = document.createElement("div");
  panelRouting.className = "utilityPanel";

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

  const panelSettings = document.createElement("div");
  panelSettings.append(
    ctlFloat({ label: "Pan", value: v.pan, min: -1, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === v.id);
      if (m && (m.type === "drum" || m.type === "tonal")) m.pan = x;
    }, { regen: false }) }),
    ctlFloat({ label: "Level", value: v.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === v.id);
      if (m && (m.type === "drum" || m.type === "tonal")) m.amp = x;
    }, { regen: false }) }),
  );

  return createModuleTabShell({
    specs: [
      { id: "MAIN", label: "Main", panel: mainPanel },
      { id: "ROUTING", label: "Routing", panel: panelRouting },
      { id: "SETTINGS", label: "Settings", panel: panelSettings },
    ],
    activeTab: ui.tab,
    onTabChange: (tab) => ui.setTab(tab),
  });
}


function modulationSelect(options: ControlOption[], selected: string | undefined, onChange: (value: string | null) => void) {
  const wrap = document.createElement("div");
  wrap.className = "utilityRouteCard";
  const label = document.createElement("div");
  label.className = "small utilityRouteTitle";
  label.textContent = "Mod source";
  const sel = document.createElement("select");
  const none = document.createElement("option");
  none.value = "";
  none.textContent = "None";
  if (!selected) none.selected = true;
  sel.appendChild(none);
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.id;
    o.textContent = opt.label;
    if (opt.id === selected) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () => onChange(sel.value || null);
  wrap.append(label, sel);
  return wrap;
}

export function renderDrumModuleSurface(params: SurfaceParams) {
  const { root, v, onPatchChange, getLedState, triggerOptions, controlOptions, ui, onRemove } = params;
  const d = v as DrumModule;

  const surface = document.createElement("section");
  surface.className = "moduleSurface drumSurface";
  surface.dataset.type = "drum";

  const h = makeHeader(v, "DRUM", onPatchChange, onRemove);
  const main = document.createElement("div");
  main.className = "surfaceTabPanel drumSurfaceBody";
  main.append(
    ctlFloat({ label: "Pitch", value: d.basePitch, min: 24, max: 84, step: 1, integer: true, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.basePitch = x; }, { regen: false }) }),
    modulationSelect(controlOptions, d.modulations?.basePitch, (source) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") { m.modulations = m.modulations ?? {}; if (source) m.modulations.basePitch = source; else delete m.modulations.basePitch; } }, { regen: false })), 
    ctlFloat({ label: "Snap", value: d.snap, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.snap = x; }, { regen: false }) }),
    ctlFloat({ label: "Decay", value: d.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.decay = x; }, { regen: false }) }),
    ctlFloat({ label: "Tone", value: d.tone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.tone = x; }, { regen: false }) }),
    ctlFloat({ label: "Noise", value: d.noise, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.noise = x; }, { regen: false }) }),
    ctlFloat({ label: "Level", value: d.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.amp = x; }, { regen: false }) }),
    ctlFloat({ label: "Pan", value: d.pan, min: -1, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pan = x; }, { regen: false }) }),
  );

  const shell = createFaceTabs(ui, main, triggerOptions, v, onPatchChange);
  surface.append(h.header, shell.face, shell.tabs);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
  };
}

export function renderSynthModuleSurface(params: SurfaceParams) {
  const { root, v, onPatchChange, getLedState, triggerOptions, controlOptions, ui, onRemove } = params;
  const t = v as TonalModule;

  const surface = document.createElement("section");
  surface.className = "moduleSurface synthSurface";
  surface.dataset.type = "tonal";

  const h = makeHeader(v, "SYNTH", onPatchChange, onRemove);
  const main = document.createElement("div");
  main.className = "surfaceTabPanel synthSurfaceBody";
  main.append(
    ctlFloat({ label: "Wave", value: t.waveform, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.waveform = x; }, { regen: false }) }),
    ctlFloat({ label: "Cutoff", value: t.cutoff, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.cutoff = x; }, { regen: false }) }),
    modulationSelect(controlOptions, t.modulations?.cutoff, (source) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") { m.modulations = m.modulations ?? {}; if (source) m.modulations.cutoff = source; else delete m.modulations.cutoff; } }, { regen: false })), 
    ctlFloat({ label: "Reso", value: t.resonance, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.resonance = x; }, { regen: false }) }),
    ctlFloat({ label: "Attack", value: t.attack, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.attack = x; }, { regen: false }) }),
    ctlFloat({ label: "Decay", value: t.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.decay = x; }, { regen: false }) }),
    ctlFloat({ label: "Level", value: t.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.amp = x; }, { regen: false }) }),
    ctlFloat({ label: "Mod", value: t.modDepth, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modDepth = x; }, { regen: false }) }),
    ctlFloat({ label: "Pan", value: t.pan, min: -1, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.pan = x; }, { regen: false }) }),
  );

  const shell = createFaceTabs(ui, main, triggerOptions, v, onPatchChange);
  surface.append(h.header, shell.face, shell.tabs);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
  };
}
