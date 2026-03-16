import type { DrumModule, Patch, SoundModule, TonalModule } from "../patch";
import { ctlFloat } from "./ctl";

export type VoiceTab = "MAIN" | "MIDI";

type UiState = {
  tab: VoiceTab;
  setTab: (t: VoiceTab) => void;
};

type TriggerOption = { id: string; label: string };

function createGroup(title: string, ...controls: HTMLElement[]) {
  const group = document.createElement("div");
  group.className = "soundGroup";
  const label = document.createElement("div");
  label.className = "small groupTitle";
  label.textContent = title;
  const row = document.createElement("div");
  row.className = "row compactRow voiceRow";
  row.append(...controls);
  group.append(label, row);
  return group;
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
  card.className = "card soundCard";
  card.dataset.type = v.type;
  card.dataset.kind = v.type;

  const header = document.createElement("div");
  header.className = "cardHeader";
  const titleRow = document.createElement("div");
  titleRow.className = "titleRow";
  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = v.type === "drum" ? "DRUM SYNTH" : "TONAL SYNTH";
  const ledA = document.createElement("div");
  ledA.className = "led";
  const ledHit = document.createElement("div");
  ledHit.className = "led";
  const name = document.createElement("div");
  name.className = "name";
  name.textContent = v.name;
  titleRow.append(badge, ledA, ledHit, name);

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
  header.append(titleRow, right);

  const tabs = document.createElement("div");
  tabs.className = "modTabs";
  const btnMain = document.createElement("button"); btnMain.className = "modTab"; btnMain.textContent = "SYNTH";
  const btnMidi = document.createElement("button"); btnMidi.className = "modTab"; btnMidi.textContent = "MIDI";
  tabs.append(btnMain, btnMidi);

  const panelMain = document.createElement("div");
  panelMain.className = "modPanel";

  if (v.type === "drum") {
    const d = v as DrumModule;
    panelMain.append(
      createGroup(
        "Mix",
        ctlFloat({ label: "Level", value: d.amp, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.amp = x; }, { regen: false }) }),
        ctlFloat({ label: "Pan", value: d.pan, min: -1, max: 1, step: 0.001, center: 0, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pan = x; }, { regen: false }) }),
      ),
      createGroup(
        "Body",
        ctlFloat({ label: "Base Pitch", value: d.basePitch, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.basePitch = x; }, { regen: false }) }),
        ctlFloat({ label: "Decay", value: d.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.decay = x; }, { regen: false }) }),
        ctlFloat({ label: "Body Tone", value: d.bodyTone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.bodyTone = x; }, { regen: false }) }),
        ctlFloat({ label: "Tone", value: d.tone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.tone = x; }, { regen: false }) }),
      ),
      createGroup(
        "Transient",
        ctlFloat({ label: "Click", value: d.transient, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.transient = x; }, { regen: false }) }),
        ctlFloat({ label: "Snap", value: d.snap, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.snap = x; }, { regen: false }) }),
        ctlFloat({ label: "Noise", value: d.noise, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.noise = x; }, { regen: false }) }),
      ),
      createGroup(
        "Pitch Envelope",
        ctlFloat({ label: "Amount", value: d.pitchEnvAmt, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pitchEnvAmt = x; }, { regen: false }) }),
        ctlFloat({ label: "Decay", value: d.pitchEnvDecay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pitchEnvDecay = x; }, { regen: false }) }),
      ),
    );
  } else {
    const t = v as TonalModule;
    panelMain.append(
      createGroup(
        "Mix",
        ctlFloat({ label: "Level", value: t.amp, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.amp = x; }, { regen: false }) }),
        ctlFloat({ label: "Pan", value: t.pan, min: -1, max: 1, step: 0.001, center: 0, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.pan = x; }, { regen: false }) }),
      ),
      createGroup(
        "Oscillator",
        ctlFloat({ label: "Wave", value: t.waveform, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.waveform = x; }, { regen: false }) }),
        ctlFloat({ label: "Coarse", value: t.coarseTune, min: -24, max: 24, step: 1, format: (x) => `${x.toFixed(0)} st`, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.coarseTune = x; }, { regen: false }) }),
        ctlFloat({ label: "Fine", value: t.fineTune, min: -1, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.fineTune = x; }, { regen: false }) }),
        ctlFloat({ label: "Glide", value: t.glide, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.glide = x; }, { regen: false }) }),
      ),
      createGroup(
        "Envelope",
        ctlFloat({ label: "Attack", value: t.attack, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.attack = x; }, { regen: false }) }),
        ctlFloat({ label: "Decay", value: t.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.decay = x; }, { regen: false }) }),
        ctlFloat({ label: "Sustain", value: t.sustain, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.sustain = x; }, { regen: false }) }),
        ctlFloat({ label: "Release", value: t.release, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.release = x; }, { regen: false }) }),
      ),
      createGroup(
        "Filter & Mod",
        ctlFloat({ label: "Cutoff", value: t.cutoff, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.cutoff = x; }, { regen: false }) }),
        ctlFloat({ label: "Res", value: t.resonance, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.resonance = x; }, { regen: false }) }),
        ctlFloat({ label: "Mod Depth", value: t.modDepth, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modDepth = x; }, { regen: false }) }),
        ctlFloat({ label: "Mod Rate", value: t.modRate, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modRate = x; }, { regen: false }) }),
      ),
    );
  }

  const sourceRow = document.createElement("div");
  sourceRow.className = "seqSourceRow";
  const sourceLabel = document.createElement("div"); sourceLabel.className = "small"; sourceLabel.textContent = "Trigger Source";
  const sourceSel = document.createElement("select");
  const none = document.createElement("option"); none.value = ""; none.textContent = "Unassigned"; if (!v.triggerSource) none.selected = true; sourceSel.appendChild(none);
  for (const opt of triggerOptions) {
    const o = document.createElement("option"); o.value = opt.id; o.textContent = opt.label; if (opt.id === v.triggerSource) o.selected = true; sourceSel.appendChild(o);
  }
  if (v.triggerSource && !triggerOptions.some((opt) => opt.id === v.triggerSource)) {
    const missing = document.createElement("option"); missing.value = v.triggerSource; missing.textContent = `Missing (${v.triggerSource})`; missing.selected = true; sourceSel.appendChild(missing);
  }
  sourceSel.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === v.id);
    if (m && (m.type === "drum" || m.type === "tonal")) m.triggerSource = sourceSel.value || null;
  }, { regen: true });
  sourceRow.append(sourceLabel, sourceSel);
  panelMain.append(sourceRow);

  const panelMidi = document.createElement("div");
  panelMidi.className = "modPanel";
  panelMidi.textContent = "MIDI (coming soon)";

  const setActiveTab = (t: VoiceTab) => {
    ui.setTab(t);
    btnMain.classList.toggle("active", t === "MAIN");
    btnMidi.classList.toggle("active", t === "MIDI");
    panelMain.classList.toggle("hidden", t !== "MAIN");
    panelMidi.classList.toggle("hidden", t !== "MIDI");
  };
  btnMain.onclick = () => setActiveTab("MAIN");
  btnMidi.onclick = () => setActiveTab("MIDI");

  card.append(header, tabs, panelMain, panelMidi);
  setActiveTab(ui.tab);
  root.appendChild(card);

  return () => {
    const st = getLedState(v.id);
    ledA.className = "led" + (st.active ? " on" : "");
    ledHit.className = "led" + (st.hit ? " on hit" : "");
    syncToggle();
  };
}
