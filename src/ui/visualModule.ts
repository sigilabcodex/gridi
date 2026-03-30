import type { Engine } from "../engine/audio";
import type { VisualModule } from "../patch";
import { wireSafeDeleteButton } from "./deleteButton";
import { createModuleIdentityMeta, createModuleTabShell } from "./moduleShell";
import { createModulePresetControl } from "./modulePresetControl";
import type { ModulePresetRecord } from "./persistence/modulePresetStore";
import type { TooltipBinder } from "./tooltip";
import {
  createCompactSelectField,
  createModuleRefChip,
  createRoutingCard,
  createRoutingSummary,
  createRoutingSummaryStrip,
  type RoutingSnapshot,
} from "./routingVisibility";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

export function renderVisualSurface(
  parent: HTMLElement,
  engine: Engine,
  vm: VisualModule,
  routing: RoutingSnapshot,
  onRemove: () => void,
  modulePresetRecords: ModulePresetRecord[] = [],
  onLoadModulePreset?: (moduleId: string, presetId: string) => void,
  onSaveModulePreset?: (moduleId: string, name: string, overwritePresetId?: string | null) => void,
  attachTooltip?: TooltipBinder,
) {
  const surface = el("section", "moduleSurface visualSurface");
  surface.dataset.type = "visual";

  const header = el("div", "surfaceHeader");
  const presetControl = createModulePresetControl({
    module: vm,
    records: modulePresetRecords,
    onLoadPreset: (presetId) => onLoadModulePreset?.(vm.id, presetId),
    onSavePreset: (name, overwritePresetId) => onSaveModulePreset?.(vm.id, name, overwritePresetId),
    attachTooltip,
  });

  const identity = createModuleIdentityMeta({
    badgeText: "VISUAL",
    instanceName: vm.name,
    instanceId: vm.id.slice(-6).toUpperCase(),
    presetButton: presetControl.button,
  });

  const right = el("div", "rightControls");
  const btnOn = el("button");
  const updateOn = () => {
    btnOn.textContent = vm.enabled ? "On" : "Off";
    btnOn.className = vm.enabled ? "primary" : "";
  };
  btnOn.onclick = () => {
    vm.enabled = !vm.enabled;
    updateOn();
  };

  const btnX = el("button", "danger");
  btnX.textContent = "×";
  wireSafeDeleteButton(btnX, onRemove);
  right.append(btnOn, btnX);
  header.append(identity, right);

  const visualSource = routing.visualSources.get(vm.id);

  const panelMain = el("div", "visualSurfaceBody");
  const canvasWrap = el("div", "visualDisplayWrap");
  const canvas = document.createElement("canvas");
  canvas.className = "scope";
  canvas.width = 800;
  canvas.height = 260;
  const readout = el("div", "visualReadout small");
  canvasWrap.append(canvas);
  panelMain.append(canvasWrap, readout);

  const panelRouting = el("div", "utilityPanel");
  const sourceCard = createRoutingCard("Input", visualSource?.sourceLabel ?? "Master mix");
  sourceCard.appendChild(createRoutingSummaryStrip([
    createRoutingSummary("In", visualSource ? [createModuleRefChip({ id: vm.id, name: visualSource.sourceLabel, family: "visual", shortId: "MIX", label: visualSource.sourceLabel })] : [], "Master"),
    createRoutingSummary("Mix", (visualSource?.contributors ?? []).slice(0, 4).map((ref) => createModuleRefChip(ref)), "No voices"),
  ]));
  const contributors = el("div", "routingChipList");
  (visualSource?.contributors ?? []).forEach((ref) => contributors.appendChild(createModuleRefChip(ref)));
  sourceCard.appendChild(contributors);
  panelRouting.appendChild(sourceCard);

  const panelSettings = el("div", "surfaceSettingsPanel");
  const dock = el("div", "visualControlDock");
  const modeField = createCompactSelectField({
    label: "View",
    options: ["scope", "spectrum", "pattern"].map((kind) => ({ value: kind, label: kind.toUpperCase() })),
    selected: vm.kind,
    onChange: (value) => {
      if (value) vm.kind = value as VisualModule["kind"];
    },
  });
  const fftField = createCompactSelectField({
    label: "FFT",
    options: [512, 1024, 2048, 4096].map((size) => ({ value: String(size), label: String(size) })),
    selected: String(vm.fftSize ?? 2048),
    onChange: (value) => {
      if (value) vm.fftSize = Number(value) as VisualModule["fftSize"];
    },
  });
  dock.append(modeField.wrap, fftField.wrap);
  panelSettings.append(dock);

  const shell = createModuleTabShell({
    specs: [
      { id: "MAIN", label: "Main", panel: panelMain },
      { id: "ROUTING", label: "Routing", panel: panelRouting },
      { id: "SETTINGS", label: "Settings", panel: panelSettings },
    ],
    activeTab: "MAIN",
  });

  surface.append(header, shell.face, shell.tabs);
  parent.appendChild(surface);
  updateOn();

  const ctx2d = canvas.getContext("2d")!;
  const scopeBuf = new Float32Array(engine.analyser.fftSize);
  const specBuf = new Float32Array(engine.analyser.frequencyBinCount);

  function resizeIfNeeded() {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = Math.max(2, Math.floor(r.width * dpr));
    const h = Math.max(2, Math.floor(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawGrid() {
    const w = canvas.width;
    const h = canvas.height;
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.lineWidth = 1;
    ctx2d.strokeStyle = "rgba(207,214,221,0.10)";
    for (let i = 1; i < 8; i++) {
      const x = (w * i) / 8;
      ctx2d.beginPath();
      ctx2d.moveTo(x, 0);
      ctx2d.lineTo(x, h);
      ctx2d.stroke();
    }
  }

  function drawScope() {
    engine.getScopeData(scopeBuf);
    const w = canvas.width;
    const h = canvas.height;
    const mid = h * 0.5;
    ctx2d.lineWidth = 2;
    ctx2d.strokeStyle = "rgba(235,240,245,0.95)";
    ctx2d.beginPath();
    for (let i = 0; i < scopeBuf.length; i++) {
      const x = (i / (scopeBuf.length - 1)) * w;
      const y = mid - scopeBuf[i] * (h * 0.42);
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
    const peak = Math.max(...scopeBuf.map((x) => Math.abs(x)));
    readout.textContent = `peak ${peak.toFixed(3)} · ${scopeBuf.length} smp`;
  }

  function drawSpectrum() {
    engine.getSpectrumData(specBuf);
    const w = canvas.width;
    const h = canvas.height;
    const barW = Math.max(1, Math.floor(w / specBuf.length));
    ctx2d.fillStyle = "rgba(74,163,255,0.55)";
    for (let i = 0; i < specBuf.length; i++) {
      const x = i * barW;
      const bh = specBuf[i] * (h * 0.92);
      ctx2d.fillRect(x, h - bh, barW, bh);
    }
    const avg = specBuf.reduce((a, b) => a + b, 0) / Math.max(1, specBuf.length);
    readout.textContent = `avg ${avg.toFixed(3)} · ${specBuf.length} bins`;
  }

  return function update() {
    if (!vm.enabled) return;
    resizeIfNeeded();
    drawGrid();
    if (vm.kind === "scope") drawScope();
    else drawSpectrum();
  };
}

export const renderVisualModule = renderVisualSurface;
