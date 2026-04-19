import type { DrumModule, Patch, SoundModule, TonalModule } from "../patch";
import { normalizeDrumChannelMode } from "../patch";
import { ctlFloat } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createFaceplateMainPanel, createFaceplateSection, createFaceplateSpacer, createFaceplateStackPanel } from "./faceplateSections";
import { createModuleTabShell } from "./moduleShell";
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

  const left = (() => {
    const identity = document.createElement("div");
    identity.className = "surfaceIdentity surfaceIdentity--canonical drumIdentity";

    const badge = document.createElement("div");
    badge.className = `surfaceBadge ${v.type === "drum" ? "surfaceBadge--drumFamily" : "surfaceBadge--synthFamily"}`;
    badge.textContent = badgeText;

    identity.append(badge, presetControl.button);
    return identity;
  })();

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

function createDrumFeatureZone(d: DrumModule) {
  const feature = createFaceplateSection("feature", "drumMainFeature");

  const stage = document.createElement("div");
  stage.className = "drumEnvelopeStage";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 156 56");
  svg.setAttribute("class", "drumEnvelopeGraph");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    "Drum behavior preview reacting to envelope, pitch bend, tone, drive, compression, boost, level, and pan bias.",
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

  const toneTilt = document.createElementNS("http://www.w3.org/2000/svg", "path");
  toneTilt.setAttribute("class", "drumEnvelopeToneTilt");

  const driveGhost = document.createElementNS("http://www.w3.org/2000/svg", "path");
  driveGhost.setAttribute("class", "drumEnvelopeDriveGhost");

  const panField = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  panField.setAttribute("class", "drumEnvelopePanField");
  panField.setAttribute("cx", "128");
  panField.setAttribute("cy", "13");
  panField.setAttribute("r", "10");

  const panMarker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  panMarker.setAttribute("class", "drumEnvelopePanMarker");
  panMarker.setAttribute("r", "2.6");

  svg.append(toneTilt, baseline, panField, noiseContour, compContour, driveGhost, curve, panMarker);

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
  const channelValue = createCompactSelectField({
    label: "Chan",
    className: "drumChannelField",
    includeEmptyOption: false,
    options: [
      { value: "auto", label: "AU" },
      { value: "01", label: "01" },
      { value: "02", label: "02" },
      { value: "03", label: "03" },
      { value: "04", label: "04" },
      { value: "05", label: "05" },
      { value: "06", label: "06" },
      { value: "07", label: "07" },
      { value: "08", label: "08" },
    ],
    selected: normalizeDrumChannelMode(d.drumChannel),
    onChange: () => {},
  });

  side.append(routeValue.wrap, channelValue.wrap);
  stage.append(svg, side);
  feature.append(stage);

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  const update = (state: Pick<DrumModule, "basePitch" | "attack" | "snap" | "decay" | "noise" | "comp" | "compThreshold" | "compRatio" | "compAttack" | "compRelease" | "boost" | "tone" | "bodyTone" | "pitchEnvAmt" | "bendDecay" | "amp" | "panBias" | "stereoWidth" | "boostTarget" | "triggerSource" | "drumChannel">) => {
    const pitchNorm = clamp(state.basePitch, 0, 1);
    const attackNorm = clamp(state.attack, 0, 1);
    const driveNorm = clamp(state.bodyTone, 0, 1);
    const bendNorm = clamp(state.pitchEnvAmt, 0, 1);
    const bendDecayNorm = clamp(state.bendDecay, 0, 1);
    const levelNorm = clamp(state.amp, 0, 1);
    const panNorm = clamp(state.panBias, -1, 1);
    const widthNorm = clamp(state.stereoWidth, 0, 1);
    const compShape = clamp(state.comp * (0.45 + state.compRatio * 0.35 + state.compAttack * 0.08 + state.compRelease * 0.12), 0, 1);
    const timeScale = 1.06 - pitchNorm * 0.24;
    const attackX = (13 + attackNorm * 18 - state.snap * 5) * timeScale;
    const peakY = 12 - (state.snap * 10 + state.boost * 5) - pitchNorm * 2 - levelNorm * 4;
    const bodyX = (36 + compShape * 16 + bendNorm * 8) * timeScale;
    const bodyY = 19 + compShape * 7 - state.boost * 4 + driveNorm * 1.8;
    const kneeX = (68 + state.decay * 48) * timeScale;
    const tailLift = 17 - state.decay * 12 + compShape * 6 + bendDecayNorm * 2;
    const bendWarpY = 28 - state.boost * 7 - pitchNorm * 1.5 - bendNorm * 5 + bendDecayNorm * 3;
    curve.setAttribute(
      "d",
      `M 8 48 C ${attackX.toFixed(2)} ${peakY.toFixed(2)}, ${bodyX.toFixed(2)} ${bodyY.toFixed(2)}, ${(48 + state.snap * 10 + bendNorm * 8) * timeScale} ${bendWarpY.toFixed(2)} S ${kneeX.toFixed(2)} ${tailLift.toFixed(2)}, 148 48`,
    );
    const pitchStrokeR = Math.round(199 + pitchNorm * 20);
    const pitchStrokeG = Math.round(107 + pitchNorm * 14);
    const pitchStrokeB = Math.round(120 - pitchNorm * 12);
    const pitchGlow = (0.08 + pitchNorm * 0.22).toFixed(2);
    curve.setAttribute(
      "style",
      `stroke-width:${1.85 + state.boost * 1 + pitchNorm * 0.6 + driveNorm * 0.7};stroke:rgba(${pitchStrokeR}, ${pitchStrokeG}, ${pitchStrokeB}, ${0.78 + levelNorm * 0.22});filter:drop-shadow(0 0 ${pitchGlow}rem rgba(${pitchStrokeR}, ${pitchStrokeG}, ${pitchStrokeB}, 0.45));`,
    );
    compContour.setAttribute(
      "d",
      `M 8 48 C ${(18 - state.snap * 4 + attackNorm * 4) * timeScale} ${24 - state.snap * 8 - pitchNorm * 1.6}, ${(44 + compShape * 10) * timeScale} ${24 - compShape * (8 + state.compThreshold * 5)}, ${(72 + state.decay * 34) * timeScale} ${30 - compShape * (4 + state.compThreshold * 4)} S ${(126 + state.decay * 10) * timeScale} ${34 + compShape * 6}, 148 48`,
    );
    compContour.setAttribute("style", `opacity:${0.24 + compShape * 0.56 + pitchNorm * 0.08}`);

    const toneSkew = (state.tone - 0.5) * 12;
    toneTilt.setAttribute("d", `M 8 ${(10 - toneSkew).toFixed(2)} L 148 ${(10 + toneSkew).toFixed(2)}`);
    const toneBias = (state.tone - 0.5) * 2;
    const toneOpacity = 0.16 + Math.abs(toneBias) * 0.26;
    const toneR = Math.round(120 + state.tone * 96);
    const toneG = Math.round(144 + state.tone * 84);
    const toneB = Math.round(170 + state.tone * 68);
    toneTilt.setAttribute(
      "style",
      `stroke:rgba(${toneR}, ${toneG}, ${toneB}, ${toneOpacity.toFixed(2)});stroke-width:${0.9 + Math.abs(toneBias) * 0.9};`,
    );
    svg.style.filter = `hue-rotate(${Math.round(toneBias * 10)}deg) brightness(${(0.97 + Math.abs(toneBias) * 0.08).toFixed(2)})`;

    const driveJitter = 1.2 + driveNorm * 5;
    driveGhost.setAttribute(
      "d",
      `M 8 48 C ${(attackX + 4).toFixed(2)} ${(peakY + driveJitter).toFixed(2)}, ${(bodyX + 2).toFixed(2)} ${(bodyY - driveJitter * 0.8).toFixed(2)}, ${(52 + state.snap * 8) * timeScale} ${(bendWarpY + driveJitter).toFixed(2)} S ${(kneeX + 3).toFixed(2)} ${(tailLift + driveJitter * 0.7).toFixed(2)}, 148 48`,
    );
    driveGhost.setAttribute("style", `opacity:${0.08 + driveNorm * 0.34};stroke-width:${1 + driveNorm * 1.2}`);

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

    const panFieldRadius = 7 + widthNorm * 6;
    panField.setAttribute("r", panFieldRadius.toFixed(2));
    panField.setAttribute("style", `opacity:${0.24 + widthNorm * 0.38};stroke-width:${1 + widthNorm * 0.7}`);
    panMarker.setAttribute("cx", (128 + panNorm * panFieldRadius).toFixed(2));
    panMarker.setAttribute("cy", "13");
    panMarker.setAttribute("style", `opacity:${0.56 + Math.abs(panNorm) * 0.38};stroke-width:${0.9 + widthNorm * 0.5}`);
    const channelMode = normalizeDrumChannelMode(state.drumChannel);
    channelValue.select.value = channelMode;
  };

  update(d);
  return { feature, update, routeField: routeValue, channelField: channelValue };
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
  route.textContent = d.triggerSource ? `SRC ${d.triggerSource.slice(-4).toUpperCase()}` : "SRC NONE";

  const meta = document.createElement("span");
  meta.className = "drumInfoToken drumInfoToken--meta";
  const focusLabel = (boostTarget: DrumModule["boostTarget"]) => boostTarget === "body" ? "LOW" : "HIGH";

  const update = (next: Pick<DrumModule, "enabled" | "triggerSource" | "comp" | "boost" | "boostTarget">) => {
    stateToken.textContent = next.enabled ? "ACTIVE" : "BYPASS";
    route.textContent = next.triggerSource ? `SRC ${next.triggerSource.slice(-4).toUpperCase()}` : "SRC NONE";
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
      { id: "SETTINGS", label: "Advanced", panel: panelSettings },
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
  const DRUM_PITCH_MIN = 24;
  const DRUM_PITCH_MAX = 84;
  const DRUM_PITCH_SPAN = DRUM_PITCH_MAX - DRUM_PITCH_MIN;
  const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
  const pitchNormToMidi = (value: number) => DRUM_PITCH_MIN + clamp01(value) * DRUM_PITCH_SPAN;
  const pitchMidiToNorm = (value: number) => clamp01((value - DRUM_PITCH_MIN) / DRUM_PITCH_SPAN);
  const reactiveState: Pick<DrumModule, "basePitch" | "attack" | "decay" | "snap" | "noise" | "comp" | "compThreshold" | "compRatio" | "compAttack" | "compRelease" | "boost" | "tone" | "bodyTone" | "pitchEnvAmt" | "bendDecay" | "amp" | "panBias" | "stereoWidth" | "boostTarget" | "triggerSource" | "drumChannel"> = {
    basePitch: d.basePitch,
    attack: d.attack,
    decay: d.decay,
    snap: d.snap,
    noise: d.noise,
    comp: d.comp,
    compThreshold: d.compThreshold,
    compRatio: d.compRatio,
    compAttack: d.compAttack,
    compRelease: d.compRelease,
    boost: d.boost,
    tone: d.tone,
    bodyTone: d.bodyTone,
    pitchEnvAmt: d.pitchEnvAmt,
    bendDecay: d.bendDecay,
    amp: d.amp,
    panBias: d.panBias,
    stereoWidth: d.stereoWidth,
    boostTarget: d.boostTarget,
    triggerSource: d.triggerSource,
    drumChannel: normalizeDrumChannelMode(d.drumChannel),
  };

  const surface = document.createElement("section");
  surface.className = "moduleSurface drumSurface drumSurface--withStatus";
  surface.dataset.type = "drum";

  const h = makeHeader(v, "DRUM", params, onRemove);
  const pitchCtl = ctlFloat({
      label: "Pitch",
      value: pitchNormToMidi(d.basePitch),
      min: DRUM_PITCH_MIN,
      max: DRUM_PITCH_MAX,
      step: 1,
      integer: true,
      format: (x) => String(Math.round(x)),
      onChange: (x) => onPatchChange((p) => {
        const normalizedPitch = pitchMidiToNorm(x);
        setReactive({ basePitch: normalizedPitch });
        const m = p.modules.find((z) => z.id === v.id);
        if (m?.type === "drum") m.basePitch = normalizedPitch;
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
  const levelCtl = ctlFloat({
    label: "Level",
    value: d.amp,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ amp: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.amp = x;
    }, { regen: false }),
  });
  const attackCtl = ctlFloat({
    label: "Attack",
    value: d.attack,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ attack: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.attack = x;
    }, { regen: false }),
  });
  const bendCtl = ctlFloat({
    label: "Bend",
    value: d.pitchEnvAmt,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ pitchEnvAmt: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.pitchEnvAmt = x;
    }, { regen: false }),
  });
  const compThresholdCtl = ctlFloat({
    label: "Threshold",
    value: d.compThreshold,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ compThreshold: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.compThreshold = x;
    }, { regen: false }),
  });
  const compRatioCtl = ctlFloat({
    label: "Ratio",
    value: d.compRatio,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ compRatio: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.compRatio = x;
    }, { regen: false }),
  });
  const compAttackCtl = ctlFloat({
    label: "Cmp Atk",
    value: d.compAttack,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ compAttack: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.compAttack = x;
    }, { regen: false }),
  });
  const compReleaseCtl = ctlFloat({
    label: "Cmp Rel",
    value: d.compRelease,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ compRelease: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.compRelease = x;
    }, { regen: false }),
  });
  const stereoWidthCtl = ctlFloat({
    label: "Width",
    value: d.stereoWidth,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ stereoWidth: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.stereoWidth = x;
    }, { regen: false }),
  });
  const driveColorCtl = ctlFloat({
    label: "Drv Clr",
    value: d.driveColor,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.driveColor = x;
    }, { regen: false }),
  });
  const panCtl = ctlFloat({
    label: "Pan",
    value: d.panBias,
    min: -1,
    max: 1,
    step: 0.001,
    center: 0,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ panBias: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") {
        m.panBias = x;
        m.pan = x;
      }
    }, { regen: false }),
  });
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
  const driveCtl = ctlFloat({
    label: "Drive",
    value: d.bodyTone,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ bodyTone: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.bodyTone = x;
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
  primaryGrid.append(pitchCtl, decayCtl, toneCtl, levelCtl, attackCtl, bendCtl);

  const characterGrid = createFaceplateSection("secondary", "voiceControlGrid drumMainSecondaryGrid");
  characterGrid.append(snapCtl, noiseCtl, compCtl, boostCtl, panCtl, driveCtl);

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
  featureZone.channelField.select.onchange = () => onPatchChange((p) => {
    const nextChannel = normalizeDrumChannelMode(featureZone.channelField.select.value);
    setReactive({ drumChannel: nextChannel });
    const m = p.modules.find((x) => x.id === v.id);
    if (m?.type === "drum") m.drumChannel = nextChannel;
  }, { regen: true });
  const drumSettingsPanel = createFaceplateSection("controls", "drumAdvancedPanel");

  const compKneeCtl = ctlFloat({
    label: "Knee",
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
  const driveAliasCtl = ctlFloat({
    label: "Drive",
    value: d.bodyTone,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ bodyTone: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.bodyTone = x;
    }, { regen: false }),
  });
  const driveClipCtl = ctlFloat({
    label: "Clip",
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
  const driveSymmetryCtl = ctlFloat({
    label: "Symmetry",
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
  const stereoSpreadCtl = ctlFloat({
    label: "Spread",
    value: d.panBias,
    min: -1,
    max: 1,
    step: 0.001,
    center: 0,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ panBias: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") {
        m.panBias = x;
        m.pan = x;
      }
    }, { regen: false }),
  });
  const stereoMonoLowCtl = ctlFloat({
    label: "Mono low",
    value: d.compThreshold,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ compThreshold: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") m.compThreshold = x;
    }, { regen: false }),
  });
  const behaviorBendCurveCtl = ctlFloat({
    label: "Bend curve",
    value: d.bendDecay,
    min: 0,
    max: 1,
    step: 0.001,
    onChange: (x) => onPatchChange((p) => {
      setReactive({ bendDecay: x });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "drum") {
        m.bendDecay = x;
        m.pitchEnvDecay = x;
      }
    }, { regen: false }),
  });
  const behaviorSnapModeCtl = ctlFloat({
    label: "Snap mode",
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
  const behaviorNoiseColorCtl = ctlFloat({
    label: "Noise color",
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

  const drumAdvancedHeaders = document.createElement("div");
  drumAdvancedHeaders.className = "drumAdvancedHeaders";
  const createAdvancedHeader = (label: string, col: number) => {
    const header = document.createElement("span");
    header.className = "drumAdvancedHeader";
    header.textContent = label;
    header.style.gridColumn = `${col} / span 1`;
    return header;
  };
  drumAdvancedHeaders.append(
    createAdvancedHeader("COMP", 1),
    createAdvancedHeader("DRIVE", 4),
    createAdvancedHeader("STEREO", 5),
    createAdvancedHeader("BEHAV", 6),
  );

  const drumAdvancedGrid = document.createElement("div");
  drumAdvancedGrid.className = "drumAdvancedGrid";
  const orderedControls: Array<HTMLElement | null> = [
    compThresholdCtl,
    compRatioCtl,
    compAttackCtl,
    driveAliasCtl,
    driveColorCtl,
    driveSymmetryCtl,
    compReleaseCtl,
    compKneeCtl,
    driveClipCtl,
    stereoWidthCtl,
    stereoMonoLowCtl,
    stereoSpreadCtl,
    behaviorBendCurveCtl,
    behaviorSnapModeCtl,
    behaviorNoiseColorCtl,
    boostTargetField.wrap,
    null,
  ];
  orderedControls.forEach((control) => {
    if (control) {
      drumAdvancedGrid.append(control);
      return;
    }
    const empty = document.createElement("div");
    empty.className = "drumAdvancedEmptySlot";
    empty.setAttribute("aria-hidden", "true");
    drumAdvancedGrid.append(empty);
  });
  drumSettingsPanel.append(drumAdvancedHeaders, drumAdvancedGrid);
  shell.face.querySelector(".surfaceSettingsPanel")?.append(drumSettingsPanel);
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
      attack: d.attack,
      decay: d.decay,
      snap: d.snap,
      noise: d.noise,
      comp: d.comp,
      compThreshold: d.compThreshold,
      compRatio: d.compRatio,
      compAttack: d.compAttack,
      compRelease: d.compRelease,
      boost: d.boost,
      tone: d.tone,
      bodyTone: d.bodyTone,
      pitchEnvAmt: d.pitchEnvAmt,
      bendDecay: d.bendDecay,
      amp: d.amp,
      panBias: d.panBias,
      stereoWidth: d.stereoWidth,
      boostTarget: d.boostTarget,
      triggerSource: d.triggerSource,
      drumChannel: normalizeDrumChannelMode(d.drumChannel),
    });
  };
}

