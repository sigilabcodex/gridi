// src/ui/ctl.ts
import { knob } from "./knob";
import { prefersSliders } from "./env";

export type CtlFloatOpts = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (x: number) => void;

  // UX
  format?: (x: number) => string;
  center?: number;      // si se define, knob/slider se "centra" en este valor (ej. 0 para pan)
  clamp?: boolean;      // default true
  integer?: boolean;    // redondea
  unit?: string;        // opcional, solo para display
};

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function defaultFormat(x: number, step: number) {
  if (!Number.isFinite(x)) return "";
  if (step >= 1) return String(Math.round(x));
  return x.toFixed(3);
}

export function ctlFloat(o: CtlFloatOpts): HTMLElement {
  const doClamp = o.clamp ?? true;

  const normalize = (x: number) => {
    if (doClamp) x = clamp(x, o.min, o.max);
    if (o.integer) x = Math.round(x);
    return x;
  };

  const fmt = (x: number) => {
    const s = o.format ? o.format(x) : defaultFormat(x, o.step);
    return o.unit ? `${s}${o.unit}` : s;
  };

  // --- DESKTOP: knob
  if (!prefersSliders()) {
    const k = knob({
      label: o.label,
      value: o.value,
      min: o.min,
      max: o.max,
      step: o.step,
      format: (x) => fmt(x),
      onChange: (x) => o.onChange(normalize(x)),
      center: o.center,
    });
    return k.el;
  }

  // --- MOBILE: slider
  const wrap = document.createElement("div");
  wrap.className = "ctl";

  const lab = document.createElement("label");
  lab.textContent = o.label;

  const r = document.createElement("input");
  r.type = "range";
  r.min = String(o.min);
  r.max = String(o.max);
  r.step = String(o.step);
  r.value = String(o.value);

  const val = document.createElement("div");
  val.className = "val";
  val.textContent = fmt(o.value);

  r.oninput = () => {
    const x = normalize(parseFloat(r.value));
    val.textContent = fmt(x);
    o.onChange(x);
  };

  wrap.append(lab, r, val);
  return wrap;
}
