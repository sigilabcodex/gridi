// src/ui/knob.ts
export type KnobOpts = {
  min: number;
  max: number;
  value: number;
  step?: number;
  label?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;

  /**
   * If provided, value==center maps to the middle of the travel (12 o'clock).
   * Example: min=-1 max=1 center=0 -> 0 is exactly centered.
   */
  center?: number;
};

export function knob(
  opts: KnobOpts
): { el: HTMLElement; setValue: (v: number, emit?: boolean) => void; getValue: () => number } {
  const wrap = document.createElement("div");
  wrap.className = "knobCtl";

  if (opts.label) {
    const lab = document.createElement("label");
    lab.textContent = opts.label;
    wrap.appendChild(lab);
  }

  const knobEl = document.createElement("div");
  knobEl.className = "knob";
  knobEl.tabIndex = 0;

  const valEl = document.createElement("div");
  valEl.className = "knobVal";

  wrap.append(knobEl, valEl);

  const size = 54;
  const r = 20;
  const cx = 27,
    cy = 27;
const startA = (-225 * Math.PI) / 180;
const endA   = (  45 * Math.PI) / 180;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 54 54");

  const bg = document.createElementNS(svgNS, "circle");
  bg.setAttribute("class", "knobBg");
  bg.setAttribute("cx", String(cx));
  bg.setAttribute("cy", String(cy));
  bg.setAttribute("r", String(r));

  const arc = document.createElementNS(svgNS, "path");
  arc.setAttribute("class", "knobArc");

  const needle = document.createElementNS(svgNS, "line");
  needle.setAttribute("class", "knobNeedle");
  needle.setAttribute("x1", String(cx));
  needle.setAttribute("y1", String(cy));
  needle.setAttribute("x2", String(cx));
  needle.setAttribute("y2", String(cy - r + 5));

  const cap = document.createElementNS(svgNS, "circle");
  cap.setAttribute("class", "knobCap");
  cap.setAttribute("cx", String(cx));
  cap.setAttribute("cy", String(cy));
  cap.setAttribute("r", "7.5");

  const dot = document.createElementNS(svgNS, "circle");
  dot.setAttribute("class", "knobDot");
  dot.setAttribute("cx", String(cx));
  dot.setAttribute("cy", String(cy));
  dot.setAttribute("r", "2.2");

  svg.append(bg, arc, needle, cap, dot);
  knobEl.appendChild(svg);

  const clamp = (v: number) => Math.min(opts.max, Math.max(opts.min, v));
  const step = opts.step ?? 0;

  const quant = (v: number) => {
    if (!step) return v;
    return Math.round(v / step) * step;
  };

  const polarToXY = (a: number) => ({
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  });

  const arcPath = (a0: number, a1: number) => {
    const p0 = polarToXY(a0);
    const p1 = polarToXY(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };

  // value -> normalized t in [0..1]
  const valueToT = (v: number) => {
    const min = opts.min;
    const max = opts.max;
    const c = opts.center;

    if (c === undefined) return (v - min) / (max - min || 1);

    // avoid weird division if center equals bounds
    if (c <= min || c >= max) return (v - min) / (max - min || 1);

    if (v <= c) {
      const a = (v - min) / (c - min); // 0..1
      return 0.5 * a; // 0..0.5
    } else {
      const b = (v - c) / (max - c); // 0..1
      return 0.5 + 0.5 * b; // 0.5..1
    }
  };

  let value = clamp(opts.value);

  const render = () => {
    const t = valueToT(value);
    const a = startA + (endA - startA) * t;

    arc.setAttribute("d", arcPath(startA, a));

    const nx = cx + (r - 6) * Math.cos(a);
    const ny = cy + (r - 6) * Math.sin(a);
    needle.setAttribute("x2", String(nx));
    needle.setAttribute("y2", String(ny));

    valEl.textContent = opts.format ? opts.format(value) : value.toFixed(3);
  };

  const setValue = (v: number, emit = true) => {
    value = clamp(quant(v));
    render();
    if (emit) opts.onChange(value);
  };

  const getValue = () => value;

  // pointer drag
  let dragging = false;
  let startY = 0;
  let startV = value;

  knobEl.addEventListener("pointerdown", (e) => {
    dragging = true;
    knobEl.classList.add("drag");
    knobEl.setPointerCapture(e.pointerId);
    startY = e.clientY;
    startV = value;
    e.preventDefault();
  });

  knobEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dy = startY - e.clientY;
    const range = opts.max - opts.min;
    const fine = e.shiftKey ? 0.25 : 1;
    const delta = (dy / 120) * range * 0.35 * fine;
    setValue(startV + delta, true);
  });

  const stopDrag = () => {
    dragging = false;
    knobEl.classList.remove("drag");
  };
  knobEl.addEventListener("pointerup", stopDrag);
  knobEl.addEventListener("pointercancel", stopDrag);

  // wheel
  knobEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const dir = Math.sign(e.deltaY || 0);
      if (!dir) return;

      const range = opts.max - opts.min;
      const base = step || range / 200;
      const fine = e.shiftKey ? 0.25 : 1;
      const delta = -dir * base * 4 * fine;
      setValue(value + delta, true);
    },
    { passive: false }
  );

  // keyboard
  knobEl.addEventListener("keydown", (e) => {
    const range = opts.max - opts.min;
    const base = step || range / 200;
    const fine = e.shiftKey ? 0.25 : 1;

    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      setValue(value + base * fine, true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      setValue(value - base * fine, true);
    }
  });

  setValue(value, false);
  return { el: wrap, setValue, getValue };
}
