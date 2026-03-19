// src/ui/ctl.ts
import { knob } from "./knob";
import { prefersSliders } from "./env";
import { bindFloatingPanelReposition, placeFloatingPanel } from "./floatingPanel";
import { createCompactSelectField } from "./routingVisibility";

export type CtlFloatOpts = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (x: number) => void;

  format?: (x: number) => string;
  center?: number;
  clamp?: boolean;
  integer?: boolean;
  unit?: string;
  modulation?: {
    label?: string;
    options: Array<{ value: string; label: string }>;
    selected?: string;
    onChange: (value: string | null) => void;
  };
};

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function defaultFormat(x: number, step: number) {
  if (!Number.isFinite(x)) return "";
  if (step >= 1) return String(Math.round(x));
  return x.toFixed(3);
}

function commitNormalized(raw: number, o: CtlFloatOpts, normalize: (x: number) => number, syncDisplay: (x: number) => void) {
  const next = normalize(raw);
  syncDisplay(next);
  o.onChange(next);
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

  let currentValue = normalize(o.value);
  const setCurrentValue = (x: number) => {
    currentValue = normalize(x);
    if (valueBtn) valueBtn.textContent = fmt(currentValue);
    if (numberInput) numberInput.value = String(currentValue);
  };

  let editorOpen = false;
  let editorCleanup: (() => void) | null = null;
  let repositionCleanup: { destroy: () => void; update: () => void } | null = null;
  let valueBtn: HTMLButtonElement | null = null;
  let numberInput: HTMLInputElement | null = null;
  let lastAnchorEl: HTMLElement | null = null;

  const editor = document.createElement("div");
  editor.className = "floatingPanel ctlEditor hidden";
  editor.setAttribute("role", "dialog");
  editor.setAttribute("aria-modal", "false");

  const editorHead = document.createElement("div");
  editorHead.className = "ctlEditorHead";
  const editorLabel = document.createElement("div");
  editorLabel.className = "ctlEditorTitle";
  editorLabel.textContent = o.label;
  const editorHint = document.createElement("div");
  editorHint.className = "ctlEditorHint small";
  editorHint.textContent = "Direct play on the control · precise edit here";
  editorHead.append(editorLabel, editorHint);

  const valueField = document.createElement("label");
  valueField.className = "ctlEditorField";
  const valueFieldLabel = document.createElement("span");
  valueFieldLabel.className = "compactSelectLabel";
  valueFieldLabel.textContent = "Value";
  numberInput = document.createElement("input");
  numberInput.type = "number";
  numberInput.className = "ctlEditorNumber";
  numberInput.min = String(o.min);
  numberInput.max = String(o.max);
  numberInput.step = String(o.step);
  numberInput.value = String(currentValue);
  valueField.append(valueFieldLabel, numberInput);

  const commitFromInput = () => {
    const parsed = Number.parseFloat(numberInput?.value ?? "");
    if (!Number.isFinite(parsed)) {
      setCurrentValue(currentValue);
      return;
    }
    commitNormalized(parsed, o, normalize, setCurrentValue);
  };

  numberInput.addEventListener("input", () => commitFromInput());
  numberInput.addEventListener("change", () => commitFromInput());
  numberInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitFromInput();
      closeEditor({ restoreFocus: true });
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeEditor({ restoreFocus: true });
    }
  });

  editor.append(editorHead, valueField);

  if (o.modulation) {
    const modulationField = createCompactSelectField({
      label: o.modulation.label ?? "Control assign",
      options: o.modulation.options,
      selected: o.modulation.selected,
      emptyLabel: "None",
      className: "ctlEditorSelectField",
      onChange: (value) => o.modulation?.onChange(value),
    });
    editor.appendChild(modulationField.wrap);
  }

  const onDocPointerDown = (e: Event) => {
    const target = e.target as Node | null;
    if (!target) return;
    if (editor.contains(target) || lastAnchorEl?.contains(target)) return;
    closeEditor();
  };

  const onDocFocusIn = (e: Event) => {
    const target = e.target as Node | null;
    if (!target) return;
    if (editor.contains(target) || lastAnchorEl?.contains(target)) return;
    closeEditor();
  };

  function closeEditor(opts?: { restoreFocus?: boolean }) {
    if (!editorOpen) return;
    editorOpen = false;
    editor.classList.add("hidden");
    editor.remove();
    editorCleanup?.();
    editorCleanup = null;
    repositionCleanup?.destroy();
    repositionCleanup = null;
    document.removeEventListener("pointerdown", onDocPointerDown, true);
    document.removeEventListener("focusin", onDocFocusIn, true);
    document.removeEventListener("keydown", onEscapeKey, true);
    lastAnchorEl?.classList.remove("ctlEditorOpen");
    if (opts?.restoreFocus) lastAnchorEl?.focus();
  }

  function onEscapeKey(e: KeyboardEvent) {
    if (e.key !== "Escape") return;
    if (!editorOpen) return;
    e.preventDefault();
    e.stopPropagation();
    closeEditor({ restoreFocus: true });
  }

  function openEditor(anchorEl: HTMLElement) {
    if (editorOpen) {
      closeEditor();
      return;
    }

    lastAnchorEl = anchorEl;
    setCurrentValue(currentValue);
    editor.classList.remove("hidden");
    document.body.appendChild(editor);
    placeFloatingPanel(editor, anchorEl.getBoundingClientRect(), {
      preferredSide: "bottom",
      align: "center",
      offset: 10,
      minWidth: 188,
      maxWidth: 250,
    });
    repositionCleanup = bindFloatingPanelReposition(editor, () => lastAnchorEl?.isConnected ? lastAnchorEl.getBoundingClientRect() : null, {
      preferredSide: "bottom",
      align: "center",
      offset: 10,
      minWidth: 188,
      maxWidth: 250,
    });
    editorOpen = true;
    lastAnchorEl.classList.add("ctlEditorOpen");
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("focusin", onDocFocusIn, true);
    document.addEventListener("keydown", onEscapeKey, true);
    queueMicrotask(() => numberInput?.focus());
    editorCleanup = () => {};
  }

  if (!prefersSliders()) {
    const k = knob({
      label: o.label,
      value: currentValue,
      min: o.min,
      max: o.max,
      step: o.step,
      format: (x) => fmt(x),
      onChange: (x) => {
        currentValue = normalize(x);
        o.onChange(currentValue);
        if (numberInput) numberInput.value = String(currentValue);
      },
      onRequestEditor: () => openEditor(k.knobEl),
      center: o.center,
    });
    valueBtn = k.valueEl;
    return k.el;
  }

  const wrap = document.createElement("div");
  wrap.className = "ctl ctlFloat ctlSlider";

  const lab = document.createElement("label");
  lab.className = "ctlLabel";
  lab.textContent = o.label;

  const r = document.createElement("input");
  r.className = "ctlPrimaryHit";
  r.type = "range";
  r.min = String(o.min);
  r.max = String(o.max);
  r.step = String(o.step);
  r.value = String(currentValue);

  valueBtn = document.createElement("button");
  valueBtn.type = "button";
  valueBtn.className = "val ctlValueButton";
  valueBtn.textContent = fmt(currentValue);
  valueBtn.addEventListener("click", () => openEditor(r));

  r.oninput = () => {
    const x = normalize(parseFloat(r.value));
    setCurrentValue(x);
    o.onChange(x);
  };
  r.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !editorOpen) {
      e.preventDefault();
      openEditor(r);
    }
  });

  wrap.append(lab, r, valueBtn);
  return wrap;
}
