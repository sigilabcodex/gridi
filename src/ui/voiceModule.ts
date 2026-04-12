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
    `Drum envelope preview reacting to pitch, snap, decay, noise, comp, and boost.`,
  );

  const baseline = document.createElementNS("http://www.w3.org/2000/svg", "path");
  baseline.setAttribute("d", "M 8 48 L 148 48");
  baseline.setAttribute("class", "drumEnvelopeBaseline");
  const curve = document.createElementNS("http://www.w3.org/2000/svg", "path");
  curve.setAttribute("class", "drumEnvelopeCurve");

  const compContour = document.createElementNS("http://www.w3.org/2000/svg", "path");
  compContour.setAttribute("class", "drumEnvelopeContour");

  const noiseContour = document.createElementNS("http://www.w3.org/2000/svg", "path");
  noiseContour.setAttribute("class", "drumEnvelopeNoise");

  svg.append(baseline, noiseContour, compContour, curve);

  const side = document.createElement("div");
  side.className = "drumFeatureSide";

  const routeValue = createCompactSelectField({
    label: "Trg",
    className: "drumTrigField",
    options: [],
    selected: d.triggerSource,
    emptyLabel: "None",
    onChange: () => {},
  });

  const accentValue = document.createElement("div");
  accentValue.className = "drumFeatureSideValue drumFeatureSideValue--bias";

  side.append(routeValue.wrap, accentValue);
  stage.append(svg, side);
  feature.append(head, stage);

  const toneBiasLabel = (tone: number) => tone <= 0.33 ? "Warm" : tone >= 0.67 ? "Bright" : "Balanced";

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const update = (state: Pick<DrumModule, "basePitch" | "snap" | "decay" | "noise" | "comp" | "boost" | "tone" | "boostTarget" | "triggerSource">) => {
    const pitchNorm = clamp((state.basePitch - 24) / 60, 0, 1);
    const timeScale = 1.06 - pitchNorm * 0.24;
    const attackX = (16 - state.snap * 6) * timeScale;
    const peakY = 14 - (state.snap * 12 + state.boost * 6) - pitchNorm * 2.2;
    const bodyX = (34 + state.comp * 14) * timeScale;
    const bodyY = 20 + state.comp * 8 - state.boost * 3;
    const kneeX = (68 + state.decay * 48) * timeScale;
    const tailLift = 18 - state.decay * 12 + state.comp * 5;
    curve.setAttribute(
      "d",
      `M 8 48 C ${attackX.toFixed(2)} ${peakY.toFixed(2)}, ${bodyX.toFixed(2)} ${bodyY.toFixed(2)}, ${(48 + state.snap * 10) * timeScale} ${28 - state.boost * 8 - pitchNorm * 1.5} S ${kneeX.toFixed(2)} ${tailLift.toFixed(2)}, 148 48`,
    );
    const pitchStrokeR = Math.round(74 + pitchNorm * 30);
    const pitchStrokeG = Math.round(163 + pitchNorm * 25);
    const pitchStrokeB = Math.round(255 - pitchNorm * 22);
    const pitchGlow = (0.08 + pitchNorm * 0.22).toFixed(2);
    curve.setAttribute(
      "style",
      `stroke-width:${2 + state.boost * 1.15 + pitchNorm * 0.7};stroke:rgba(${pitchStrokeR}, ${pitchStrokeG}, ${pitchStrokeB}, 0.92);filter:drop-shadow(0 0 ${pitchGlow}rem rgba(${pitchStrokeR}, ${pitchStrokeG}, ${pitchStrokeB}, 0.45));`,
    );
    compContour.setAttribute(
      "d",
      `M 8 48 C ${(18 - state.snap * 5) * timeScale} ${24 - state.snap * 9 - pitchNorm * 1.6}, ${(44 + state.comp * 8) * timeScale} ${24 - state.comp * 10}, ${(72 + state.decay * 34) * timeScale} ${30 - state.comp * 5} S ${(126 + state.decay * 10) * timeScale} ${34 + state.comp * 5}, 148 48`,
    );
    compContour.setAttribute("style", `opacity:${0.3 + state.comp * 0.48 + pitchNorm * 0.08}`);

    const noiseAmp = 1.2 + state.noise * 5;
    const noiseStep = 10 - Math.round(pitchNorm * 3);
    const noisePoints: string[] = [];
    for (let x = 10; x <= 148; x += noiseStep) {
      const wave = Math.sin((x * (0.22 + pitchNorm * 0.06)) + state.snap * 5) * noiseAmp;
      const drift = Math.cos((x * 0.11) + state.decay * 4 + pitchNorm * 2) * (noiseAmp * 0.35);
      const y = 48 - wave - drift;
      noisePoints.push(`${x} ${y.toFixed(2)}`);
    }
    noiseContour.setAttribute("d", `M ${noisePoints.join(" L ")}`);
    noiseContour.setAttribute("style", `opacity:${0.08 + state.noise * 0.5 + pitchNorm * 0.06}`);
    accentValue.textContent = `BIAS ${toneBiasLabel(state.tone).toUpperCase()}`;
  };

  update(d);
  return { feature, update, routeField: routeValue };
}

