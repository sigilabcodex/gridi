import type { ControlKind, LfoWaveform, Patch, ControlModule } from "../patch";
import { sampleControl01 } from "../engine/control";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createFaceplateMainPanel, createFaceplateSection, createFaceplateStackPanel } from "./faceplateSections";
import { createModuleTabShell } from "./moduleShell";
import { createModulePresetControl } from "./modulePresetControl";
import type { ModulePresetRecord } from "./persistence/modulePresetStore";
import type { TooltipBinder } from "./tooltip";
import {
  createCompactSelectField,
  createRoutingCard,
  createRoutingChip,
  type RoutingSnapshot,
} from "./routingVisibility";

const KINDS: ControlKind[] = ["lfo", "drift", "stepped"];
const WAVES: LfoWaveform[] = ["sine", "triangle", "square", "random"];

function formatControlInstanceToken(name: string) {
  return name.trim().replace(/\s+/g, "_").toUpperCase();
}

export function renderControlSurface(
  root: HTMLElement,
  mod: ControlModule,
  routing: RoutingSnapshot,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  modulePresetRecords: ModulePresetRecord[] = [],
  onLoadModulePreset?: (moduleId: string, presetId: string) => void,
  onSaveModulePreset?: (moduleId: string, name: string, overwritePresetId?: string | null) => void,
  attachTooltip?: TooltipBinder,
  onRemove?: () => void,
) {
  const surface = document.createElement("section");
  surface.className = "moduleSurface controlSurface";
  surface.dataset.type = "control";

  const header = document.createElement("div");
  header.className = "surfaceHeader";
  const presetControl = createModulePresetControl({
    module: mod,
    records: modulePresetRecords,
    onLoadPreset: (presetId) => onLoadModulePreset?.(mod.id, presetId),
    onSavePreset: (name, overwritePresetId) => onSaveModulePreset?.(mod.id, name, overwritePresetId),
    attachTooltip,
  });

  const idWrap = document.createElement("div");
  idWrap.className = "surfaceIdentity surfaceIdentity--canonical drumIdentity";

  const familyBadge = document.createElement("div");
  familyBadge.className = "surfaceBadge surfaceBadge--controlFamily";
  familyBadge.textContent = "CTRL";

  const controlTargets = routing.controlTargets.get(mod.id) ?? [];

  const right = document.createElement("div");
  right.className = "rightControls";
  const toggle = document.createElement("button");
  toggle.className = "surfaceHeaderAction";
  const syncToggle = () => {
    toggle.textContent = mod.enabled ? "On" : "Off";
    toggle.classList.toggle("primary", mod.enabled);
  };
  syncToggle();
  toggle.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === mod.id);
    if (m?.type === "control") m.enabled = !m.enabled;
  }, { regen: false });

  const btnX = document.createElement("button");
  btnX.className = "danger surfaceHeaderAction";
  btnX.textContent = "×";
  wireSafeDeleteButton(btnX, () => onRemove?.());
  idWrap.append(familyBadge, presetControl.button);
  right.append(toggle, btnX);
  header.append(idWrap, right);

  const panelMain = createFaceplateMainPanel();
  panelMain.classList.add("controlBody");

  const kindField = createCompactSelectField({
    label: "Mode",
    options: KINDS.map((kind) => ({ value: kind, label: kind.toUpperCase() })),
    selected: mod.kind,
    onChange: (value) => onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === mod.id);
      if (m?.type === "control" && value) m.kind = value as ControlKind;
    }, { regen: false }),
  });

  const waveField = createCompactSelectField({
    label: "Shape",
    options: WAVES.map((wave) => ({ value: wave, label: wave })),
    selected: mod.waveform,
    onChange: (value) => onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === mod.id);
      if (m?.type === "control" && value) m.waveform = value as LfoWaveform;
    }, { regen: false }),
  });

  const chipRow = createFaceplateSection("io", "controlChipRow");
  const modeChip = createRoutingChip((mod.kind ?? "lfo").toUpperCase(), "muted");
  const routeChip = createRoutingChip(
    `${controlTargets.length} target${controlTargets.length === 1 ? "" : "s"}`,
    controlTargets.length ? "connected" : "muted",
  );
  const waveChip = createRoutingChip(`WAVE ${String(mod.waveform ?? "sine").toUpperCase()}`, "muted");
  chipRow.append(modeChip, routeChip, waveChip);

  const featureRack = createFaceplateSection("feature", "controlFeatureRack");
  featureRack.classList.add("surfaceMainFeature");
  const display = document.createElement("canvas");
  display.className = "controlDisplayCanvas";
  const readout = document.createElement("div");
  readout.className = "triggerTransportReadout controlDisplayReadout";
  featureRack.append(display, readout);

  const mainKnobGrid = createFaceplateSection("controls", "moduleKnobGrid controlMainKnobGrid surfaceMainControls");
  mainKnobGrid.append(
    ctlFloat({ label: "Speed", value: mod.speed, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.speed = x;
    }, { regen: false }) }),
    ctlFloat({ label: "Amt", value: mod.amount, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.amount = x;
    }, { regen: false }) }),
    ctlFloat({ label: "Rate", value: mod.rate, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.rate = x;
    }, { regen: false }) }),
  );

  const bottomSection = createFaceplateSection("controls", "controlTypeRow");
  bottomSection.append(kindField.wrap, waveField.wrap);

  panelMain.append(
    chipRow,
    featureRack,
    mainKnobGrid,
    bottomSection,
  );

  const panelRouting = createFaceplateStackPanel("utilityPanel utilityPanel--controlRouting");
  const targetCard = createRoutingCard("Targets", controlTargets.length ? `${controlTargets.length} lane${controlTargets.length === 1 ? "" : "s"}` : "No routes");
  const targetList = document.createElement("div");
  targetList.className = "routingChipList";
  if (controlTargets.length) {
    const visibleTargets = controlTargets.slice(0, 8);
    visibleTargets.forEach((target) => targetList.appendChild(createRoutingChip(`${target.targetName} · ${target.parameterLabel}`, "connected")));
    if (controlTargets.length > visibleTargets.length) {
      targetList.appendChild(createRoutingChip(`+${controlTargets.length - visibleTargets.length} more`, "muted"));
    }
  } else {
    targetList.appendChild(createRoutingChip("Unassigned", "muted"));
  }
  targetCard.appendChild(targetList);
  panelRouting.appendChild(targetCard);

  const panelSettings = createFaceplateStackPanel("surfaceSettingsPanel controlSettingsPanel");
  const settingsKnobGrid = createFaceplateSection("controls", "moduleKnobGrid moduleKnobGrid-2");
  settingsKnobGrid.append(
    ctlFloat({ label: "Phase", value: mod.phase, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.phase = x;
    }, { regen: false }) }),
    ctlFloat({ label: "Rand", value: mod.randomness, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === mod.id);
      if (m?.type === "control") m.randomness = x;
    }, { regen: false }) }),
  );
  panelSettings.append(settingsKnobGrid);

  const shell = createModuleTabShell({
    specs: [
      { id: "MAIN", label: "Main", panel: panelMain },
      { id: "ROUTING", label: "Routing", panel: panelRouting },
      { id: "SETTINGS", label: "Advanced", panel: panelSettings },
    ],
    activeTab: "MAIN",
  });

  const infoBar = createFaceplateSection("bottom", "drumInfoBar controlInfoBar");
  const idToken = document.createElement("span");
  idToken.className = "drumInfoToken";
  idToken.textContent = formatControlInstanceToken(mod.name);
  const stateToken = document.createElement("span");
  stateToken.className = "drumInfoToken";
  const modeToken = document.createElement("span");
  modeToken.className = "drumInfoToken";
  const metaToken = document.createElement("span");
  metaToken.className = "drumInfoToken drumInfoToken--meta";
  infoBar.append(idToken, stateToken, modeToken, metaToken);

  const syncFooter = () => {
    stateToken.textContent = mod.enabled ? "ACTIVE" : "BYPASS";
    modeToken.textContent = `MODE ${(mod.kind ?? "lfo").toUpperCase()}`;
    metaToken.textContent = `RATE ${mod.rate.toFixed(2)}`;
  };

  const displayCtx = display.getContext("2d");
  const controlSamples = new Float32Array(72);
  let sampleIndex = 0;

  const resizeDisplay = () => {
    const rect = display.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const width = Math.max(2, Math.floor(rect.width * dpr));
    const height = Math.max(2, Math.floor(rect.height * dpr));
    if (display.width !== width || display.height !== height) {
      display.width = width;
      display.height = height;
    }
  };

  const drawDisplay = () => {
    if (!displayCtx) return;
    resizeDisplay();
    const { width, height } = display;
    if (width < 2 || height < 2) return;

    displayCtx.clearRect(0, 0, width, height);
    displayCtx.strokeStyle = "rgba(183, 238, 255, 0.24)";
    displayCtx.lineWidth = 1;
    displayCtx.beginPath();
    displayCtx.moveTo(0, height * 0.5);
    displayCtx.lineTo(width, height * 0.5);
    displayCtx.stroke();

    const nowSeconds = performance.now() / 1000;
    const sample = sampleControl01(mod, nowSeconds);
    sampleIndex = (sampleIndex + 1) % controlSamples.length;
    controlSamples[sampleIndex] = sample;

    displayCtx.lineWidth = 2;
    displayCtx.strokeStyle = "rgba(129, 226, 255, 0.95)";
    displayCtx.beginPath();
    for (let i = 0; i < controlSamples.length; i++) {
      const readIndex = (sampleIndex + i + 1) % controlSamples.length;
      const x = (i / (controlSamples.length - 1)) * width;
      const y = height * 0.86 - (controlSamples[readIndex] * height * 0.72);
      if (i === 0) displayCtx.moveTo(x, y);
      else displayCtx.lineTo(x, y);
    }
    displayCtx.stroke();
  };

  surface.append(header, shell.face, shell.tabs, infoBar);
  root.appendChild(surface);

  return () => {
    syncToggle();
    const val = sampleControl01(mod, performance.now() / 1000);
    modeChip.textContent = (mod.kind ?? "lfo").toUpperCase();
    routeChip.textContent = `${controlTargets.length} target${controlTargets.length === 1 ? "" : "s"}`;
    waveChip.textContent = `WAVE ${String(mod.waveform ?? "sine").toUpperCase()}`;
    const pct = Math.round(val * 100);
    readout.textContent = `LFO ${pct}% · SPD ${Math.round(mod.speed * 100)} · DRIFT ${Math.round(mod.randomness * 100)}`;
    drawDisplay();
    syncFooter();
    waveField.select.disabled = mod.kind !== "lfo";
    waveField.wrap.classList.toggle("isDisabled", mod.kind !== "lfo");
  };
}
