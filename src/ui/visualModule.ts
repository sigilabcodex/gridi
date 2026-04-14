import type { Engine } from "../engine/audio";
import type { VisualModule } from "../patch";
import { wireSafeDeleteButton } from "./deleteButton";
import { createFaceplateMainPanel, createFaceplateSection, createFaceplateStackPanel } from "./faceplateSections";
import { createModuleTabShell } from "./moduleShell";
import { createModulePresetControl } from "./modulePresetControl";
import type { ModulePresetRecord } from "./persistence/modulePresetStore";
import type { TooltipBinder } from "./tooltip";
import {
  createCompactSelectField,
  createModuleRefChip,
  createRoutingCard,
  createRoutingChip,
  createRoutingSummary,
  createRoutingSummaryStrip,
  type RoutingSnapshot,
} from "./routingVisibility";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
}

type VisualDrawContext = {
  canvas: HTMLCanvasElement;
  ctx2d: CanvasRenderingContext2D;
  engine: Engine;
  scopeBuf: Float32Array;
  specBuf: Float32Array;
  readout: HTMLElement;
};

type VisualModeSpec = {
  label: string;
  draw: (ctx: VisualDrawContext) => void;
};

const VISUAL_MODE_SPECS: Record<VisualModule["kind"], VisualModeSpec> = {
  scope: {
    label: "Scope",
    draw: ({ canvas, ctx2d, engine, scopeBuf, readout }) => {
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
      readout.textContent = `Peak ${peak.toFixed(3)} · ${scopeBuf.length} samples`;
    },
  },
  spectrum: {
    label: "Spectrum",
    draw: ({ canvas, ctx2d, engine, specBuf, readout }) => {
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
      readout.textContent = `Avg ${avg.toFixed(3)} · ${specBuf.length} bins`;
    },
  },
  pattern: {
    label: "Pattern",
    draw: ({ canvas, ctx2d, readout }) => {
      const cols = 16;
      const rows = 8;
      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;
      ctx2d.fillStyle = "rgba(255, 222, 159, 0.22)";
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if ((row + col) % 5 !== 0) continue;
          ctx2d.fillRect(col * cellW + 1, row * cellH + 1, Math.max(1, cellW - 2), Math.max(1, cellH - 2));
        }
      }
      readout.textContent = "Pattern monitor · preview lane";
    },
  },
};

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

  const identity = el("div", "surfaceIdentity surfaceIdentity--canonical drumIdentity");
  const badge = el("div", "surfaceBadge surfaceBadge--visualFamily");
  badge.textContent = "VIS";
  identity.append(badge, presetControl.button);

  const right = el("div", "rightControls");
  const btnOn = el("button");
  btnOn.className = "surfaceHeaderAction";
  const updateOn = () => {
    btnOn.textContent = vm.enabled ? "On" : "Off";
    btnOn.classList.toggle("primary", vm.enabled);
  };
  btnOn.onclick = () => {
    vm.enabled = !vm.enabled;
    updateOn();
    syncFooter();
  };

  const btnX = el("button", "danger surfaceHeaderAction");
  btnX.textContent = "×";
  wireSafeDeleteButton(btnX, onRemove);
  right.append(btnOn, btnX);
  header.append(identity, right);

  const visualSource = routing.visualSources.get(vm.id);

  const panelMain = createFaceplateMainPanel();
  panelMain.classList.add("visualSurfaceBody", "visualMainLayout");

  const modeSpec = VISUAL_MODE_SPECS[vm.kind] ?? VISUAL_MODE_SPECS.scope;
  const chipRow = createFaceplateSection("io", "visualMetaRow");
  const modeChip = createRoutingChip(`MODE ${modeSpec.label.toUpperCase()}`, "muted");
  const sourceChip = createRoutingChip(`SRC ${visualSource?.sourceLabel ?? "MASTER"}`, visualSource ? "connected" : "muted");
  const fftChip = createRoutingChip(`FFT ${vm.fftSize ?? 2048}`, "muted");
  chipRow.append(modeChip, sourceChip, fftChip);

  const canvasWrap = createFaceplateSection("feature", "visualDisplayWrap");
  const canvas = document.createElement("canvas");
  canvas.className = "scope";
  canvas.width = 800;
  canvas.height = 260;
  const readout = el("div", "visualReadout small");
  const visualModeRow = createFaceplateSection("controls", "visualControlDock");
  const modeField = createCompactSelectField({
    label: "Mode",
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
  visualModeRow.append(modeField.wrap, fftField.wrap);
  const readoutSection = createFaceplateSection("bottom");
  readoutSection.setAttribute("aria-label", "visual readout");
  readoutSection.append(readout);
  canvasWrap.append(canvas);
  panelMain.append(chipRow, canvasWrap, visualModeRow, readoutSection);

  const panelRouting = createFaceplateStackPanel("utilityPanel utilityPanel--visualRouting");
  const sourceCard = createRoutingCard("Input", visualSource?.sourceLabel ?? "Master mix");
  sourceCard.appendChild(createRoutingSummaryStrip([
    createRoutingSummary("In", visualSource ? [createModuleRefChip({ id: vm.id, name: visualSource.sourceLabel, family: "visual", shortId: "MIX", label: visualSource.sourceLabel })] : [], "Master"),
    createRoutingSummary("Mix", (visualSource?.contributors ?? []).slice(0, 4).map((ref) => createModuleRefChip(ref)), "No voices"),
  ]));
  const contributors = el("div", "routingChipList");
  const visibleContributors = (visualSource?.contributors ?? []).slice(0, 8);
  visibleContributors.forEach((ref) => contributors.appendChild(createModuleRefChip(ref)));
  if ((visualSource?.contributors?.length ?? 0) > visibleContributors.length) {
    contributors.appendChild(createRoutingChip(`+${(visualSource?.contributors?.length ?? 0) - visibleContributors.length} more`, "muted"));
  }
  sourceCard.appendChild(contributors);
  panelRouting.appendChild(sourceCard);

  const panelSettings = createFaceplateStackPanel("surfaceSettingsPanel visualSettingsPanel");
  const dock = createFaceplateSection("controls", "visualControlDock");
  const settingsHint = el("div", "visualSettingsHint triggerTransportReadout");
  settingsHint.textContent = "Display configuration is available on Main for quick performance edits.";
  dock.append(settingsHint);
  panelSettings.append(dock);

  const shell = createModuleTabShell({
    specs: [
      { id: "MAIN", label: "Main", panel: panelMain },
      { id: "ROUTING", label: "Routing", panel: panelRouting },
      { id: "SETTINGS", label: "Advanced", panel: panelSettings },
    ],
    activeTab: "MAIN",
  });

  const infoBar = createFaceplateSection("bottom", "drumInfoBar visualInfoBar");
  const idToken = el("span", "drumInfoToken");
  idToken.textContent = vm.id.slice(-6).toUpperCase();
  const stateToken = el("span", "drumInfoToken");
  const modeToken = el("span", "drumInfoToken");
  const metaToken = el("span", "drumInfoToken drumInfoToken--meta");
  infoBar.append(idToken, stateToken, modeToken, metaToken);

  const syncFooter = () => {
    const modeSpec = VISUAL_MODE_SPECS[vm.kind] ?? VISUAL_MODE_SPECS.scope;
    stateToken.textContent = vm.enabled ? "ACTIVE" : "BYPASS";
    modeToken.textContent = `MODE ${modeSpec.label.toUpperCase()}`;
    metaToken.textContent = `FFT ${vm.fftSize ?? 2048}`;
    modeChip.textContent = `MODE ${modeSpec.label.toUpperCase()}`;
    sourceChip.textContent = `SRC ${visualSource?.sourceLabel ?? "MASTER"}`;
    fftChip.textContent = `FFT ${vm.fftSize ?? 2048}`;
  };

  surface.append(header, shell.face, shell.tabs, infoBar);
  parent.appendChild(surface);
  updateOn();
  syncFooter();

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

  return function update() {
    syncFooter();
    if (!vm.enabled) return;
    resizeIfNeeded();
    drawGrid();
    const modeSpec = VISUAL_MODE_SPECS[vm.kind] ?? VISUAL_MODE_SPECS.scope;
    modeSpec.draw({
      canvas,
      ctx2d,
      engine,
      scopeBuf,
      specBuf,
      readout,
    });
  };
}

export const renderVisualModule = renderVisualSurface;
