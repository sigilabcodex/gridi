import type { Engine } from "../engine/audio";
import type { Patch } from "../patch";
import type { VisualModule } from "../patch";
import { wireSafeDeleteButton } from "./deleteButton";
import { createFaceplateMainPanel, createFaceplateSection, createFaceplateStackPanel } from "./faceplateSections";
import { bindFloatingPanelReposition, placeFloatingPanel } from "./floatingPanel";
import { createModuleTabShell } from "./moduleShell";
import { createModulePresetControl } from "./modulePresetControl";
import type { ModulePresetRecord } from "./persistence/modulePresetStore";
import type { TooltipBinder } from "./tooltip";
import {
  createModuleRefChip,
  createRoutingCard,
  createRoutingChip,
  createRoutingSummary,
  createRoutingSummaryStrip,
  type RoutingSnapshot,
} from "./routingVisibility";
import { runtimeStateLabel } from "./runtimeActivity";

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
  isTransportPlaying: () => boolean,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  onRemove: () => void,
  modulePresetRecords: ModulePresetRecord[] = [],
  onLoadModulePreset?: (moduleId: string, presetId: string) => void,
  onSaveModulePreset?: (moduleId: string, name: string, overwritePresetId?: string | null) => void,
  attachTooltip?: TooltipBinder,
) {
  const surface = el("section", "moduleSurface moduleSurface--withStatus visualSurface");
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
    onPatchChange((patch) => {
      const module = patch.modules.find((item) => item.id === vm.id);
      if (module?.type === "visual") module.enabled = !module.enabled;
    }, { regen: false });
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

  const chipRow = createFaceplateSection("io", "visualMetaRow visualChipRow");
  const modeChip = document.createElement("button");
  modeChip.type = "button";
  modeChip.className = "routingChip routingChip-muted visualChipButton";
  modeChip.setAttribute("aria-label", "Visual mode");
  modeChip.setAttribute("aria-haspopup", "dialog");

  const sourceChip = document.createElement("button");
  sourceChip.type = "button";
  sourceChip.className = `routingChip visualChipButton ${visualSource ? "routingChip-connected" : "routingChip-muted"}`;
  sourceChip.setAttribute("aria-label", "Visual source");
  sourceChip.setAttribute("aria-haspopup", "dialog");

  const fftChip = document.createElement("button");
  fftChip.type = "button";
  fftChip.className = "routingChip routingChip-muted visualChipButton";
  fftChip.setAttribute("aria-label", "FFT size");
  fftChip.setAttribute("aria-haspopup", "dialog");
  chipRow.append(modeChip, sourceChip, fftChip);

  const visualModes: VisualModule["kind"][] = ["scope", "spectrum", "pattern"];
  const fftSizes: Array<NonNullable<VisualModule["fftSize"]>> = [512, 1024, 2048, 4096];
  const sourceOptions = [{ value: "master", label: visualSource?.sourceLabel ?? "Master mix" }];

  let openPanelCleanup: { destroy: () => void } | null = null;
  let openPanel: HTMLElement | null = null;
  let openTrigger: HTMLElement | null = null;
  const closeChipPanel = () => {
    if (openPanelCleanup) {
      openPanelCleanup.destroy();
      openPanelCleanup = null;
    }
    openPanel?.remove();
    openPanel = null;
    if (openTrigger) {
      openTrigger.classList.remove("isOpen");
      openTrigger.setAttribute("aria-expanded", "false");
      openTrigger = null;
    }
  };

  const openChipPanel = <T extends string | number>(params: {
    trigger: HTMLButtonElement;
    label: string;
    align: "start" | "end";
    minWidth: number;
    maxWidth: number;
    options: Array<{ value: T; label: string }>;
    selected: () => T;
    onSelect: (value: T) => void;
  }) => {
    if (openPanel && openTrigger === params.trigger) {
      closeChipPanel();
      return;
    }
    closeChipPanel();

    const panel = document.createElement("div");
    panel.className = "floatingPanel visualChipSelectorPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", params.label);

    const list = document.createElement("div");
    list.className = "visualChipSelectorList";
    const selected = params.selected();
    params.options.forEach((option) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `visualChipSelectorRow${option.value === selected ? " isSelected" : ""}`;

      const mark = document.createElement("span");
      mark.className = "visualChipSelectorMark";
      mark.textContent = option.value === selected ? "✓" : "";
      const value = document.createElement("span");
      value.className = "visualChipSelectorValue";
      value.textContent = option.label;
      row.append(mark, value);
      row.onclick = () => {
        closeChipPanel();
        params.onSelect(option.value);
      };
      list.appendChild(row);
    });

    panel.appendChild(list);
    document.body.appendChild(panel);

    placeFloatingPanel(panel, params.trigger.getBoundingClientRect(), {
      preferredSide: "bottom",
      align: params.align,
      offset: 8,
      minWidth: params.minWidth,
      maxWidth: params.maxWidth,
    });
    const reposition = bindFloatingPanelReposition(
      panel,
      () => (params.trigger.isConnected ? params.trigger.getBoundingClientRect() : null),
      {
        preferredSide: "bottom",
        align: params.align,
        offset: 8,
        minWidth: params.minWidth,
        maxWidth: params.maxWidth,
      },
    );

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panel.contains(target) || params.trigger.contains(target)) return;
      closeChipPanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeChipPanel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    openPanelCleanup = {
      destroy() {
        reposition.destroy();
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
      },
    };

    openPanel = panel;
    openTrigger = params.trigger;
    params.trigger.classList.add("isOpen");
    params.trigger.setAttribute("aria-expanded", "true");
  };

  modeChip.onclick = () => {
    openChipPanel<VisualModule["kind"]>({
      trigger: modeChip,
      label: `${vm.name} visual mode`,
      align: "start",
      minWidth: 150,
      maxWidth: 190,
      options: visualModes.map((kind) => ({ value: kind, label: VISUAL_MODE_SPECS[kind].label })),
      selected: () => vm.kind,
      onSelect: (value) => onPatchChange((patch) => {
        const module = patch.modules.find((item) => item.id === vm.id);
        if (module?.type === "visual") module.kind = value;
      }, { regen: false }),
    });
  };

  sourceChip.onclick = () => {
    openChipPanel({
      trigger: sourceChip,
      label: `${vm.name} visual source`,
      align: "start",
      minWidth: 150,
      maxWidth: 220,
      options: sourceOptions,
      selected: () => "master",
      onSelect: () => {},
    });
  };

  fftChip.onclick = () => {
    openChipPanel<NonNullable<VisualModule["fftSize"]>>({
      trigger: fftChip,
      label: `${vm.name} fft size`,
      align: "end",
      minWidth: 140,
      maxWidth: 180,
      options: fftSizes.map((size) => ({ value: size, label: `${size}` })),
      selected: () => vm.fftSize ?? 2048,
      onSelect: (value) => onPatchChange((patch) => {
        const module = patch.modules.find((item) => item.id === vm.id);
        if (module?.type === "visual") module.fftSize = value;
      }, { regen: false }),
    });
  };

  const canvasWrap = createFaceplateSection("feature", "visualDisplayWrap");
  const canvas = document.createElement("canvas");
  canvas.className = "scope";
  canvas.width = 800;
  canvas.height = 260;
  const readout = el("div", "visualReadout small");
  const readoutSection = createFaceplateSection("bottom");
  readoutSection.setAttribute("aria-label", "visual readout");
  readoutSection.append(readout);
  canvasWrap.append(canvas);
  panelMain.append(chipRow, canvasWrap, readoutSection);

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
    const hasSignal = engine.getMasterActivity().active;
    stateToken.textContent = runtimeStateLabel(isTransportPlaying() || hasSignal, vm.enabled);
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
    const hasSignal = engine.getMasterActivity().active;
    if (!isTransportPlaying() && !hasSignal) return;
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