function createDrumInfoBar(d: DrumModule) {
  const info = createFaceplateSection("bottom", "drumInfoBar");
  const id = document.createElement("span");
  id.className = "drumInfoToken";
  id.textContent = d.id.slice(-6).toUpperCase();

  const stateToken = document.createElement("span");
  stateToken.className = "drumInfoToken";
  stateToken.textContent = d.enabled ? "ACTIVE" : "BYPASS";

  const route = document.createElement("span");
  route.className = "drumInfoToken";
  route.textContent = d.triggerSource ? `TRG ${d.triggerSource.slice(-4).toUpperCase()}` : "TRG NONE";

  const meta = document.createElement("span");
  meta.className = "drumInfoToken drumInfoToken--meta";
  const focusLabel = (boostTarget: DrumModule["boostTarget"]) => boostTarget === "body" ? "LOW" : "HIGH";

  const update = (next: Pick<DrumModule, "enabled" | "triggerSource" | "comp" | "boost" | "boostTarget">) => {
    stateToken.textContent = next.enabled ? "ACTIVE" : "BYPASS";
    route.textContent = next.triggerSource ? `TRG ${next.triggerSource.slice(-4).toUpperCase()}` : "TRG NONE";
    meta.textContent = `COMP ${Math.round(next.comp * 100)} · BOOST ${Math.round(next.boost * 100)} ${focusLabel(next.boostTarget)}`;
  };

  info.append(id, stateToken, route, meta);
  update(d);
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
  const reactiveState: Pick<DrumModule, "basePitch" | "decay" | "snap" | "noise" | "comp" | "boost" | "tone" | "boostTarget" | "triggerSource"> = {
    basePitch: d.basePitch,
    decay: d.decay,
    snap: d.snap,
    noise: d.noise,
    comp: d.comp,
    boost: d.boost,
    tone: d.tone,
    boostTarget: d.boostTarget,
    triggerSource: d.triggerSource,
  };

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
      onChange: (x) => onPatchChange((p) => {
        setReactive({ basePitch: x });
        const m = p.modules.find((z) => z.id === v.id);
        if (m?.type === "drum") m.basePitch = x;
      }, { regen: false }),
    });
  const decayCtl = ctlFloat({
    label: "Decay",
    value: d.decay,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ decay: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.decay = x;
    }, { regen: false }),
  });
  const toneCtl = ctlFloat({
    label: "Tone",
    value: d.tone,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ tone: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.tone = x;
    }, { regen: false }),
  });
  const levelCtl = ctlFloat({ label: "Level", value: d.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.amp = x; }, { regen: false }) });
  const panCtl = ctlFloat({ label: "Pan", value: d.pan, min: -1, max: 1, step: 0.001, center: 0, onChange: (x) => onPatchChange((p) => { const m = p.modules.find((z) => z.id === v.id); if (m?.type === "drum") m.pan = x; }, { regen: false }) });
  const snapCtl = ctlFloat({
    label: "Snap",
    value: d.snap,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ snap: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.snap = x;
    }, { regen: false }),
  });
  const noiseCtl = ctlFloat({
    label: "Noise",
    value: d.noise,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ noise: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.noise = x;
    }, { regen: false }),
  });
  const compCtl = ctlFloat({
    label: "Comp",
    value: d.comp,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ comp: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.comp = x;
    }, { regen: false }),
  });
  const boostCtl = ctlFloat({
    label: "Boost",
    value: d.boost,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ boost: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.boost = x;
    }, { regen: false }),
  });

  const main = createFaceplateMainPanel();
  main.classList.add("drumMainLayout");

  const featureZone = createDrumFeatureZone(d);
  const syncFeatureReactive = () => {
    featureZone.update(reactiveState);
    infoBar.update({
      enabled: d.enabled,
      triggerSource: d.triggerSource,
      comp: reactiveState.comp,
      boost: reactiveState.boost,
      boostTarget: reactiveState.boostTarget,
    });
  };

  const setReactive = (partial: Partial<typeof reactiveState>) => {
    Object.assign(reactiveState, partial);
    syncFeatureReactive();
  };

  const primaryGrid = createFaceplateSection("controls", "voiceControlGrid drumMainPrimaryGrid");
  primaryGrid.append(pitchCtl, decayCtl, toneCtl, levelCtl);

  const characterGrid = createFaceplateSection("secondary", "voiceControlGrid drumMainSecondaryGrid");
  characterGrid.append(snapCtl, noiseCtl, compCtl, boostCtl);

  main.append(featureZone.feature, primaryGrid, characterGrid, createFaceplateSpacer());

  const shell = createFaceTabs(ui, main, triggerOptions, controlOptions, v, routing, (fn, opts) => {
    onRoutingChange((p) => {
      fn(p);
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") setReactive({ triggerSource: m.triggerSource });
    }, opts);
  });
  const triggerField = createCompactSelectField({
    label: "Trg",
    className: "drumTrigField",
    options: triggerOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    selected: d.triggerSource,
    emptyLabel: "None",
    onChange: (value) => onRoutingChange((p) => {
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") {
        m.triggerSource = value;
        setReactive({ triggerSource: m.triggerSource });
      }
    }, { regen: true }),
  });
  featureZone.routeField.wrap.replaceWith(triggerField.wrap);
  const drumSettingsGrid = createFaceplateSection("controls", "moduleKnobGrid moduleKnobGrid-2");
  drumSettingsGrid.append(panCtl);
  const boostTargetField = createCompactSelectField({
    label: "Focus",
    className: "drumFocusField",
    options: [
      { value: "body", label: "Low body" },
      { value: "attack", label: "High punch" },
      { value: "air", label: "High air" },
    ],
    selected: d.boostTarget,
    emptyLabel: "Body",
    onChange: (value) => onPatchChange((p) => {
      const next = value === "attack" || value === "air" ? value : "body";
      setReactive({ boostTarget: next });
      const m = p.modules.find((x) => x.id === v.id);
      if (m?.type === "drum") m.boostTarget = next;
    }, { regen: false }),
  });
  featureZone.feature.querySelector(".drumFeatureSide")?.append(boostTargetField.wrap);
  shell.face.querySelector(".surfaceSettingsPanel")?.append(drumSettingsGrid);
  const infoBar = createDrumInfoBar(d);
  surface.append(h.header, shell.face, shell.tabs, infoBar.info);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
    setReactive({
      basePitch: d.basePitch,
      decay: d.decay,
      snap: d.snap,
      noise: d.noise,
      comp: d.comp,
      boost: d.boost,
      tone: d.tone,
      boostTarget: d.boostTarget,
      triggerSource: d.triggerSource,
    });
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
