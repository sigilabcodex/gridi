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
  toggle.className = "surfaceHeaderAction";
  const syncToggle = () => {
    toggle.textContent = v.enabled ? "On" : "Off";
    toggle.classList.toggle("primary", v.enabled);
  };
  syncToggle();
  toggle.onclick = () => params.onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === v.id);
    if (m && (m.type === "drum" || m.type === "tonal")) m.enabled = !m.enabled;
  }, { regen: false });

  const btnX = document.createElement("button");
  btnX.className = "danger surfaceHeaderAction";
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
  summary.textContent = "Transient ↔ body contour";

  head.append(title, summary);

  const stage = document.createElement("div");
  stage.className = "drumEnvelopeStage";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 156 56");
  svg.setAttribute("class", "drumEnvelopeGraph");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `Drum envelope preview reacting to snap, decay, noise, comp, and boost.`,
  );

  const baseline = document.createElementNS("http://www.w3.org/2000/svg", "path");
  baseline.setAttribute("d", "M 8 48 L 148 48");
  baseline.setAttribute("class", "drumEnvelopeBaseline");

  const attackX = 16 - d.snap * 6;
  const peakY = 14 - (d.snap * 12 + d.boost * 6);
  const bodyX = 34 + d.comp * 14;
  const bodyY = 20 + d.comp * 8 - d.boost * 3;
  const kneeX = 68 + d.decay * 48;
  const tailLift = 18 - d.decay * 12 + d.comp * 5;
  const curve = document.createElementNS("http://www.w3.org/2000/svg", "path");
  curve.setAttribute("class", "drumEnvelopeCurve");
  curve.setAttribute(
    "d",
    `M 8 48 C ${attackX} ${peakY}, ${bodyX} ${bodyY}, ${48 + d.snap * 10} ${28 - d.boost * 8} S ${kneeX} ${tailLift}, 148 48`,
  );
  curve.setAttribute("style", `stroke-width:${2.1 + d.boost * 1.2}`);

  const compContour = document.createElementNS("http://www.w3.org/2000/svg", "path");
  compContour.setAttribute("class", "drumEnvelopeContour");
  compContour.setAttribute(
    "d",
    `M 8 48 C ${18 - d.snap * 5} ${24 - d.snap * 9}, ${44 + d.comp * 8} ${24 - d.comp * 10}, ${72 + d.decay * 34} ${30 - d.comp * 5} S ${126 + d.decay * 10} ${34 + d.comp * 5}, 148 48`,
  );
  compContour.setAttribute("style", `opacity:${0.34 + d.comp * 0.5}`);

  const noiseContour = document.createElementNS("http://www.w3.org/2000/svg", "path");
  noiseContour.setAttribute("class", "drumEnvelopeNoise");
  const noiseAmp = 1.2 + d.noise * 5;
  const noisePoints: string[] = [];
  for (let x = 10; x <= 148; x += 9) {
    const wave = Math.sin((x * 0.24) + d.snap * 5) * noiseAmp;
    const drift = Math.cos((x * 0.11) + d.decay * 4) * (noiseAmp * 0.35);
    const y = 48 - wave - drift;
    noisePoints.push(`${x} ${y.toFixed(2)}`);
  }
  noiseContour.setAttribute("d", `M ${noisePoints.join(" L ")}`);
  noiseContour.setAttribute("style", `opacity:${0.08 + d.noise * 0.55}`);

  svg.append(baseline, noiseContour, compContour, curve);
  stage.append(svg);
  feature.append(head, stage);
  return feature;
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
  meta.textContent = `COMP ${Math.round(d.comp * 100)} · BOOST ${Math.round(d.boost * 100)} ${d.boostTarget.toUpperCase()}`;

  info.append(id, state, route, meta);
  return info;
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
      { id: "SETTINGS", label: v.type === "drum" ? "Advanced" : "Settings", panel: panelSettings },
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
  surface.className = "moduleSurface drumSurface drumSurface--withStatus";
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
  const decayCtl = ctlFloat({ label: "Decay", value: d.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.decay = x; }, { regen: false }) });
  const toneCtl = ctlFloat({ label: "Tone", value: d.tone, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.tone = x; }, { regen: false }) });
  const levelCtl = ctlFloat({ label: "Level", value: d.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.amp = x; }, { regen: false }) });
  const panCtl = ctlFloat({ label: "Pan", value: d.pan, min: -1, max: 1, step: 0.001, center: 0, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pan = x; }, { regen: false }) });
  const snapCtl = ctlFloat({ label: "Snap", value: d.snap, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.snap = x; }, { regen: false }) });
  const noiseCtl = ctlFloat({ label: "Noise", value: d.noise, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.noise = x; }, { regen: false }) });
  const compCtl = ctlFloat({ label: "Comp", value: d.comp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.comp = x; }, { regen: false }) });
  const boostCtl = ctlFloat({ label: "Boost", value: d.boost, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.boost = x; }, { regen: false }) });

  const main = createFaceplateMainPanel();
  main.classList.add("drumMainLayout");

  const feature = createDrumFeatureZone(d);

  const primaryGrid = createFaceplateSection("controls", "voiceControlGrid drumMainPrimaryGrid");
  primaryGrid.append(pitchCtl, decayCtl, toneCtl, levelCtl);

  const characterGrid = createFaceplateSection("secondary", "voiceControlGrid drumMainSecondaryGrid");
  characterGrid.append(snapCtl, noiseCtl, compCtl, boostCtl);

  main.append(feature, primaryGrid, characterGrid, createFaceplateSpacer());

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
      if (m?.type === "drum") m.boostTarget = value === "attack" || value === "air" ? value : "body";
    }, { regen: false }),
  });
  shell.face.querySelector(".surfaceSettingsPanel")?.append(boostTargetField.wrap);
  shell.face.querySelector(".surfaceSettingsPanel")?.append(drumSettingsGrid);
  surface.append(h.header, shell.face, shell.tabs, createDrumInfoBar(d));
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
