import type { DrumModule, Patch, SoundModule, TonalModule } from "../patch";
import { ctlFloat } from "./ctl";

export type VoiceTab = "MAIN" | "CONNECTIONS" | "MIDI" | "SETTINGS";

type UiState = {
  tab: VoiceTab;
  setTab: (t: VoiceTab) => void;
};

type TriggerOption = { id: string; label: string };

type TabSpec = { id: VoiceTab; label: string; panel: HTMLElement };

function createGroup(title: string, ...controls: HTMLElement[]) {
  const group = document.createElement("div");
  group.className = "moduleGroup";
  const label = document.createElement("div");
  label.className = "small moduleGroupTitle";
  label.textContent = title;
  const row = document.createElement("div");
  row.className = "row compactRow voiceRow";
  row.append(...controls);
  group.append(label, row);
  return group;
}

function createConnectionPill(label: string, value: string, strong = false) {
  const pill = document.createElement("div");
  pill.className = `connectionPill${strong ? " strong" : ""}`;
  const l = document.createElement("span");
  l.className = "small";
  l.textContent = label;
  const v = document.createElement("span");
  v.className = "connectionPillValue";
  v.textContent = value;
  pill.append(l, v);
  return pill;
}

export function renderVoiceModule(
  root: HTMLElement,
  v: SoundModule,
  _voiceIndex: number,
  getLedState: (moduleId: string) => { active: boolean; hit: boolean },
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  ui: UiState,
  triggerOptions: TriggerOption[],
  onRemove?: () => void,
) {
  const card = document.createElement("section");
  card.className = "card moduleCard soundCard";
  card.dataset.type = v.type;

  const header = document.createElement("div");
  header.className = "cardHeader";

  const familyBadge = document.createElement("div");
  familyBadge.className = "familyBadge";
  familyBadge.textContent = v.type === "drum" ? "DRUM" : "TONAL";

  const typeLabel = document.createElement("div");
  typeLabel.className = "small moduleTypeLabel";
  typeLabel.textContent = v.type === "drum" ? "Drum Synth Module" : "Tonal Synth Module";

  const ledA = document.createElement("div");
  ledA.className = "led";
  const ledHit = document.createElement("div");
  ledHit.className = "led";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = v.name;

  const idRef = document.createElement("div");
  idRef.className = "small moduleId";
  idRef.textContent = `ID ${v.id.slice(-6).toUpperCase()}`;

  const titleWrap = document.createElement("div");
  titleWrap.className = "moduleTitleWrap";
  titleWrap.append(typeLabel, name, idRef);

  const identity = document.createElement("div");
  identity.className = "titleRow";
  identity.append(familyBadge, ledA, ledHit, titleWrap);

  const right = document.createElement("div");
  right.className = "rightControls";
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
  right.append(toggle, btnX);
  header.append(identity, right);

  const relationRow = document.createElement("div");
  relationRow.className = "moduleRelations";
  const triggerLabel = triggerOptions.find((opt) => opt.id === v.triggerSource)?.label ?? (v.triggerSource ? `Missing ${v.triggerSource.slice(-4)}` : "Unassigned");
  relationRow.append(
    createConnectionPill("Trigger source", triggerLabel, Boolean(v.triggerSource)),
    createConnectionPill("Synth role", v.type === "drum" ? "Percussive voice" : "Tonal voice"),
  );

  const mainPanel = document.createElement("div");
  mainPanel.className = "moduleMainPanel";
  if (v.type === "drum") {
    const d = v as DrumModule;
    mainPanel.append(
      createGroup(
        "Amplitude",
        ctlFloat({ label: "Level", value: d.amp, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.amp = x; }, { regen: false }) }),
        ctlFloat({ label: "Pan", value: d.pan, min: -1, max: 1, step: 0.001, center: 0, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pan = x; }, { regen: false }) }),
      ),
      createGroup(
        "Pitch / Body",
        ctlFloat({ label: "Base", value: d.basePitch, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.basePitch = x; }, { regen: false }) }),
        ctlFloat({ label: "Tone", value: d.tone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.tone = x; }, { regen: false }) }),
        ctlFloat({ label: "Body", value: d.bodyTone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.bodyTone = x; }, { regen: false }) }),
      ),
      createGroup(
        "Decay",
        ctlFloat({ label: "Decay", value: d.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.decay = x; }, { regen: false }) }),
        ctlFloat({ label: "Pitch Env", value: d.pitchEnvDecay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pitchEnvDecay = x; }, { regen: false }) }),
      ),
      createGroup(
        "Transient / Click",
        ctlFloat({ label: "Click", value: d.transient, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.transient = x; }, { regen: false }) }),
        ctlFloat({ label: "Snap", value: d.snap, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.snap = x; }, { regen: false }) }),
      ),
      createGroup(
        "Noise / Texture",
        ctlFloat({ label: "Noise", value: d.noise, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.noise = x; }, { regen: false }) }),
        ctlFloat({ label: "Pitch Amt", value: d.pitchEnvAmt, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pitchEnvAmt = x; }, { regen: false }) }),
      ),
    );
  } else {
    const t = v as TonalModule;
    mainPanel.append(
      createGroup(
        "Amplitude / Envelope",
        ctlFloat({ label: "Level", value: t.amp, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.amp = x; }, { regen: false }) }),
        ctlFloat({ label: "Attack", value: t.attack, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.attack = x; }, { regen: false }) }),
        ctlFloat({ label: "Decay", value: t.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.decay = x; }, { regen: false }) }),
        ctlFloat({ label: "Sustain", value: t.sustain, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.sustain = x; }, { regen: false }) }),
        ctlFloat({ label: "Release", value: t.release, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.release = x; }, { regen: false }) }),
      ),
      createGroup(
        "Waveform / Oscillator",
        ctlFloat({ label: "Wave", value: t.waveform, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.waveform = x; }, { regen: false }) }),
        ctlFloat({ label: "Mod Depth", value: t.modDepth, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modDepth = x; }, { regen: false }) }),
        ctlFloat({ label: "Mod Rate", value: t.modRate, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modRate = x; }, { regen: false }) }),
      ),
      createGroup(
        "Pitch / Tuning",
        ctlFloat({ label: "Coarse", value: t.coarseTune, min: -24, max: 24, step: 1, format: (x) => `${x.toFixed(0)} st`, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.coarseTune = x; }, { regen: false }) }),
        ctlFloat({ label: "Fine", value: t.fineTune, min: -1, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.fineTune = x; }, { regen: false }) }),
        ctlFloat({ label: "Glide", value: t.glide, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.glide = x; }, { regen: false }) }),
      ),
      createGroup(
        "Brightness / Filter",
        ctlFloat({ label: "Cutoff", value: t.cutoff, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.cutoff = x; }, { regen: false }) }),
        ctlFloat({ label: "Res", value: t.resonance, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.resonance = x; }, { regen: false }) }),
        ctlFloat({ label: "Pan", value: t.pan, min: -1, max: 1, step: 0.001, center: 0, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.pan = x; }, { regen: false }) }),
      ),
    );
  }

  const tabs = document.createElement("div");
  tabs.className = "modTabs";

  const panelConnections = document.createElement("div");
  panelConnections.className = "modPanel";
  const sourceRow = document.createElement("div");
  sourceRow.className = "seqSourceRow";
  const sourceLabel = document.createElement("div");
  sourceLabel.className = "small";
  sourceLabel.textContent = "Trigger source";
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
  if (v.triggerSource && !triggerOptions.some((opt) => opt.id === v.triggerSource)) {
    const missing = document.createElement("option");
    missing.value = v.triggerSource;
    missing.textContent = `Missing (${v.triggerSource})`;
    missing.selected = true;
    sourceSel.appendChild(missing);
  }
  sourceSel.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === v.id);
    if (m && (m.type === "drum" || m.type === "tonal")) m.triggerSource = sourceSel.value || null;
  }, { regen: true });

  const hint = document.createElement("div");
  hint.className = "small";
  hint.textContent = "Connections use module IDs and badges instead of patch cables.";
  sourceRow.append(sourceLabel, sourceSel);
  panelConnections.append(sourceRow, hint);

  const panelMidi = document.createElement("div");
  panelMidi.className = "modPanel";
  panelMidi.textContent = "MIDI mapping (coming soon)";

  const panelSettings = document.createElement("div");
  panelSettings.className = "modPanel";
  panelSettings.textContent = "Module settings (coming soon)";

  const tabSpecs: TabSpec[] = [
    { id: "CONNECTIONS", label: "Connections", panel: panelConnections },
    { id: "MIDI", label: "MIDI", panel: panelMidi },
    { id: "SETTINGS", label: "Settings", panel: panelSettings },
  ];

  const setActiveTab = (tab: VoiceTab) => {
    ui.setTab(tab);
    for (const spec of tabSpecs) {
      const active = tab === spec.id;
      spec.panel.classList.toggle("hidden", !active);
      (spec.panel as any)._btn?.classList.toggle("active", active);
    }
    const isMain = tab === "MAIN";
    mainPanel.classList.toggle("hidden", !isMain);
    mainBtn.classList.toggle("active", isMain);
  };

  const mainBtn = document.createElement("button");
  mainBtn.className = "modTab";
  mainBtn.textContent = "Main";
  mainBtn.onclick = () => setActiveTab("MAIN");
  tabs.append(mainBtn);

  for (const spec of tabSpecs) {
    const b = document.createElement("button");
    b.className = "modTab";
    b.textContent = spec.label;
    b.onclick = () => setActiveTab(spec.id);
    (spec.panel as any)._btn = b;
    tabs.append(b);
  }

  card.append(header, relationRow, mainPanel, tabs, panelConnections, panelMidi, panelSettings);
  setActiveTab(ui.tab);
  root.appendChild(card);

  return () => {
    const st = getLedState(v.id);
    ledA.className = "led" + (st.active ? " on" : "");
    ledHit.className = "led" + (st.hit ? " on hit" : "");
    syncToggle();
  };
}
