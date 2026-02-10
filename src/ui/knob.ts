// src/ui/knob.ts
import { clamp } from "../patch";

type KnobOpts = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
};

function quantize(v: number, step?: number) {
  if (!step || step <= 0) return v;
  return Math.round(v / step) * step;
}

export function knob(opts: KnobOpts) {
  const wrap = document.createElement("div");
  wrap.className = "ctl knobCtl";

  const lab = document.createElement("label");
  lab.textContent = opts.label;

  const k = document.createElement("div");
  k.className = "knob";
  k.tabIndex = 0;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("width", "48");
  svg.setAttribute("height", "48");

  const bg = document.createElementNS(svgNS, "circle");
  bg.setAttribute("cx", "32");
  bg.setAttribute("cy", "32");
  bg.setAttribute("r", "22");
  bg.setAttribute("class", "knobBg");

  // ring arc (progress)
  const arc = document.createElementNS(svgNS, "path");
  arc.setAttribute("class", "knobArc");

  // indicator needle
  const needle = document.createElementNS(svgNS, "line");
  needle.setAttribute("x1", "32");
  needle.setAttribute("y1", "32");
  needle.setAttribute("x2", "32");
  needle.setAttribute("y2", "12");
  needle.setAttribute("class", "knobNeedle");

  // end dot
  const dot = document.createElementNS(svgNS, "circle");
  dot.setAttribute("cx", "32");
  dot.setAttribute("cy", "12");
  dot.setAttribute("r", "2.6");
  dot.setAttribute("class", "knobDot");

  // center cap
  const cap = document.createElementNS(svgNS, "circle");
  cap.setAttribute("cx", "32");
  cap.setAttribute("cy", "32");
  cap.setAttribute("r", "3.2");
  cap.setAttribute("class", "knobCap");

  svg.append(bg, arc, needle, dot, cap);

  const valEl = document.createElement("div");
  valEl.className = "knobVal";

  // usable sweep: -135° .. +135° (270°)
  const A0 = (-135 * Math.PI) / 180;
  const A1 = (135 * Math.PI) / 180;

  const fmt = opts.format ?? ((v) => String(v));
  let value = clamp(opts.value, opts.min, opts.max);

  function setValue(v: number, emit = true) {
    v = clamp(v, opts.min, opts.max);
    v = quantize(v, opts.step);
    value = v;
    valEl.textContent = fmt(value);
    draw();
    if (emit) opts.onChange(value);
  }

  function arcPath(a0: number, a1: number) {
    const r = 22;
    const cx = 32;
    const cy = 32;

    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);

    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;

    return `M ${x0.toFixed(3)} ${y0.toFixed(3)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(
      3
    )} ${y1.toFixed(3)}`;
  }

  function draw() {
    const t = (value - opts.min) / (opts.max - opts.min);
    const ang = A0 + (A1 - A0) * clamp(t, 0, 1);

    arc.setAttribute("d", arcPath(A0, ang));

    const deg = (ang * 180) / Math.PI;
    needle.setAttribute("transform", `rotate(${deg} 32 32)`);
    dot.setAttribute("transform", `rotate(${deg} 32 32)`);
  }

  // --- interaction ---
  let dragging = false;
  let startY = 0;
  let startVal = 0;

  function beginDrag(clientY: number) {
    dragging = true;
    startY = clientY;
    startVal = value;
    k.classList.add("drag");
  }

  function dragTo(clientY: number) {
    if (!dragging) return;
    const dy = startY - clientY; // up = positive
    const range = opts.max - opts.min;
    const delta = (dy / 220) * range; // a bit more sensitive
    setValue(startVal + delta, true);
  }

  function endDrag() {
    dragging = false;
    k.classList.remove("drag");
  }

  k.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    beginDrag(e.clientY);
  });

  k.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    e.preventDefault();
    dragTo(e.clientY);
  });

  k.addEventListener("pointerup", (e) => {
    e.preventDefault();
    endDrag();
  });

  k.addEventListener("pointercancel", () => endDrag());

  function promptValue() {
    const s = prompt(`${opts.label} [${opts.min}..${opts.max}]`, String(value));
    if (s == null) return;
    const n = Number(s);
    if (!Number.isFinite(n)) return;
    setValue(n, true);
  }

  k.addEventListener("dblclick", (e) => {
    e.preventDefault();
    promptValue();
  });

  k.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    promptValue();
  });

  k.addEventListener("keydown", (e) => {
    const step = opts.step ?? (opts.max - opts.min) / 200;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      setValue(value + step, true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      setValue(value - step, true);
    } else if (e.key === "Enter") {
      e.preventDefault();
      promptValue();
    }
  });

  k.append(svg);
  wrap.append(lab, k, valEl);

  setValue(value, false);

  return {
    el: wrap,
    set: (v: number) => setValue(v, false),
    get: () => value,
  };
}
