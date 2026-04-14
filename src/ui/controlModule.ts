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

  const chipRow = createFaceplateSection("feature", "controlTypeRow");
  chipRow.classList.add("surfaceMainFeature");
  const routeChip = createRoutingChip(
    `${controlTargets.length} target${controlTargets.length === 1 ? "" : "s"}`,
    controlTargets.length ? "connected" : "muted",
  );
  routeChip.classList.add("surfaceHeaderChip");
  chipRow.append(kindField.wrap, waveField.wrap, routeChip);

  const featureRack = createFaceplateSection("feature", "controlFeatureRack");
  featureRack.classList.add("surfaceMainFeature");
  const display = document.createElement("div");
  display.className = "controlDisplaySurface";
  const displaySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  displaySvg.setAttribute("viewBox", "0 0 220 68");
  displaySvg.setAttribute("class", "controlDisplaySvg");
  const baseline = document.createElementNS("http://www.w3.org/2000/svg", "path");
  baseline.setAttribute("class", "controlDisplayBaseline");
  baseline.setAttribute("d", "M 8 34 L 212 34");
  const motion = document.createElementNS("http://www.w3.org/2000/svg", "path");
  motion.setAttribute("class", "controlDisplayMotion");
  displaySvg.append(baseline, motion);
  const meter = document.createElement("div");
  meter.className = "controlMeter controlMeter--feature";
  const meterFill = document.createElement("div");
  meterFill.className = "controlMeterFill";
  const readout = document.createElement("div");
  readout.className = "triggerTransportReadout";
  display.append(displaySvg);
  featureRack.append(display, meter, readout);
  meter.appendChild(meterFill);

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

  panelMain.append(
    chipRow,
    featureRack,
    mainKnobGrid,
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
      { id: "SETTINGS", label: "Settings", panel: panelSettings },
    ],
    activeTab: "MAIN",
  });

  const infoBar = createFaceplateSection("bottom", "drumInfoBar controlInfoBar");
  const nameToken = document.createElement("span");
  nameToken.className = "drumInfoToken";
  nameToken.textContent = `CTRL_${Math.max(1, Number.parseInt(mod.name.replace(/\D+/g, ""), 10) || 1)}`;
  const stateToken = document.createElement("span");
  stateToken.className = "drumInfoToken";
  const modeToken = document.createElement("span");
  modeToken.className = "drumInfoToken";
  const metaToken = document.createElement("span");
  metaToken.className = "drumInfoToken drumInfoToken--meta";
  infoBar.append(nameToken, stateToken, modeToken, metaToken);

  const syncFooter = () => {
    stateToken.textContent = mod.enabled ? "ACTIVE" : "BYPASS";
    modeToken.textContent = `MODE ${(mod.kind ?? "lfo").toUpperCase()}`;
    metaToken.textContent = `RATE ${mod.rate.toFixed(2)}`;
  };

  surface.append(header, shell.face, shell.tabs, infoBar);
  root.appendChild(surface);

  return () => {
    syncToggle();
    routeChip.textContent = `${controlTargets.length} target${controlTargets.length === 1 ? "" : "s"}`;
    const val = sampleControl01(mod, performance.now() / 1000);
    meterFill.style.width = `${Math.round(val * 100)}%`;
    const pct = Math.round(val * 100);
    const mode = mod.kind ?? "lfo";
    const phaseOffset = mod.phase * Math.PI * 2;
    const points: string[] = [];
    for (let i = 0; i <= 48; i++) {
      const norm = i / 48;
      let y = 0;
      if (mode === "drift") {
        y = Math.sin(norm * Math.PI * 2 + phaseOffset) * 0.35 + Math.sin(norm * Math.PI * 8 + phaseOffset * 0.7) * 0.12;
      } else if (mode === "stepped") {
        const step = Math.floor(norm * 8);
        y = ((step % 4) / 3) * 2 - 1;
      } else if ((mod.waveform ?? "sine") === "triangle") {
        y = 1 - 4 * Math.abs(Math.round(norm - 0.25) - (norm - 0.25));
      } else if (mod.waveform === "square") {
        y = norm < 0.5 ? 1 : -1;
      } else if (mod.waveform === "random") {
        y = Math.sin(norm * Math.PI * 14 + phaseOffset) * 0.7 + Math.sin(norm * Math.PI * 4 + phaseOffset * 0.3) * 0.25;
      } else {
        y = Math.sin(norm * Math.PI * 2 + phaseOffset);
      }
      const x = 8 + norm * 204;
      const py = 34 - (y * (20 + mod.amount * 6));
      points.push(`${x.toFixed(2)} ${py.toFixed(2)}`);
    }
    motion.setAttribute("d", `M ${points.join(" L ")}`);
    readout.textContent = `OUT ${pct}% · SHAPE ${(mod.waveform ?? "sine").toUpperCase()} · RAND ${Math.round(mod.randomness * 100)}`;
    syncFooter();
    waveField.select.disabled = mod.kind !== "lfo";
    waveField.wrap.classList.toggle("isDisabled", mod.kind !== "lfo");
  };
}
