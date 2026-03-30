import type { DrumModule, Patch, SoundModule, TonalModule } from "../patch";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createModuleIdentityMeta, createModuleTabShell } from "./moduleShell";
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

export type VoiceTab = "MAIN" | "ROUTING" | "SETTINGS";

type UiState = {
  tab: VoiceTab;
  setTab: (t: VoiceTab) => void;
};

type TriggerOption = { id: string; label: string };
type ControlOption = { id: string; label: string };

type SurfaceParams = {
  root: HTMLElement;
  v: SoundModule;
  routing: RoutingSnapshot;
  getLedState: (moduleId: string) => { active: boolean; hit: boolean };
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void;
  onRoutingChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void;
  ui: UiState;
  triggerOptions: TriggerOption[];
  controlOptions: ControlOption[];
  onLoadModulePreset: (moduleId: string, presetId: string) => void;
  onSaveModulePreset: (moduleId: string, name: string, overwritePresetId?: string | null) => void;
  modulePresetRecords: ModulePresetRecord[];
  attachTooltip?: TooltipBinder;
  onRemove?: () => void;
};

function makeHeader(v: SoundModule, badgeText: string, params: Pick<SurfaceParams, "onPatchChange" | "onLoadModulePreset" | "onSaveModulePreset" | "modulePresetRecords" | "attachTooltip">, onRemove?: () => void) {
  const header = document.createElement("div");
  header.className = "surfaceHeader";

  const presetControl = createModulePresetControl({
    module: v,
    records: params.modulePresetRecords,
    onLoadPreset: (presetId) => params.onLoadModulePreset(v.id, presetId),
    onSavePreset: (name, overwritePresetId) => params.onSaveModulePreset(v.id, name, overwritePresetId),
    attachTooltip: params.attachTooltip,
  });

  const left = createModuleIdentityMeta({
    badgeText,
    instanceName: v.name,
    instanceId: v.id.slice(-6).toUpperCase(),
    presetButton: presetControl.button,
  });

  const right = document.createElement("div");
  right.className = "rightControls";
  const ledA = document.createElement("div");
  ledA.className = "led";
  const ledHit = document.createElement("div");
  ledHit.className = "led";

  const toggle = document.createElement("button");
  const syncToggle = () => {
    toggle.textContent = v.enabled ? "On" : "Off";
    toggle.className = v.enabled ? "primary" : "";
  };
  syncToggle();
  toggle.onclick = () => params.onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === v.id);
    if (m && (m.type === "drum" || m.type === "tonal")) m.enabled = !m.enabled;
  }, { regen: false });

  const btnX = document.createElement("button");
  btnX.className = "danger";
  btnX.textContent = "×";
  wireSafeDeleteButton(btnX, () => onRemove?.());

  right.append(ledA, ledHit, toggle, btnX);
  header.append(left, right);
  return { header, ledA, ledHit, syncToggle };
}

function createVoiceSummary(v: SoundModule, routing: RoutingSnapshot) {
  const incoming = routing.voiceIncoming.get(v.id);
  const triggerChip = incoming?.trigger ? [createModuleRefChip(incoming.trigger)] : [];
  const modChips = (incoming?.modulations ?? []).map((modulation) => createModuleRefChip(modulation.source, modulation.parameterLabel));

  return createRoutingSummaryStrip([
    createRoutingSummary("Trig", triggerChip, "No trig"),
    createRoutingSummary("Mod", modChips, "No mod"),
  ]);
}

function createFaceTabs(
  ui: UiState,
  mainPanel: HTMLElement,
  triggerOptions: TriggerOption[],
  controlOptions: ControlOption[],
  v: SoundModule,
  routing: RoutingSnapshot,
  onRoutingChange: SurfaceParams["onRoutingChange"],
) {
  const panelRouting = document.createElement("div");
  panelRouting.className = "utilityPanel utilityPanel--voiceRouting";

  const incoming = routing.voiceIncoming.get(v.id);

  const sourceRow = createRoutingCard("Trig in", incoming?.trigger ? incoming.trigger.name : "No source");
  const sourceField = createCompactSelectField({
    label: "Source",
    options: triggerOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    selected: v.triggerSource,
    emptyLabel: "None",
    onChange: (value) => onRoutingChange((p) => {
      const m = p.modules.find((x) => x.id === v.id);
      if (m && (m.type === "drum" || m.type === "tonal")) m.triggerSource = value;
    }, { regen: true }),
  });
  const routeMap = document.createElement("div");
  routeMap.className = "utilityRouteMap small";
  routeMap.textContent = incoming?.trigger ? `← ${incoming.trigger.name}` : "No trig feed";
  sourceRow.append(sourceField.wrap, routeMap);
  panelRouting.appendChild(sourceRow);

  const modulationCard = createRoutingCard("Mod in", incoming?.modulations?.length ? `${incoming.modulations.length} lane${incoming.modulations.length === 1 ? "" : "s"}` : "No source");
  const modulationList = document.createElement("div");
  modulationList.className = "routingChipList";
  if (incoming?.modulations?.length) {
    incoming.modulations.forEach((modulation) => modulationList.appendChild(createModuleRefChip(modulation.source, modulation.parameterLabel)));
  } else {
    modulationList.appendChild(createRoutingChip("No mod", "muted"));
  }
  modulationCard.appendChild(modulationList);
  modulationCard.appendChild(createVoiceRoutingSelectors(v, controlOptions, onRoutingChange));
  panelRouting.appendChild(modulationCard);

  const panelSettings = document.createElement("div");
  panelSettings.className = "surfaceSettingsPanel";
  const settingsHint = document.createElement("div");
  settingsHint.className = "surfaceSettingsHint small";
  settingsHint.textContent = "No secondary controls.";
  panelSettings.append(settingsHint);

  return createModuleTabShell({
    specs: [
      { id: "MAIN", label: "Main", panel: mainPanel },
      { id: "ROUTING", label: "Routing", panel: panelRouting },
      { id: "SETTINGS", label: "Settings", panel: panelSettings },
    ],
    activeTab: ui.tab,
    onTabChange: (tab) => ui.setTab(tab),
  });
}

