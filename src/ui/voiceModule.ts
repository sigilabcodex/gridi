// src/ui/voiceModule.ts
import type { Patch, Mode, VoiceModule } from "../patch";
import { clamp } from "../patch";
import { knob } from "./knob";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

type UiState = {
  advOpen: boolean;
  setAdvOpen: (v: boolean) => void;
};

export function renderVoiceModule(
  root: HTMLElement,
  _patch: Patch,
  v: VoiceModule,
  voiceIndex: number,
  getLedState: (voiceIndex: number) => { active: boolean; hit: boolean },
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  ui: UiState,
  onRemove?: () => void
) {
  const card = document.createElement("section");
  card.className = "card";
  card.dataset.type = "voice";
  card.dataset.kind = v.kind;

  // ---- header
  const header = document.createElement("div");
  header.className = "cardHeader";

  const titleRow = document.createElement("div");
  titleRow.className = "titleRow";

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = v.kind === "drum" ? "DRUM" : "TONAL";

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

  toggle.onclick = () => {
    onPatchChange(
      (p) => {
        const m = p.modules.find((x) => x.id === v.id);
        if (m && m.type === "voice") m.enabled = !m.enabled;
      },
      { regen: false }
    );
  };

  const btnX = document.createElement("button");
  btnX.textContent = "×";
  btnX.className = "danger";
  btnX.title = "Remove module";
  btnX.onclick = () => onRemove?.();

  right.append(toggle, btnX);
  header.append(titleRow, right);

  // ---- compact row
  const row = document.createElement("div");
  row.className = "row compactRow";

  // Mode
  row.append(labelEl("Mode"));
  const sel = document.createElement("select");
  for (const m of MODES) {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = m;
    if (m === v.mode) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = () =>
    onPatchChange(
      (p) => {
        const m = p.modules.find((x) => x.id === v.id);
        if (m && m.type === "voice") m.mode = sel.value as Mode;
      },
      { regen: true }
    );
  row.appendChild(sel);

  // Seed
  row.append(labelEl("Seed"));
  const seed = numBox(v.seed, 0, 999999);
  seed.onchange = () =>
    onPatchChange(
      (p) => {
        const m = p.modules.find((x) => x.id === v.id);
        if (m && m.type === "voice") m.seed = seed.valueAsNumber | 0;
      },
      { regen: true }
    );
  row.append(seed);

  // Amp knob
  const kAmp = knob({
    label: "Amp",
    value: v.amp,
    min: 0,
    max: 1,
    step: 0.001,
    format: (x) => x.toFixed(3),
    onChange: (x) =>
      onPatchChange(
        (p) => {
          const m = p.modules.find((z) => z.id === v.id);
          if (m && m.type === "voice") m.amp = x;
        },
        { regen: false }
      ),
  });
  row.append(kAmp.el);

  // Timbre knob
  const kT = knob({
    label: "Timbre",
    value: v.timbre,
    min: 0,
    max: 1,
    step: 0.001,
    format: (x) => x.toFixed(3),
    onChange: (x) =>
      onPatchChange(
        (p) => {
          const m = p.modules.find((z) => z.id === v.id);
          if (m && m.type === "voice") m.timbre = x;
        },
        { regen: false }
      ),
  });
  row.append(kT.el);

  // bottom mini row (Advanced)
  const bottom = document.createElement("div");
  bottom.className = "miniRow";

  const btnAdv = document.createElement("button");
  const syncAdv = () => (btnAdv.textContent = ui.advOpen ? "Advanced ▾" : "Advanced ▸");
  syncAdv();
  btnAdv.onclick = () => ui.setAdvOpen(!ui.advOpen);

  bottom.append(btnAdv);

  card.append(header, row, bottom);

  // ---- advanced panel
  if (ui.advOpen) {
    const adv = document.createElement("div");
    adv.className = "adv";

    adv.append(
      ctlRange("Subdiv", v.subdiv, 1, 8, 1, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.subdiv = (Math.max(1, Math.min(8, Math.round(x))) as any);
          },
          { regen: false }
        )
      ),
      ctlRange("Length", v.length, 1, 128, 1, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.length = Math.max(1, Math.min(128, Math.round(x)));
          },
          { regen: true }
        )
      ),
      ctlRange("Density", v.density, 0, 1, 0.001, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.density = x;
          },
          { regen: true }
        )
      ),
      ctlRange("Drop", v.drop, 0, 1, 0.001, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.drop = x;
          },
          { regen: true }
        )
      ),
      ctlRange("Det", v.determinism, 0, 1, 0.001, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.determinism = x;
          },
          { regen: true }
        )
      ),
      ctlRange("Grav", v.gravity, 0, 1, 0.001, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.gravity = x;
          },
          { regen: true }
        )
      ),
      ctlRange("Weird", v.weird, 0, 1, 0.001, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.weird = x;
          },
          { regen: true }
        )
      ),
      ctlRange("Pan", v.pan, -1, 1, 0.001, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.pan = x;
          },
          { regen: false }
        )
      ),
      ctlRange("Rot", v.euclidRot, -32, 32, 1, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.euclidRot = Math.round(x);
          },
          { regen: true }
        )
      ),
      ctlRange("CA Rule", v.caRule, 0, 255, 1, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.caRule = Math.max(0, Math.min(255, Math.round(x)));
          },
          { regen: true }
        )
      ),
      ctlRange("CA Init", v.caInit, 0, 1, 0.001, (x) =>
        onPatchChange(
          (p) => {
            const m = p.modules.find((z) => z.id === v.id);
            if (m && m.type === "voice") m.caInit = x;
          },
          { regen: true }
        )
      )
    );

    card.appendChild(adv);
  }

  root.appendChild(card);

  return () => {
    const st = getLedState(voiceIndex);
    ledA.className = "led" + (st.active ? " on" : "");
    ledHit.className = "led" + (st.hit ? " on hit" : "");
    syncToggle();
    syncAdv();
  };
}

function labelEl(t: string) {
  const l = document.createElement("label");
  l.textContent = t;
  return l;
}

function rangeInput(value: number, min: number, max: number, step: number, on: (v: number) => void) {
  const r = document.createElement("input");
  r.type = "range";
  r.min = String(min);
  r.max = String(max);
  r.step = String(step);
  r.value = String(clamp(value, min, max));
  r.oninput = () => on(parseFloat(r.value));
  return r;
}

function numBox(value: number, min: number, max: number) {
  const n = document.createElement("input");
  n.type = "number";
  n.value = String(value);
  n.min = String(min);
  n.max = String(max);
  return n;
}

function ctlRange(title: string, value: number, min: number, max: number, step: number, on: (v: number) => void) {
  const wrap = document.createElement("div");
  wrap.className = "ctl";

  const lab = document.createElement("label");
  lab.textContent = title;

  const r = rangeInput(value, min, max, step, on);

  const val = document.createElement("div");
  val.className = "val";
  val.textContent = Number.isFinite(value) ? String(value) : "";

  r.oninput = () => {
    const v = parseFloat(r.value);
    val.textContent = step < 1 ? v.toFixed(3) : String(Math.round(v));
    on(v);
  };

  wrap.append(lab, r, val);
  return wrap;
}
