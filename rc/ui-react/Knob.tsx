// src/ui/Knob.ts
// Minimal, flat, SVG knob with a clear indicator.
// - supports: continuous or discrete (steps)
// - supports: color accent (CSS var or hex)
// - supports: double click to type value (optional)
// - supports: wheel fine control

export type KnobProps = {
  label?: string;
  value: number;          // normalized 0..1
  onChange: (v01: number) => void;

  // optional mapping for display / typed input
  min?: number;           // default 0
  max?: number;           // default 1
  step?: number;          // for typed value rounding (not the discrete mode)
  format?: (raw: number) => string;

  // discrete mode (e.g., Mode selector)
  steps?: string[];       // if provided => discrete
  index?: number;         // discrete index 0..steps-1
  onIndexChange?: (idx: number) => void;

  size?: number;          // px, default 36
  accent?: string;        // e.g. "var(--c-accent-amp)"
  disabled?: boolean;

  // optional: allow typing exact values
  allowType?: boolean;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function roundToStep(x: number, step = 0.001) {
  const inv = 1 / step;
  return Math.round(x * inv) / inv;
}

export function Knob(props: KnobProps) {
  const {
    label,
    value,
    onChange,
    min = 0,
    max = 1,
    step = 0.001,
    format,
    steps,
    index,
    onIndexChange,
    size = 36,
    accent = "var(--c-accent)",
    disabled,
    allowType = true,
  } = props;

  const isDiscrete = Array.isArray(steps) && steps.length > 1;

  // knob sweep: -135deg..+135deg (270deg)
  const a0 = -135;
  const a1 = 135;

  const v01 = clamp01(value);
  const angle = a0 + (a1 - a0) * v01;

  // pointer geometry
  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - 3;
  const rad = (angle * Math.PI) / 180;

  const px = cx + Math.cos(rad) * (r - 7);
  const py = cy + Math.sin(rad) * (r - 7);

  // dragging
  let dragging = false;

  function setFromPointer(ev: PointerEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const x = ev.clientX - (rect.left + rect.width / 2);
    const y = ev.clientY - (rect.top + rect.height / 2);

    // angle in degrees [-180..180], then map to knob sweep
    let deg = (Math.atan2(y, x) * 180) / Math.PI;
    // rotate so 0deg is up-ish -> align with our sweep
    // we want deg where -135 is min and +135 is max
    // atan2 gives 0 at +x, so shift by +90
    deg = deg + 90;

    // wrap to [-180..180]
    while (deg > 180) deg -= 360;
    while (deg < -180) deg += 360;

    const clamped = Math.max(a0, Math.min(a1, deg));
    const next01 = (clamped - a0) / (a1 - a0);
    onChange(clamp01(next01));
  }

  function onPointerDown(ev: any) {
    if (disabled) return;
    const el = ev.currentTarget as HTMLElement;
    dragging = true;
    el.setPointerCapture(ev.pointerId);
    setFromPointer(ev, el);
  }

  function onPointerMove(ev: any) {
    if (disabled) return;
    if (!dragging) return;
    const el = ev.currentTarget as HTMLElement;
    setFromPointer(ev, el);
  }

  function onPointerUp() {
    dragging = false;
  }

  function onWheel(ev: WheelEvent) {
    if (disabled) return;
    ev.preventDefault();

    if (isDiscrete && steps && onIndexChange) {
      const dir = ev.deltaY > 0 ? 1 : -1;
      const cur = index ?? Math.round(v01 * (steps.length - 1));
      const next = Math.max(0, Math.min(steps.length - 1, cur + dir));
      onIndexChange(next);
      return;
    }

    const fine = ev.shiftKey ? 0.003 : 0.01;
    const dir = ev.deltaY > 0 ? -1 : 1;
    onChange(clamp01(v01 + dir * fine));
  }

  function onDoubleClick() {
    if (!allowType || disabled) return;

    if (isDiscrete && steps && onIndexChange) {
      const cur = index ?? Math.round(v01 * (steps.length - 1));
      const str = prompt(`Mode (0..${steps.length - 1}):`, String(cur));
      if (str == null) return;
      const n = Number(str);
      if (!Number.isFinite(n)) return;
      onIndexChange(Math.max(0, Math.min(steps.length - 1, Math.round(n))));
      return;
    }

    // continuous typed raw
    const raw = min + (max - min) * v01;
    const str = prompt(`Value (${min}..${max}):`, String(raw));
    if (str == null) return;
    const n = Number(str);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(min, Math.min(max, n));
    const next01 = (clamped - min) / (max - min);
    onChange(clamp01(roundToStep(next01, step)));
  }

  // display text
  const display = (() => {
    if (isDiscrete && steps) {
      const cur = index ?? Math.round(v01 * (steps.length - 1));
      return steps[cur] ?? "";
    }
    const raw = min + (max - min) * v01;
    return format ? format(raw) : raw.toFixed(3);
  })();

  return (
    <div className={`knob ${disabled ? "is-disabled" : ""}`}>
      {label ? <div className="knob-label">{label}</div> : null}

      <div
        className="knob-ui"
        style={{ width: size, height: size, ["--knob-accent" as any]: accent }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel as any}
        role="slider"
        aria-label={label ?? "knob"}
        aria-valuenow={isDiscrete ? (index ?? 0) : v01}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* outer ring */}
          <circle className="knob-ring" cx={cx} cy={cy} r={r} />
          {/* value arc */}
          <path className="knob-arc" d={arcPath(cx, cy, r, a0, angle)} />
          {/* pointer */}
          <line className="knob-pointer" x1={cx} y1={cy} x2={px} y2={py} />
          <circle className="knob-cap" cx={cx} cy={cy} r={r * 0.62} />
        </svg>
      </div>

      <div className="knob-val">{display}</div>
    </div>
  );
}

// SVG arc helper
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = 1; // clockwise
  return `M ${p0.x.toFixed(3)} ${p0.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(
    3
  )} 0 ${large} ${sweep} ${p1.x.toFixed(3)} ${p1.y.toFixed(3)}`;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
}
