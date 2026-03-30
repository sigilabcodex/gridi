import type { ControlKind, LfoWaveform, Patch, ControlModule } from "../patch";
import { sampleControl01 } from "../engine/control";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createFaceplateMainPanel, createFaceplateSection, createFaceplateStackPanel } from "./faceplateSections";
import { createModuleIdentityMeta, createModuleTabShell } from "./moduleShell";
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

  const idWrap = createModuleIdentityMeta({
    badgeText: "CONTROL",
    instanceName: mod.name,
    instanceId: mod.id.slice(-6).toUpperCase(),
    presetButton: presetControl.button,
  });

  const right = document.createElement("div");
  right.className = "rightControls";
  const toggle = document.createElement("button");
  const syncToggle = () => {
    toggle.textContent = mod.enabled ? "On" : "Off";
    toggle.className = mod.enabled ? "primary" : "";
  };
  syncToggle();
  toggle.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === mod.id);
    if (m?.type === "control") m.enabled = !m.enabled;
  }, { regen: false });

  const btnX = document.createElement("button");
  btnX.className = "danger";
  btnX.textContent = "×";
  wireSafeDeleteButton(btnX, () => onRemove?.());
  right.append(toggle, btnX);
  header.append(idWrap, right);

  const controlTargets = routing.controlTargets.get(mod.id) ?? [];

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

  const typeRow = createFaceplateSection("feature", "controlTypeRow");
  typeRow.classList.add("surfaceMainFeature");
  typeRow.append(kindField.wrap, waveField.wrap);

  const meter = document.createElement("div");
  meter.className = "controlMeter";
  const meterFill = document.createElement("div");
  meterFill.className = "controlMeterFill";
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

  const bottomSection = createFaceplateSection("bottom");
  bottomSection.append(meter);

  panelMain.append(
    typeRow,
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
      { id: "SETTINGS", label: "Settings", panel: panelSettings },
    ],
    activeTab: "MAIN",
  });

  surface.append(header, shell.face, shell.tabs);
  root.appendChild(surface);

  return () => {
    syncToggle();
    const val = sampleControl01(mod, performance.now() / 1000);
    meterFill.style.width = `${Math.round(val * 100)}%`;
    waveField.select.disabled = mod.kind !== "lfo";
    waveField.wrap.classList.toggle("isDisabled", mod.kind !== "lfo");
  };
}