export function renderSynthModuleSurface(params: SurfaceParams) {
  const { root, v, routing, onPatchChange, onRoutingChange, getLedState, triggerOptions, controlOptions, ui, onRemove } = params;
  const t = v as TonalModule;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const reactiveState: Pick<TonalModule, "waveform" | "cutoff" | "resonance" | "attack" | "decay" | "amp" | "modDepth" | "glide" | "fineTune" | "modRate" | "coarseTune" | "pan" | "sustain" | "release" | "triggerSource" | "reception"> = {
    waveform: t.waveform,
    cutoff: t.cutoff,
    resonance: t.resonance,
    attack: t.attack,
    decay: t.decay,
    amp: t.amp,
    modDepth: t.modDepth,
    glide: t.glide,
    fineTune: t.fineTune,
    modRate: t.modRate,
    coarseTune: t.coarseTune,
    pan: t.pan,
    sustain: t.sustain,
    release: t.release,
    triggerSource: t.triggerSource,
    reception: t.reception,
  };

  const surface = document.createElement("section");
  surface.className = "moduleSurface synthSurface synthSurface--withStatus";
  surface.dataset.type = "tonal";

  const h = makeHeader(v, "SYNTH", params, onRemove);
  const pitchMapProfiles = [
    { value: "BASS", label: "Bass", coarseTune: 0.14, fineTune: 0.42 },
    { value: "SEQ", label: "Seq", coarseTune: 0.34, fineTune: 0.5 },
    { value: "LEAD", label: "Lead", coarseTune: 0.57, fineTune: 0.58 },
    { value: "CHROM", label: "Chrom", coarseTune: 0.84, fineTune: 0.5 },
  ] as const;
  const articulationProfiles = [
    { value: "PLUCK", label: "Pluck", attack: 0.06, decay: 0.32, sustain: 0.24, release: 0.26 },
    { value: "STAB", label: "Stab", attack: 0.14, decay: 0.44, sustain: 0.38, release: 0.32 },
    { value: "HOLD", label: "Hold", attack: 0.22, decay: 0.5, sustain: 0.68, release: 0.56 },
    { value: "PAD", label: "Pad", attack: 0.54, decay: 0.66, sustain: 0.82, release: 0.9 },
  ] as const;
  const nearestPitchMap = (state: Pick<typeof reactiveState, "coarseTune" | "fineTune">) => {
    let best: string = pitchMapProfiles[0].value;
    let bestDist = Number.POSITIVE_INFINITY;
    pitchMapProfiles.forEach((profile) => {
      const dist = Math.abs(profile.coarseTune - state.coarseTune) + Math.abs(profile.fineTune - state.fineTune) * 0.6;
      if (dist < bestDist) {
        bestDist = dist;
        best = profile.value;
      }
    });
    return best;
  };
  const nearestArticulation = (state: Pick<typeof reactiveState, "attack" | "decay" | "sustain" | "release">) => {
    let best: string = articulationProfiles[0].value;
    let bestDist = Number.POSITIVE_INFINITY;
    articulationProfiles.forEach((profile) => {
      const dist = Math.abs(profile.attack - state.attack) + Math.abs(profile.decay - state.decay) + Math.abs(profile.sustain - state.sustain) + Math.abs(profile.release - state.release);
      if (dist < bestDist) {
        bestDist = dist;
        best = profile.value;
      }
    });
    return best;
  };
  const triggerSourceField = createCompactSelectField({
    label: "Trg",
    className: "synthHeaderSelect",
    options: triggerOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    selected: t.triggerSource,
    emptyLabel: "None",
    onChange: (value) => onRoutingChange((p) => {
      const m = p.modules.find((x) => x.id === v.id);
      if (m?.type === "tonal") {
        m.triggerSource = value;
        setReactive({ triggerSource: value });
      }
    }, { regen: true }),
  });
  const receptionModeField = createCompactSelectField({
    label: "Recv",
    className: "synthHeaderSelect",
    includeEmptyOption: false,
    options: [
      { value: "mono", label: "Mono" },
      { value: "poly", label: "Poly" },
    ],
    selected: reactiveState.reception,
    onChange: (value) => onPatchChange((p) => {
      const nextReception = value === "poly" ? "poly" : "mono";
      setReactive({ reception: nextReception });
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "tonal") m.reception = nextReception;
    }, { regen: false }),
  });
  const pitchMapField = createCompactSelectField({
    label: "Pitch",
    className: "routingInlineCard",
    includeEmptyOption: false,
    options: pitchMapProfiles.map((profile) => ({ value: profile.value, label: profile.label })),
    selected: nearestPitchMap(reactiveState),
    onChange: (value) => {
      if (!value) return;
      const profile = pitchMapProfiles.find((entry) => entry.value === value);
      if (!profile) return;
      onPatchChange((p) => {
        setReactive({ coarseTune: profile.coarseTune, fineTune: profile.fineTune });
        const m = p.modules.find((z) => z.id === v.id);
        if (m?.type === "tonal") {
          m.coarseTune = profile.coarseTune;
          m.fineTune = profile.fineTune;
        }
      }, { regen: false });
    },
  });
  const articulationField = createCompactSelectField({
    label: "Artic",
    className: "routingInlineCard",
    includeEmptyOption: false,
    options: articulationProfiles.map((profile) => ({ value: profile.value, label: profile.label })),
    selected: nearestArticulation(reactiveState),
    onChange: (value) => {
      if (!value) return;
      const profile = articulationProfiles.find((entry) => entry.value === value);
      if (!profile) return;
      onPatchChange((p) => {
        setReactive({ attack: profile.attack, decay: profile.decay, sustain: profile.sustain, release: profile.release });
        const m = p.modules.find((z) => z.id === v.id);
        if (m?.type === "tonal") {
          m.attack = profile.attack;
          m.decay = profile.decay;
          m.sustain = profile.sustain;
          m.release = profile.release;
        }
      }, { regen: false });
    },
  });
  const synthFeatureZone = (() => {
    const feature = createFaceplateSection("feature", "synthMainFeature");

    const stage = document.createElement("div");
    stage.className = "synthBehaviorStage";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 156 56");
    svg.setAttribute("class", "synthBehaviorGraph");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Synth behavior preview showing waveform shape, cutoff position, envelope contour, and stereo field indicator.");
    const baseline = document.createElementNS("http://www.w3.org/2000/svg", "path");
    baseline.setAttribute("d", "M 8 48 L 148 48");
    baseline.setAttribute("class", "synthBehaviorBaseline");
    const waveform = document.createElementNS("http://www.w3.org/2000/svg", "path");
    waveform.setAttribute("class", "synthBehaviorWave");
    const envelope = document.createElementNS("http://www.w3.org/2000/svg", "path");
    envelope.setAttribute("class", "synthBehaviorEnvelope");
    const cutoffLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
    cutoffLine.setAttribute("class", "synthBehaviorCutoff");
    const spreadField = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    spreadField.setAttribute("class", "synthBehaviorSpreadField");
    spreadField.setAttribute("cx", "128");
    spreadField.setAttribute("cy", "11");
    spreadField.setAttribute("rx", "9");
    spreadField.setAttribute("ry", "4");
    const spreadAxis = document.createElementNS("http://www.w3.org/2000/svg", "line");
    spreadAxis.setAttribute("class", "synthBehaviorSpreadAxis");
    spreadAxis.setAttribute("x1", "128");
    spreadAxis.setAttribute("y1", "8");
    spreadAxis.setAttribute("x2", "128");
    spreadAxis.setAttribute("y2", "14");
    const spreadMarker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    spreadMarker.setAttribute("class", "synthBehaviorSpreadMarker");
    spreadMarker.setAttribute("r", "2.5");
    svg.append(spreadField, spreadAxis, baseline, cutoffLine, envelope, waveform, spreadMarker);
    const side = document.createElement("div");
    side.className = "synthFeatureSide";
    side.append(triggerSourceField.wrap, receptionModeField.wrap);
    stage.append(svg, side);
    feature.append(stage);

    let spreadRadiusX = 9;
    let isDraggingPan = false;
    let isDraggingSpread = false;

    const stopDragging = () => {
      isDraggingPan = false;
      isDraggingSpread = false;
    };

    const toLocalX = (event: PointerEvent) => {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = svg.getScreenCTM();
      if (!matrix) return 128;
      return point.matrixTransform(matrix.inverse()).x;
    };

    const update = (state: typeof reactiveState) => {
      const waveMix = clamp(state.waveform, 0, 1);
      const cutoffNorm = clamp(state.cutoff, 0, 1);
      const resoNorm = clamp(state.resonance, 0, 1);
      const attackNorm = clamp(state.attack, 0, 1);
      const decayNorm = clamp(state.decay, 0, 1);
      const driveNorm = clamp(state.modDepth, 0, 1);
      const spreadNorm = clamp(state.glide, 0, 1);
      const panNorm = clamp(state.pan, -1, 1);
      const levelNorm = clamp(state.amp, 0, 1);

      const wavePoints: string[] = [];
      for (let x = 8; x <= 148; x += 6) {
        const phase = (x - 8) / 140;
        const sine = Math.sin((phase * Math.PI * 2) + driveNorm * 1.2);
        const square = sine >= 0 ? 1 : -1;
        const tri = 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
        const mixed = sine * (1 - waveMix) + tri * waveMix * 0.55 + square * driveNorm * 0.45;
        const y = 27 - mixed * (8 + resoNorm * 6);
        wavePoints.push(`${x} ${y.toFixed(2)}`);
      }
      waveform.setAttribute("d", `M ${wavePoints.join(" L ")}`);
      waveform.setAttribute("style", `opacity:${0.55 + levelNorm * 0.35};stroke-width:${1.2 + driveNorm * 0.9}`);

      const attackX = 11 + attackNorm * 24;
      const sustainX = 62 + decayNorm * 40;
      const sustainY = 24 + (1 - clamp(state.sustain, 0, 1)) * 14;
      const releaseY = 44 + clamp(state.release, 0, 1) * 3;
      envelope.setAttribute(
        "d",
        `M 8 48 L ${attackX.toFixed(2)} ${(12 - levelNorm * 5).toFixed(2)} Q ${(sustainX - 9).toFixed(2)} ${sustainY.toFixed(2)} ${sustainX.toFixed(2)} ${sustainY.toFixed(2)} T 138 ${releaseY.toFixed(2)} L 148 48`,
      );
      envelope.setAttribute("style", `opacity:${0.28 + decayNorm * 0.42};stroke-width:${1 + attackNorm * 0.8}`);

      const cutoffX = 18 + cutoffNorm * 118;
      cutoffLine.setAttribute("d", `M ${cutoffX.toFixed(2)} 10 L ${cutoffX.toFixed(2)} 48`);
      cutoffLine.setAttribute("style", `opacity:${0.28 + cutoffNorm * 0.54};stroke-width:${1 + resoNorm * 1.2}`);

      spreadRadiusX = 7 + spreadNorm * 16;
      const spreadRadiusY = 3 + spreadNorm * 4.5;
      spreadField.setAttribute("rx", spreadRadiusX.toFixed(2));
      spreadField.setAttribute("ry", spreadRadiusY.toFixed(2));
      spreadField.setAttribute("style", `opacity:${0.3 + spreadNorm * 0.52};stroke-width:${1 + spreadNorm * 0.85}`);
      spreadMarker.setAttribute("cx", (128 + panNorm * spreadRadiusX).toFixed(2));
      spreadMarker.setAttribute("cy", "11");
      spreadMarker.setAttribute("style", `opacity:${0.62 + Math.abs(panNorm) * 0.32};stroke-width:${0.9 + spreadNorm * 0.35}`);
    };

    const bindInteractions = (handlers: { onPan: (next: number) => void; onSpread: (next: number) => void }) => {
      spreadMarker.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        isDraggingPan = true;
        spreadMarker.setPointerCapture(event.pointerId);
      });

      spreadField.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        isDraggingSpread = true;
        spreadField.setPointerCapture(event.pointerId);
      });

      svg.addEventListener("pointermove", (event) => {
        if (!isDraggingPan && !isDraggingSpread) return;
        const localX = toLocalX(event);
        const normalizedX = clamp((localX - 128) / 23, -1, 1);
        if (isDraggingPan) handlers.onPan(normalizedX);
        if (isDraggingSpread) handlers.onSpread(clamp(Math.abs(normalizedX), 0, 1));
      });

      svg.addEventListener("pointerup", stopDragging);
      svg.addEventListener("pointercancel", stopDragging);
      svg.addEventListener("lostpointercapture", stopDragging);
    };

    update(reactiveState);
    return { feature, update, bindInteractions };
  })();

  const setReactive = (partial: Partial<typeof reactiveState>) => {
    Object.assign(reactiveState, partial);
    synthFeatureZone.update(reactiveState);
    triggerSourceField.select.value = reactiveState.triggerSource ?? "";
    receptionModeField.select.value = reactiveState.reception;
    pitchMapField.select.value = nearestPitchMap(reactiveState);
    articulationField.select.value = nearestArticulation(reactiveState);
    synthInfo.update({
      enabled: t.enabled,
      triggerSource: reactiveState.triggerSource,
      cutoff: reactiveState.cutoff,
      resonance: reactiveState.resonance,
      waveform: reactiveState.waveform,
      reception: reactiveState.reception,
    });
  };

  const waveCtl = ctlFloat({ label: "Wave", value: t.waveform, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ waveform: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.waveform = x; }, { regen: false }) });
  const cutoffCtl = ctlFloat({ label: "Cutoff", value: t.cutoff, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ cutoff: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.cutoff = x; }, { regen: false }) });
  const resoCtl = ctlFloat({ label: "Reso", value: t.resonance, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ resonance: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.resonance = x; }, { regen: false }) });
  const attackCtl = ctlFloat({ label: "Attack", value: t.attack, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ attack: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.attack = x; }, { regen: false }) });
  const decayCtl = ctlFloat({ label: "Decay", value: t.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ decay: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.decay = x; }, { regen: false }) });
  const levelCtl = ctlFloat({ label: "Level", value: t.amp, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ amp: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.amp = x; }, { regen: false }) });
  const driveCtl = ctlFloat({ label: "Drive", value: t.modDepth, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ modDepth: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modDepth = x; }, { regen: false }) });
  const spreadCtl = ctlFloat({ label: "Spread", value: t.glide, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ glide: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.glide = x; }, { regen: false }) });
  const driftCtl = ctlFloat({ label: "Drift", value: t.fineTune, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ fineTune: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.fineTune = x; }, { regen: false }) });
  const fmCtl = ctlFloat({ label: "FM", value: t.modRate, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ modRate: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modRate = x; }, { regen: false }) });
  const noiseCtl = ctlFloat({ label: "Noise", value: t.coarseTune, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ coarseTune: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.coarseTune = x; }, { regen: false }) });
  const panCtl = ctlFloat({ label: "Pan", value: t.pan, min: -1, max: 1, step: 0.001, center: 0, onChange: (x) => onPatchChange((p) => { setReactive({ pan: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.pan = x; }, { regen: false }) });

  synthFeatureZone.bindInteractions({
    onPan: (nextPan) => onPatchChange((p) => {
      setReactive({ pan: nextPan });
      panCtl.syncValue?.(nextPan);
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "tonal") m.pan = nextPan;
    }, { regen: false }),
    onSpread: (nextSpread) => onPatchChange((p) => {
      setReactive({ glide: nextSpread });
      spreadCtl.syncValue?.(nextSpread);
      const m = p.modules.find((z) => z.id === v.id);
      if (m?.type === "tonal") m.glide = nextSpread;
    }, { regen: false }),
  });

  const main = createFaceplateMainPanel();
  main.classList.add("synthMainLayout");
  const primaryGrid = createFaceplateSection("controls", "voiceControlGrid synthMainPrimaryGrid");
  primaryGrid.append(waveCtl, cutoffCtl, resoCtl, attackCtl, decayCtl, levelCtl, driveCtl, spreadCtl, driftCtl, fmCtl, noiseCtl, panCtl);
  main.append(synthFeatureZone.feature, primaryGrid, createFaceplateSpacer());

  const shell = createFaceTabs(ui, main, triggerOptions, controlOptions, v, routing, onRoutingChange);
  const synthSettingsPanel = createFaceplateSection("controls", "synthAdvancedPanel");
  const synthAdvancedHeaders = document.createElement("div");
  synthAdvancedHeaders.className = "synthAdvancedHeaders";
  const createAdvancedHeader = (label: string, column: string) => {
    const header = document.createElement("span");
    header.className = "synthAdvancedHeader";
    header.textContent = label;
    header.style.gridColumn = column;
    return header;
  };
  synthAdvancedHeaders.append(
    createAdvancedHeader("FILTER", "1 / span 2"),
    createAdvancedHeader("OSC", "3 / span 2"),
    createAdvancedHeader("ENV", "5 / span 1"),
    createAdvancedHeader("STEREO", "6 / span 1"),
  );
  const filterSlopeCtl = ctlFloat({ label: "Filter slope", value: t.resonance, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ resonance: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.resonance = x; }, { regen: false }) });
  const keyTrackingCtl = ctlFloat({ label: "Key tracking", value: t.cutoff, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ cutoff: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.cutoff = x; }, { regen: false }) });
  const filterDriveCtl = ctlFloat({ label: "Filter drive", value: t.modDepth, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ modDepth: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modDepth = x; }, { regen: false }) });
  const waveMorphCtl = ctlFloat({ label: "Wave morph", value: t.waveform, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ waveform: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.waveform = x; }, { regen: false }) });
  const phaseCtl = ctlFloat({ label: "Phase", value: t.fineTune, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ fineTune: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.fineTune = x; }, { regen: false }) });
  const syncCtl = ctlFloat({ label: "Sync", value: t.coarseTune, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ coarseTune: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.coarseTune = x; }, { regen: false }) });
  const envCurveCtl = ctlFloat({ label: "Curve", value: t.attack, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ attack: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.attack = x; }, { regen: false }) });
  const envVelocityCtl = ctlFloat({ label: "Velocity", value: t.sustain, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ sustain: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.sustain = x; }, { regen: false }) });
  const envAmountCtl = ctlFloat({ label: "Env amount", value: t.decay, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ decay: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.decay = x; }, { regen: false }) });
  const stereoWidthCtl = ctlFloat({ label: "Width", value: t.glide, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ glide: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.glide = x; }, { regen: false }) });
  const panLawCtl = ctlFloat({ label: "Pan law", value: t.pan, min: -1, max: 1, step: 0.001, center: 0, onChange: (x) => onPatchChange((p) => { setReactive({ pan: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.pan = x; }, { regen: false }) });
  const spreadModeCtl = ctlFloat({ label: "Spread mode", value: t.modRate, min: 0, max: 1, step: 0.001, onChange: (x) => onPatchChange((p) => { setReactive({ modRate: x }); const m = p.modules.find((z) => z.id === v.id); if (m?.type === "tonal") m.modRate = x; }, { regen: false }) });

  const synthAdvancedGrid = document.createElement("div");
  synthAdvancedGrid.className = "synthAdvancedGrid";
  const advancedControls: Array<HTMLElement | null> = [
    filterSlopeCtl,
    keyTrackingCtl,
    waveMorphCtl,
    phaseCtl,
    envCurveCtl,
    stereoWidthCtl,
    filterDriveCtl,
    null,
    syncCtl,
    null,
    envVelocityCtl,
    panLawCtl,
    pitchMapField.wrap,
    articulationField.wrap,
    null,
    null,
    envAmountCtl,
    spreadModeCtl,
  ];
  advancedControls.forEach((control) => {
    if (control) synthAdvancedGrid.append(control);
    else {
      const empty = document.createElement("div");
      empty.className = "synthAdvancedEmptySlot";
      empty.setAttribute("aria-hidden", "true");
      synthAdvancedGrid.append(empty);
    }
  });
  synthSettingsPanel.append(synthAdvancedHeaders, synthAdvancedGrid);
  shell.face.querySelector(".surfaceSettingsPanel")?.append(synthSettingsPanel);
  const synthInfo = (() => {
    const info = createFaceplateSection("bottom", "drumInfoBar synthInfoBar");
    const id = document.createElement("span");
    id.className = "drumInfoToken";
    id.textContent = t.id.slice(-6).toUpperCase();
    const stateToken = document.createElement("span");
    stateToken.className = "drumInfoToken";
    const route = document.createElement("span");
    route.className = "drumInfoToken";
    const meta = document.createElement("span");
    meta.className = "drumInfoToken drumInfoToken--meta";
    info.append(id, stateToken, route, meta);
    const update = (state: Pick<TonalModule, "enabled" | "triggerSource" | "cutoff" | "resonance" | "waveform" | "reception">) => {
      stateToken.textContent = state.enabled ? "ACTIVE" : "BYPASS";
      route.textContent = state.triggerSource ? `SRC ${state.triggerSource.slice(-4).toUpperCase()}` : "SRC NONE";
      meta.textContent = `${state.reception.toUpperCase()} · WAVE ${Math.round(state.waveform * 100)} · CUTOFF ${Math.round(state.cutoff * 100)} · RESO ${Math.round(state.resonance * 100)}`;
    };
    update(t);
    return { info, update };
  })();

  surface.append(h.header, shell.face, shell.tabs, synthInfo.info);
  root.appendChild(surface);

  return () => {
    const st = getLedState(v.id);
    h.ledA.className = "led" + (st.active ? " on" : "");
    h.ledHit.className = "led" + (st.hit ? " on hit" : "");
    h.syncToggle();
    setReactive({
      waveform: t.waveform,
      cutoff: t.cutoff,
      resonance: t.resonance,
      attack: t.attack,
      decay: t.decay,
      amp: t.amp,
      modDepth: t.modDepth,
      glide: t.glide,
      fineTune: t.fineTune,
      modRate: t.modRate,
      coarseTune: t.coarseTune,
      pan: t.pan,
      sustain: t.sustain,
      release: t.release,
      triggerSource: t.triggerSource,
      reception: t.reception,
    });
  };
}
