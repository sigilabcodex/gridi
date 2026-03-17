import type { ControlKind, LfoWaveform, Patch, ControlModule } from "../patch";
import { sampleControl01 } from "../engine/control";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";

const KINDS: ControlKind[] = ["lfo", "drift", "stepped"];
const WAVES: LfoWaveform[] = ["sine", "triangle", "square", "random"];

export function renderControlSurface(
  root: HTMLElement,
  mod: ControlModule,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  onRemove?: () => void,
) {
  const surface = document.createElement("section");
  surface.className = "moduleSurface controlSurface";
  surface.dataset.type = "control";

  const header = document.createElement("div");
  header.className = "surfaceHeader";
  const idWrap = document.createElement("div");
  idWrap.className = "surfaceIdentity";
  const badge = document.createElement("div");
  badge.className = "surfaceBadge";
  badge.textContent = "CONTROL";
  const meta = document.createElement("div");
  meta.className = "surfaceNameWrap";
  meta.innerHTML = `<div class="name">${mod.name}</div><div class="small">Preset: ${mod.presetName ?? "Sine LFO"}</div>`;
  idWrap.append(badge, meta);

  const right = document.createElement("div");
  right.className = "rightControls";
  const toggle = document.createElement("button");
  const syncToggle = () => {
    toggle.textContent = mod.enabled ? "On" : "Off";
    toggle.className = mod.enabled ? "primary" : "";
  };
  syncToggle();
  toggle.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === mod.id);
    if (m?.type === "control") m.enabled = !m.enabled;
  }, { regen: false });

  const btnX = document.createElement("button");
  btnX.className = "danger";
  btnX.textContent = "×";
  wireSafeDeleteButton(btnX, () => onRemove?.());
  right.append(toggle, btnX);
  header.append(idWrap, right);

  const face = document.createElement("div");
  face.className = "surfaceFace";
  const panel = document.createElement("div");
  panel.className = "surfaceTabPanel controlBody";

  const kindSel = document.createElement("select");
  for (const kind of KINDS) {
    const o = document.createElement("option");
    o.value = kind;
    o.textContent = kind.toUpperCase();
    if (kind === mod.kind) o.selected = true;
    kindSel.appendChild(o);
  }
  kindSel.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === mod.id);
    if (m?.type === "control") m.kind = kindSel.value as ControlKind;
  }, { regen: false });

  const waveSel = document.createElement("select");
  for (const wave of WAVES) {
    const o = document.createElement("option");
    o.value = wave;
    o.textContent = wave;
    if (wave === mod.waveform) o.selected = true;
    waveSel.appendChild(o);
  }
  waveSel.onchange = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === mod.id);
    if (m?.type === "control") m.waveform = waveSel.value as LfoWaveform;
  }, { regen: false });

  const typeRow = document.createElement("div");
  typeRow.className = "controlTypeRow";
  typeRow.append(kindSel, waveSel);

  const meter = document.createElement("div");
  meter.className = "controlMeter";
  const meterFill = document.createElement("div");
  meterFill.className = "controlMeterFill";
  meter.appendChild(meterFill);

  panel.append(
    typeRow,
    ctlFloat({ label: "Speed", value: mod.speed, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.speed = x;
    }, { regen: false }) }),
    ctlFloat({ label: "Amount", value: mod.amount, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.amount = x;
    }, { regen: false }) }),
    ctlFloat({ label: "Phase", value: mod.phase, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.phase = x;
    }, { regen: false }) }),
    ctlFloat({ label: "Rate", value: mod.rate, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.rate = x;
    }, { regen: false }) }),
    ctlFloat({ label: "Random", value: mod.randomness, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.randomness = x;
    }, { regen: false }) }),
    meter,
  );

  face.append(panel);
  surface.append(header, face);
  root.appendChild(surface);

  return () => {
    syncToggle();
    const val = sampleControl01(mod, performance.now() / 1000);
    meterFill.style.width = `${Math.round(val * 100)}%`;
    waveSel.disabled = mod.kind !== "lfo";
  };
}
