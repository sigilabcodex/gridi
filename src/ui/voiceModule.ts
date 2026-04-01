import type { DrumModule, Patch, SoundModule, TonalModule } from "../patch";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createFaceplateMainPanel, createFaceplateSection, createFaceplateSpacer, createFaceplateStackPanel } from "./faceplateSections";
import { createModuleIdentityMeta, createModuleTabShell } from "./moduleShell";
import { createModulePresetControl } from "./modulePresetControl";
import type { ModulePresetRecord } from "./persistence/modulePresetStore";
import type { TooltipBinder } from "./tooltip";
import {
  createCompactSelectField,
  createModuleRefChip,
  createRoutingCard,
  createRoutingChip,
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

function makeHeader(
  v: SoundModule,
  badgeText: string,
  params: Pick<SurfaceParams, "onPatchChange" | "onLoadModulePreset" | "onSaveModulePreset" | "modulePresetRecords" | "attachTooltip">,
  onRemove?: () => void,
) {
  const header = document.createElement("div");
  header.className = "surfaceHeader";

  const presetControl = createModulePresetControl({
    module: v,
    records: params.modulePresetRecords,
    onLoadPreset: (presetId) => params.onLoadModulePreset(v.id, presetId),
    onSavePreset: (name, overwritePresetId) => params.onSaveModulePreset(v.id, name, overwritePresetId),
    attachTooltip: params.attachTooltip,
  });

  const left = v.type === "drum"
    ? (() => {
      const drumIdentity = document.createElement("div");
      drumIdentity.className = "surfaceIdentity surfaceIdentity--canonical drumIdentity";

      const badge = document.createElement("div");
      badge.className = "surfaceBadge surfaceBadge--drumFamily";
      badge.textContent = badgeText;

      drumIdentity.append(badge, presetControl.button);
      return drumIdentity;
    })()
    : createModuleIdentityMeta({
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

function createVoiceMainLayout(primaryControls: HTMLElement[], bottomControls: HTMLElement[]) {
  const main = createFaceplateMainPanel();
  main.classList.add("voiceMainLayout");

  const primaryGrid = createFaceplateSection("controls", "voiceControlGrid voicePrimaryGrid");
  primaryGrid.append(...primaryControls);

  const bottomStrip = createFaceplateSection("bottom", "voiceControlGrid voiceBottomStrip");
  bottomStrip.append(...bottomControls);

  main.append(primaryGrid, bottomStrip, createFaceplateSpacer());
  return main;
}

function createDrumFeatureZone(d: DrumModule) {
  const feature = createFaceplateSection("feature", "drumMainFeature");

  const head = document.createElement("div");
  head.className = "drumFeatureHead";

  const title = document.createElement("div");
  title.className = "drumFeatureTitle";
  title.textContent = "Envelope";

  const summary = document.createElement("div");
  summary.className = "drumFeatureSummary small";
  summary.textContent = `Decay ${Math.round(d.decay * 100)}% · Snap ${Math.round(d.snap * 100)}% · Noise ${Math.round(d.noise * 100)}%`;

  head.append(title, summary);

  const stage = document.createElement("div");
  stage.className = "drumEnvelopeStage";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 120 52");
  svg.setAttribute("class", "drumEnvelopeGraph");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Drum envelope preview. Snap ${Math.round(d.snap * 100)} percent, decay ${Math.round(d.decay * 100)} percent, noise ${Math.round(d.noise * 100)} percent.`,
  );

  const baseline = document.createElementNS("http://www.w3.org/2000/svg", "path");
  baseline.setAttribute("class", "drumEnvelopeBaseline");

  const curve = document.createElementNS("http://www.w3.org/2000/svg", "path");
  curve.setAttribute("class", "drumEnvelopeCurve");

  const contour = document.createElementNS("http://www.w3.org/2000/svg", "path");
  contour.setAttribute("class", "drumEnvelopeContour");

  svg.append(baseline, contour, curve);

  const meter = document.createElement("div");
  meter.className = "drumFeatureMeter";

  const createMeterRow = (label: string, value: number) => {
    const row = document.createElement("div");
    row.className = "drumFeatureMeterRow";
    const rowLabel = document.createElement("span");
    rowLabel.textContent = label;
    const rowValue = document.createElement("strong");
    rowValue.textContent = `${Math.round(value * 100)}%`;
    row.append(rowLabel, rowValue);
    return row;
  };

  const transient = createMeterRow("Transient", 0);
  const body = createMeterRow("Body", 0);
  const texture = createMeterRow("Noise", 0);
  const dynamics = createMeterRow("Comp", 0);
  const boost = createMeterRow("Boost:B", 0);

  meter.append(transient, body, texture, dynamics, boost);
  stage.append(svg, meter);
  feature.append(head, stage);

  const update = (next: Pick<DrumModule, "basePitch" | "decay" | "tone" | "snap" | "noise" | "comp" | "boost" | "boostTarget">) => {
    const peak = 8 + next.snap * 13 + next.boost * 7;
    const transientTilt = next.snap * 0.55 + next.comp * 0.25;
    const knee = 20 + next.decay * 24 + next.comp * 6;
    const tail = Math.max(24, 42 - next.decay * 20 + next.comp * 4);

    summary.textContent = `Decay ${Math.round(next.decay * 100)}% · Snap ${Math.round(next.snap * 100)}% · Noise ${Math.round(next.noise * 100)}%`;
    svg.setAttribute(
      "aria-label",
      `Drum envelope preview. Snap ${Math.round(next.snap * 100)} percent, decay ${Math.round(next.decay * 100)} percent, noise ${Math.round(next.noise * 100)} percent.`,
    );
    baseline.setAttribute("d", "M 6 45 L 114 45");
    curve.setAttribute(
      "d",
      `M 8 45 C 13 ${44 - peak}, 22 ${30 - peak * transientTilt}, 30 ${14 - peak / 2} S ${knee} ${tail}, 112 45`,
    );
    contour.setAttribute(
      "d",
      `M 8 45 C 13 ${44 - peak * 0.65}, 24 ${34 - next.tone * 16}, 32 ${22 - next.noise * 8} S ${knee + 8} ${tail + 2}, 112 45`,
    );

    const updateMeter = (row: HTMLDivElement, label: string, value: number) => {
      const labelEl = row.querySelector("span");
      const valueEl = row.querySelector("strong");
      if (labelEl) labelEl.textContent = label;
      if (valueEl) valueEl.textContent = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
    };
    updateMeter(transient, "Transient", next.snap * 0.78 + next.boost * 0.22);
    updateMeter(body, "Body", next.tone * 0.72 + next.comp * 0.28);
    updateMeter(texture, "Noise", next.noise);
    updateMeter(dynamics, "Comp", next.comp);
    updateMeter(boost, `Boost:${next.boostTarget[0].toUpperCase()}`, next.boost);
  };

  update(d);
  return { feature, update };
}

function createDrumInfoBar(d: DrumModule) {
  const info = createFaceplateSection("bottom", "drumInfoBar");
  const id = document.createElement("span");
  id.className = "drumInfoToken";
  id.textContent = d.id.slice(-6).toUpperCase();

  const state = document.createElement("span");
  state.className = "drumInfoToken";
  state.textContent = d.enabled ? "ACTIVE" : "BYPASS";

  const route = document.createElement("span");
  route.className = "drumInfoToken";
  route.textContent = d.triggerSource ? `TRG ${d.triggerSource.slice(-4).toUpperCase()}` : "TRG NONE";

  const meta = document.createElement("span");
  meta.className = "drumInfoToken drumInfoToken--meta";
  meta.textContent = `C${Math.round(d.comp * 100)} B${Math.round(d.boost * 100)}:${d.boostTarget[0].toUpperCase()}`;

  info.append(id, state, route, meta);
  const update = (next: Pick<DrumModule, "enabled" | "triggerSource" | "comp" | "boost" | "boostTarget">) => {
    state.textContent = next.enabled ? "ACTIVE" : "BYPASS";
    route.textContent = next.triggerSource ? `TRG ${next.triggerSource.slice(-4).toUpperCase()}` : "TRG NONE";
    meta.textContent = `C${Math.round(next.comp * 100)} B${Math.round(next.boost * 100)}:${next.boostTarget[0].toUpperCase()}`;
  };
  return { info, update };
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
  const panelRouting = createFaceplateStackPanel("utilityPanel utilityPanel--voiceRouting");

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

  const panelSettings = createFaceplateStackPanel("surfaceSettingsPanel");

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
  const drumView: Pick<DrumModule, "basePitch" | "decay" | "tone" | "snap" | "noise" | "comp" | "boost" | "boostTarget" | "enabled" | "triggerSource"> = {
    basePitch: d.basePitch,
    decay: d.decay,
    tone: d.tone,
    snap: d.snap,
    noise: d.noise,
    comp: d.comp,
    boost: d.boost,
    boostTarget: d.boostTarget,
    enabled: d.enabled,
    triggerSource: d.triggerSource,
  };

  const surface = document.createElement("section");
  surface.className = "moduleSurface drumSurface";
  surface.dataset.type = "drum";

  const h = makeHeader(v, "DRUM", params, onRemove);
  const pitchCtl = ctlFloat({
      label: "Pitch",
      value: d.basePitch,
      min: 24,
      max: 84,
      step: 1,
      integer: true,
      onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.basePitch = x; }, { regen: false }),
    });
  const decayCtl = ctlFloat({ label: "Decay", value: d.decay, min: 0, max: 1, step: 0.001, onChange: (x) => { drumView.decay = x; drumFeature.update(drumView); onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.decay = x; }, { regen: false }); } });
  const toneCtl = ctlFloat({ label: "Tone", value: d.tone, min: 0, max: 1, step: 0.001, onChange: (x) => { drumView.tone = x; drumFeature.update(drumView); onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.tone = x; }, { regen: false }); } });
  const levelCtl = ctlFloat({ label: "Level", value: d.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.amp = x; }, { regen: false }) });
  const panCtl = ctlFloat({ label: "Pan", value: d.pan, min: -1, max: 1, step: 0.001, center: 0, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pan = x; }, { regen: false }) });
  const snapCtl = ctlFloat({ label: "Snap", value: d.snap, min: 0, max: 1, step: 0.001, onChange: (x) => { drumView.snap = x; drumFeature.update(drumView); onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.snap = x; }, { regen: false }); } });
  const noiseCtl = ctlFloat({ label: "Noise", value: d.noise, min: 0, max: 1, step: 0.001, onChange: (x) => { drumView.noise = x; drumFeature.update(drumView); onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.noise = x; }, { regen: false }); } });
  const compCtl = ctlFloat({ label: "Comp", value: d.comp, min: 0, max: 1, step: 0.001, onChange: (x) => { drumView.comp = x; drumFeature.update(drumView); drumInfo.update(drumView); onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.comp = x; }, { regen: false }); } });
  const boostCtl = ctlFloat({ label: "Boost", value: d.boost, min: 0, max: 1, step: 0.001, onChange: (x) => { drumView.boost = x; drumFeature.update(drumView); drumInfo.update(drumView); onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.boost = x; }, { regen: false }); } });

  const main = createFaceplateMainPanel();
  main.classList.add("drumMainLayout");

  const drumFeature = createDrumFeatureZone(d);
  const drumInfo = createDrumInfoBar(d);

  const primaryGrid = createFaceplateSection("controls", "voiceControlGrid drumMainPrimaryGrid");
  primaryGrid.append(pitchCtl, decayCtl, toneCtl, levelCtl);

  const characterGrid = createFaceplateSection("secondary", "voiceControlGrid drumMainSecondaryGrid");
  characterGrid.append(snapCtl, noiseCtl, compCtl, boostCtl);

  main.append(drumFeature.feature, primaryGrid, characterGrid, drumInfo.info, createFaceplateSpacer());

  const shell = createFaceTabs(ui, main, triggerOptions, controlOptions, v, routing, onRoutingChange);
  const drumSettingsGrid = createFaceplateSection("controls", "moduleKnobGrid moduleKnobGrid-2");
  drumSettingsGrid.append(panCtl);
  const boostTargetField = createCompactSelectField({
    label: "Boost target",
    options: [
      { value: "body", label: "Body" },
      { value: "attack", label: "Attack" },
      { value: "air", label: "Air" },
    ],
    selected: d.boostTarget,
    emptyLabel: "Body",
    onChange: (value) => onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === v.id);
      if (m?.type === "drum") {
        const next = value === "attack" || value === "air" ? value : "body";
        m.boostTarget = next;
        drumView.boostTarget = next;
        drumFeature.update(drumView);
        drumInfo.update(drumView);
      }
    }, { regen: false }),
  });
  shell.face.querySelector(".surfaceSettingsPanel")?.append(boostTargetField.wrap);
  shell.face.querySelector(".surfaceSettingsPanel")?.append(drumSettingsGrid);
  surface.append(h.header, shell.face, shell.tabs);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
    drumInfo.update({ ...drumView, enabled: v.enabled, triggerSource: v.triggerSource });
  };
}

export function renderSynthModuleSurface(params: SurfaceParams) {
  const { root, v, routing, onPatchChange, onRoutingChange, getLedState, triggerOptions, controlOptions, ui, onRemove } = params;
  const t = v as TonalModule;

  const surface = document.createElement("section");
  surface.className = "moduleSurface synthSurface";
  surface.dataset.type = "tonal";

  const h = makeHeader(v, "SYNTH", params, onRemove);
  const waveCtl = ctlFloat({ label: "Wave", value: t.waveform, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.waveform = x; }, { regen: false }) });
  const cutoffCtl = ctlFloat({
      label: "Cutoff",
      value: t.cutoff,
      min: 0,
      max: 1,
      step: 0.001,
      onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.cutoff = x; }, { regen: false }),
    });
  const resoCtl = ctlFloat({ label: "Reso", value: t.resonance, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.resonance = x; }, { regen: false }) });
  const attackCtl = ctlFloat({ label: "Attack", value: t.attack, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.attack = x; }, { regen: false }) });
  const decayCtl = ctlFloat({ label: "Decay", value: t.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.decay = x; }, { regen: false }) });
  const levelCtl = ctlFloat({ label: "Level", value: t.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.amp = x; }, { regen: false }) });
  const panCtl = ctlFloat({ label: "Pan", value: t.pan, min: -1, max: 1, step: 0.001, center: 0, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.pan = x; }, { regen: false }) });
  const modCtl = ctlFloat({ label: "Mod", value: t.modDepth, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modDepth = x; }, { regen: false }) });

  const main = createVoiceMainLayout([waveCtl, cutoffCtl, resoCtl], [attackCtl, levelCtl]);

  const shell = createFaceTabs(ui, main, triggerOptions, controlOptions, v, routing, onRoutingChange);
  const synthSettingsGrid = createFaceplateSection("controls", "moduleKnobGrid moduleKnobGrid-2");
  synthSettingsGrid.append(decayCtl, panCtl, modCtl);
  shell.face.querySelector(".surfaceSettingsPanel")?.append(synthSettingsGrid);
  surface.append(h.header, shell.face, shell.tabs);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
  };
}
