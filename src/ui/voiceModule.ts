// src/ui/voiceModule.ts
import type { Patch, Mode } from "../patch";
import { clamp } from "../patch";

const MODES: Mode[] = ["hybrid", "step", "euclid", "ca", "fractal"];

export function renderVoiceModule(
  root: HTMLElement,
  patch: Patch,
  i: number,
  getLedState: (i: number) => { active: boolean; hit: boolean },
  onPatchChange: (fn: (p: Patch) => void) => void
) {
  const v = patch.voices[i];

  const card = document.createElement("div");
  card.className = "card";

  // ---- header / title row ----
  const header = document.createElement("div");
  header.className = "cardHeader";

  const titleRow = document.createElement("div");
  titleRow.className = "titleRow";

  const ledA = document.createElement("div");
  ledA.className = "led";

  const ledHit = document.createElement("div");
  ledHit.className = "led";

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = v?.name ?? `V${i + 1}`;

  titleRow.append(ledA, ledHit, name);

  const toggle = document.createElement("button");
  toggle.textContent = v?.enabled ? "On" : "Off";
  toggle.className = v?.enabled ? "primary" : "";
  toggle.onclick = () => {
    onPatchChange((p) => {
      p.voices[i].enabled = !p.voices[i].enabled;
    });
  };

  header.append(titleRow, toggle);

  // ---- controls row ----
  const row = document.createElement("div");
  row.className = "row";

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
    onPatchChange((p) => {
      p.voices[i].mode = sel.value as Mode;
    });
  row.appendChild(sel);

  // Seed
  row.append(labelEl("Seed"));
  const seed = numBox(v.seed, 0, 999999);
  seed.onchange = () =>
    onPatchChange((p) => {
      p.voices[i].seed = seed.valueAsNumber | 0;
    });
  row.append(seed);

  // Amp
  row.append(labelEl("Amp"));
  row.append(
    range(v.amp, 0, 0.6, 0.001, (x) =>
      onPatchChange((p) => {
        p.voices[i].amp = x;
      })
    )
  );

  // Timbre
  row.append(labelEl("Timbre"));
  row.append(
    range(v.timbre, 0, 1, 0.001, (x) =>
      onPatchChange((p) => {
        p.voices[i].timbre = x;
      })
    )
  );

  card.append(header, row);
  root.appendChild(card);

  // ---- LED updater (called from UI loop) ----
  return () => {
    const st = getLedState(i);
    ledA.className = "led" + (st.active ? " on" : "");
    ledHit.className = "led" + (st.hit ? " on hit" : "");
  };
}

function labelEl(t: string) {
  const l = document.createElement("label");
  l.textContent = t;
  return l;
}

function range(
  value: number,
  min: number,
  max: number,
  step: number,
  on: (v: number) => void
) {
  const r = document.createElement("input");
  r.type = "range";
  r.min = String(min);
  r.max = String(max);
  r.step = String(step);

  // importante: evita NaN si value viene mal por algún bug upstream
  const safe = Number.isFinite(value) ? value : min;
  r.value = String(clamp(safe, min, max));

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