function modulationSelect(
  labelText: string,
  options: ControlOption[],
  selected: string | undefined,
  onChange: (value: string | null) => void,
) {
  return createCompactSelectField({
    label: labelText,
    options: options.map((opt) => ({ value: opt.id, label: opt.label })),
    selected,
    emptyLabel: "None",
    className: "routingInlineCard",
    onChange,
  }).wrap;
}

function createVoiceRoutingSelectors(v: SoundModule, controlOptions: ControlOption[], onRoutingChange: SurfaceParams["onRoutingChange"]) {
  const selectors = document.createElement("div");
  selectors.className = "routingSelectors";

  if (v.type === "drum") {
    selectors.appendChild(
      modulationSelect("Pitch mod", controlOptions, v.modulations?.basePitch, (source) => onRoutingChange((p) => {
        const m = p.modules.find((z) => z.id === v.id);
        if (m?.type === "drum") {
          m.modulations = m.modulations ?? {};
          if (source) m.modulations.basePitch = source;
          else delete m.modulations.basePitch;
        }
      }, { regen: false })),
    );
  }

  if (v.type === "tonal") {
    selectors.appendChild(
      modulationSelect("Cut mod", controlOptions, v.modulations?.cutoff, (source) => onRoutingChange((p) => {
        const m = p.modules.find((z) => z.id === v.id);
        if (m?.type === "tonal") {
          m.modulations = m.modulations ?? {};
          if (source) m.modulations.cutoff = source;
          else delete m.modulations.cutoff;
        }
      }, { regen: false })),
    );
  }

  return selectors;
}

export function renderDrumModuleSurface(params: SurfaceParams) {
  const { root, v, routing, onPatchChange, onRoutingChange, getLedState, triggerOptions, controlOptions, ui, onRemove } = params;
  const d = v as DrumModule;

  const surface = document.createElement("section");
  surface.className = "moduleSurface drumSurface";
  surface.dataset.type = "drum";

  const h = makeHeader(v, "DRUM", params, onRemove);
  const main = document.createElement("div");
  main.className = "surfaceTabPanel drumSurfaceBody";
  const drumControls = document.createElement("div");
  drumControls.className = "voiceControlGrid voiceControlGrid-drum";
  drumControls.append(
    ctlFloat({
      label: "Pitch",
      value: d.basePitch,
      min: 24,
      max: 84,
      step: 1,
      integer: true,
      onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.basePitch = x; }, { regen: false }),
    }),
    ctlFloat({ label: "Snap", value: d.snap, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.snap = x; }, { regen: false }) }),
    ctlFloat({ label: "Decay", value: d.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.decay = x; }, { regen: false }) }),
    ctlFloat({ label: "Tone", value: d.tone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.tone = x; }, { regen: false }) }),
    ctlFloat({ label: "Noise", value: d.noise, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.noise = x; }, { regen: false }) }),
    ctlFloat({ label: "Level", value: d.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.amp = x; }, { regen: false }) }),
    ctlFloat({ label: "Pan", value: d.pan, min: -1, max: 1, step: 0.001, center: 0, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pan = x; }, { regen: false }) }),
  );
  main.append(
    createVoiceSummary(v, routing),
    drumControls,
  );

  const shell = createFaceTabs(ui, main, triggerOptions, controlOptions, v, routing, onRoutingChange);
  surface.append(h.header, shell.face, shell.tabs);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
  };
}

export function renderSynthModuleSurface(params: SurfaceParams) {
  const { root, v, routing, onPatchChange, onRoutingChange, getLedState, triggerOptions, controlOptions, ui, onRemove } = params;
  const t = v as TonalModule;

  const surface = document.createElement("section");
  surface.className = "moduleSurface synthSurface";
  surface.dataset.type = "tonal";

  const h = makeHeader(v, "SYNTH", params, onRemove);
  const main = document.createElement("div");
  main.className = "surfaceTabPanel synthSurfaceBody";
  const synthControls = document.createElement("div");
  synthControls.className = "voiceControlGrid voiceControlGrid-synth";
  synthControls.append(
    ctlFloat({ label: "Wave", value: t.waveform, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.waveform = x; }, { regen: false }) }),
    ctlFloat({
      label: "Cutoff",
      value: t.cutoff,
      min: 0,
      max: 1,
      step: 0.001,
      onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.cutoff = x; }, { regen: false }),
    }),
    ctlFloat({ label: "Reso", value: t.resonance, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.resonance = x; }, { regen: false }) }),
    ctlFloat({ label: "Attack", value: t.attack, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.attack = x; }, { regen: false }) }),
    ctlFloat({ label: "Decay", value: t.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.decay = x; }, { regen: false }) }),
    ctlFloat({ label: "Level", value: t.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.amp = x; }, { regen: false }) }),
    ctlFloat({ label: "Mod", value: t.modDepth, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modDepth = x; }, { regen: false }) }),
    ctlFloat({ label: "Pan", value: t.pan, min: -1, max: 1, step: 0.001, center: 0, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.pan = x; }, { regen: false }) }),
  );
  main.append(
    createVoiceSummary(v, routing),
    synthControls,
  );

  const shell = createFaceTabs(ui, main, triggerOptions, controlOptions, v, routing, onRoutingChange);
  surface.append(h.header, shell.face, shell.tabs);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
  };
}
