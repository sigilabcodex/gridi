import type { Patch, SoundModule } from "../patch";
import { ctlFloat } from "./ctl";

export type VoiceTab = "MAIN" | "MIDI";

type UiState = {
  tab: VoiceTab;
  setTab: (t: VoiceTab) => void;
};

type TriggerOption = { id: string; label: string };

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
  card.className = "card";
  card.dataset.type = v.type;

  const header = document.createElement("div");
  header.className = "cardHeader";
  const titleRow = document.createElement("div");
  titleRow.className = "titleRow";
  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = v.type === "drum" ? "DRUM" : "TONAL";
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
  const btnMain = document.createElement("button"); btnMain.className = "modTab"; btnMain.textContent = "MAIN";
  const btnMidi = document.createElement("button"); btnMidi.className = "modTab"; btnMidi.textContent = "MIDI";
  tabs.append(btnMain, btnMidi);

  const panelMain = document.createElement("div");
  panelMain.className = "modPanel";
  const row = document.createElement("div");
  row.className = "row compactRow";
  row.append(
    ctlFloat({ label: "Amp", value: v.amp, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m && (m.type === "drum" || m.type === "tonal")) m.amp = x; }, { regen: false }) }),
    ctlFloat({ label: "Timbre", value: v.timbre, min: 0, max: 1, step: 0.001, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m && (m.type === "drum" || m.type === "tonal")) m.timbre = x; }, { regen: false }) }),
    ctlFloat({ label: "Pan", value: v.pan, min: -1, max: 1, step: 0.001, center: 0, format: (x) => x.toFixed(3), onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m && (m.type === "drum" || m.type === "tonal")) m.pan = x; }, { regen: false }) }),
  );

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
  panelMain.append(row, sourceRow);

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
