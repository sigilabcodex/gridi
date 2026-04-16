// src/ui/ctl.ts
import { knob } from "./knob";
import { prefersMobileParameterEditor, prefersSliders } from "./env";
import { bindFloatingPanelReposition, placeFloatingPanel } from "./floatingPanel";
import { createCompactSelectField } from "./routingVisibility";
import type { TooltipBinder } from "./tooltip";

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
  tooltip?: string;
  attachTooltip?: TooltipBinder;
  modulation?: {
    label?: string;
    options: Array<{ value: string; label: string }>;
    selected?: string;
    attachTooltip?: TooltipBinder;
    onChange: (value: string | null) => void;
  };
};

export type CtlFloatElement = HTMLElement & {
  syncValue?: (x: number) => void;
};

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

function defaultFormat(x: number, step: number) {
  if (!Number.isFinite(x)) return "";
  if (step >= 1) return String(Math.round(x));
  return x.toFixed(3);
}

export function ctlFloat(o: CtlFloatOpts): CtlFloatElement {
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
  let editorOpen = false;
  let repositionCleanup: { destroy: () => void } | null = null;
  let valueBtn: HTMLButtonElement | null = null;
  let numberInput: HTMLInputElement | null = null;
  let anchorScopeEl: HTMLElement | null = null;
  let focusRestoreEl: HTMLElement | null = null;
  let syncControlVisual: (x: number) => void = () => {};
  let inputGestureActive = false;
  const useMobileParameterEditor = prefersMobileParameterEditor();
  let sliderInput: HTMLInputElement | null = null;

  const emitHistoryGesture = (phase: "start" | "end") => {
    (anchorScopeEl ?? valueBtn)?.dispatchEvent(new CustomEvent(`gridi-history-gesture-${phase}`, { bubbles: true }));
  };

  const startInputGesture = () => {
    if (inputGestureActive) return;
    inputGestureActive = true;
    emitHistoryGesture("start");
  };

  const endInputGesture = () => {
    if (!inputGestureActive) return;
    inputGestureActive = false;
    emitHistoryGesture("end");
  };

  const syncReadout = (x: number) => {
    currentValue = normalize(x);
    if (valueBtn) valueBtn.textContent = fmt(currentValue);
    if (numberInput && document.activeElement !== numberInput) numberInput.value = String(currentValue);
    if (sliderInput && document.activeElement !== sliderInput) sliderInput.value = String(currentValue);
  };

  const applyValue = (x: number, opts?: { emit?: boolean; syncControl?: boolean }) => {
    const next = normalize(x);
    syncReadout(next);
    if (opts?.syncControl ?? true) syncControlVisual(next);
    if (opts?.emit) o.onChange(next);
  };

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

  const sliderField = document.createElement("label");
  sliderField.className = "ctlEditorField ctlEditorSliderField";
  const sliderFieldLabel = document.createElement("span");
  sliderFieldLabel.className = "compactSelectLabel";
  sliderFieldLabel.textContent = "Adjust";
  sliderInput = document.createElement("input");
  sliderInput.type = "range";
  sliderInput.className = "ctlEditorSlider";
  sliderInput.min = String(o.min);
  sliderInput.max = String(o.max);
  sliderInput.step = String(o.step);
  sliderInput.value = String(currentValue);
  sliderInput.setAttribute("aria-label", `${o.label} adjustment slider`);
  sliderField.append(sliderFieldLabel, sliderInput);

  const commitFromInput = () => {
    const parsed = Number.parseFloat(numberInput?.value ?? "");
    if (!Number.isFinite(parsed)) {
      syncReadout(currentValue);
      return;
    }
    applyValue(parsed, { emit: true, syncControl: true });
  };

  numberInput.addEventListener("change", commitFromInput);
  numberInput.addEventListener("focus", startInputGesture);
  numberInput.addEventListener("blur", () => {
    commitFromInput();
    endInputGesture();
  });
  numberInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitFromInput();
      endInputGesture();
      closeEditor({ restoreFocus: true });
    }
    if (e.key === "Escape") {
      e.preventDefault();
      syncReadout(currentValue);
      endInputGesture();
      closeEditor({ restoreFocus: true });
    }
  });

  sliderInput.addEventListener("input", () => {
    const parsed = Number.parseFloat(sliderInput?.value ?? "");
    if (!Number.isFinite(parsed)) return;
    startInputGesture();
    applyValue(parsed, { emit: true, syncControl: true });
  });
  sliderInput.addEventListener("pointerdown", startInputGesture);
  sliderInput.addEventListener("pointerup", endInputGesture);
  sliderInput.addEventListener("pointercancel", endInputGesture);
  sliderInput.addEventListener("blur", endInputGesture);

  editor.append(editorHead, sliderField, valueField);

  if (o.modulation) {
    const modulationField = createCompactSelectField({
      label: o.modulation.label ?? "Control assign",
      options: o.modulation.options,
      selected: o.modulation.selected,
      emptyLabel: "None",
      className: "ctlEditorSelectField",
      attachTooltip: o.modulation.attachTooltip,
      tooltip: `Choose a modulation source for ${o.label}.`,
      onChange: (value) => o.modulation?.onChange(value),
    });
    editor.appendChild(modulationField.wrap);
  }

  const onDocPointerDown = (e: Event) => {
    const target = e.target as Node | null;
    if (!target) return;
    if (editor.contains(target) || anchorScopeEl?.contains(target)) return;
    closeEditor();
  };

  const onDocFocusIn = (e: Event) => {
    const target = e.target as Node | null;
    if (!target) return;
    if (editor.contains(target) || anchorScopeEl?.contains(target)) return;
    closeEditor();
  };

  function closeEditor(opts?: { restoreFocus?: boolean }) {
    if (!editorOpen) return;
    endInputGesture();
    editorOpen = false;
    editor.classList.add("hidden");
    editor.remove();
    repositionCleanup?.destroy();
    repositionCleanup = null;
    document.removeEventListener("pointerdown", onDocPointerDown, true);
    document.removeEventListener("focusin", onDocFocusIn, true);
    document.removeEventListener("keydown", onEscapeKey, true);
    anchorScopeEl?.classList.remove("ctlEditorOpen");
    if (opts?.restoreFocus) focusRestoreEl?.focus();
  }

  function onEscapeKey(e: KeyboardEvent) {
    if (e.key !== "Escape" || !editorOpen) return;
    e.preventDefault();
    e.stopPropagation();
    closeEditor({ restoreFocus: true });
  }

  function openEditor(anchorEl: HTMLElement) {
    const scopeEl = anchorEl.closest<HTMLElement>(".ctlFloat") ?? anchorEl;
    if (editorOpen && anchorScopeEl === scopeEl) {
      closeEditor({ restoreFocus: true });
      return;
    }
    if (editorOpen) closeEditor();

    focusRestoreEl = anchorEl;
    anchorScopeEl = scopeEl;
    syncReadout(currentValue);
    editor.classList.remove("hidden");
    document.body.appendChild(editor);
    placeFloatingPanel(editor, scopeEl.getBoundingClientRect(), {
      preferredSide: "bottom",
      align: "center",
      offset: 10,
      minWidth: 188,
      maxWidth: 250,
    });
    repositionCleanup = bindFloatingPanelReposition(editor, () => anchorScopeEl?.isConnected ? anchorScopeEl.getBoundingClientRect() : null, {
      preferredSide: "bottom",
      align: "center",
      offset: 10,
      minWidth: 188,
      maxWidth: 250,
    });
    editorOpen = true;
    anchorScopeEl.classList.add("ctlEditorOpen");
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("focusin", onDocFocusIn, true);
    document.addEventListener("keydown", onEscapeKey, true);
    queueMicrotask(() => numberInput?.focus());
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
        applyValue(x, { syncControl: false });
        o.onChange(normalize(x));
      },
      onRequestEditor: () => openEditor(k.knobEl),
      tapOpensEditor: useMobileParameterEditor,
      center: o.center,
    });
    if (o.tooltip && o.attachTooltip) {
      o.attachTooltip(k.knobEl, { text: o.tooltip, ariaLabel: o.label });
      o.attachTooltip(k.valueEl, { text: o.tooltip });
    }
    syncControlVisual = (x) => k.setValue(x, false);
    valueBtn = k.valueEl;
    const knobWrap = k.el as CtlFloatElement;
    knobWrap.syncValue = (x: number) => applyValue(x, { emit: false, syncControl: true });
    return knobWrap;
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
  syncControlVisual = (x) => {
    r.value = String(normalize(x));
  };

  valueBtn = document.createElement("button");
  valueBtn.type = "button";
  valueBtn.className = "val ctlValueButton";
  valueBtn.textContent = fmt(currentValue);
  valueBtn.addEventListener("click", () => openEditor(r));
  if (o.tooltip && o.attachTooltip) {
    o.attachTooltip(r, { text: o.tooltip, ariaLabel: o.label });
    o.attachTooltip(valueBtn, { text: o.tooltip });
  }

  r.oninput = () => {
    const x = normalize(parseFloat(r.value));
    applyValue(x, { syncControl: false });
    o.onChange(x);
  };
  r.addEventListener("pointerdown", () => emitHistoryGesture("start"));
  const endSliderGesture = () => emitHistoryGesture("end");
  r.addEventListener("pointerup", endSliderGesture);
  r.addEventListener("pointercancel", endSliderGesture);
  r.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && !editorOpen) {
      e.preventDefault();
      openEditor(r);
    }
  });

  wrap.append(lab, r, valueBtn);
  const sliderWrap = wrap as CtlFloatElement;
  sliderWrap.syncValue = (x: number) => applyValue(x, { emit: false, syncControl: true });
  return sliderWrap;
}
