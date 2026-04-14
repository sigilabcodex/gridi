import type { Mode, Patch, TriggerModule } from "../patch";
import { getPatternPreview } from "../engine/pattern/module";
import { ctlFloat, type CtlFloatElement } from "./ctl";
import { wireSafeDeleteButton } from "./deleteButton";
import { createFaceplateMainPanel, createFaceplateSection, createFaceplateSpacer, createFaceplateStackPanel } from "./faceplateSections";
import { createModuleTabShell } from "./moduleShell";
import { createModulePresetControl } from "./modulePresetControl";
import type { ModulePresetRecord } from "./persistence/modulePresetStore";
import {
  createCompactSelectField,
  createModuleRefChip,
  createRoutingCard,
  createRoutingChip,
  type RoutingSnapshot,
} from "./routingVisibility";
import { bindFloatingPanelReposition, placeFloatingPanel } from "./floatingPanel";
import { createTriggerDisplaySurface } from "./triggerDisplaySurface";
import type { TooltipBinder } from "./tooltip";

const GENERATOR_MODE_LABELS: Record<Mode, { full: string; short: string }> = {
  "step-sequencer": { full: "Step Sequencer", short: "SSEQ" },
  "cellular-automata": { full: "Cellular Automata", short: "CA" },
  "euclidean": { full: "Euclidean", short: "EUC" },
  "non-euclidean": { full: "Non-Euclidean", short: "NEUC" },
  "fractal": { full: "Fractal", short: "FRACT" },
  "hybrid": { full: "Hybrid", short: "HYB" },
  "markov-chains": { full: "Markov Chains", short: "MARKOV" },
  "l-systems": { full: "L-Systems", short: "LSYS" },
  "xronomorph": { full: "XronoMorph", short: "XRM" },
  "genetic-algorithms": { full: "Genetic Algorithms", short: "GA" },
  "one-over-f-noise": { full: "1/f Noise", short: "1/F" },
  "gear": { full: "GEAR", short: "GEAR" },
};

const GENERATOR_MODES: Array<{ value: Mode; label: string }> = (Object.entries(GENERATOR_MODE_LABELS) as Array<[Mode, { full: string }]>)
  .map(([value, labels]) => ({ value, label: labels.full }));

type ControlOption = { id: string; label: string };
type TriggerControlKey =
  | "density"
  | "length"
  | "subdiv"
  | "weird"
  | "drop"
  | "determinism"
  | "gravity"
  | "euclidRot"
  | "caRule"
  | "caInit";

type TriggerModeControlSpec = {
  label: string;
  key: TriggerControlKey;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  tooltip: string;
  format?: (value: number) => string;
};

type RenderedModeControl = {
  spec: TriggerModeControlSpec;
  el: CtlFloatElement;
};

const BASE_STEP_CONTROLS: TriggerModeControlSpec[] = [
  {
    label: "Density",
    key: "density",
    min: 0,
    max: 1,
    step: 0.001,
    tooltip: "Adjust how often this generator lane produces steps.",
  },
  {
    label: "Len",
    key: "length",
    min: 1,
    max: 128,
    step: 1,
    integer: true,
    tooltip: "Set the loop length in sequencer steps.",
  },
  {
    label: "Div",
    key: "subdiv",
    min: 1,
    max: 8,
    step: 1,
    integer: true,
    tooltip: "Change the timing division for this generator lane.",
  },
  {
    label: "Var",
    key: "weird",
    min: 0,
    max: 1,
    step: 0.001,
    tooltip: "Add more surprising variations to the pattern.",
  },
  {
    label: "Swing",
    key: "gravity",
    min: 0,
    max: 1,
    step: 0.001,
    tooltip: "Pull accents toward anchors for a swing-like feel.",
  },
  {
    label: "Prob",
    key: "drop",
    min: 0,
    max: 1,
    step: 0.001,
    format: (value) => `${Math.round((1 - value) * 100)}%`,
    tooltip: "Set trigger probability after generation.",
  },
];

const MODE_CONTROL_REGISTRY: Record<Mode, TriggerModeControlSpec[]> = {
  "step-sequencer": BASE_STEP_CONTROLS,
  "euclidean": [
    {
      label: "Pulse",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set Euclidean pulse count as a normalized intensity.",
    },
    {
      label: "Steps",
      key: "length",
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set the Euclidean cycle length in steps.",
    },
    {
      label: "Rotate",
      key: "euclidRot",
      min: -32,
      max: 32,
      step: 1,
      integer: true,
      tooltip: "Rotate Euclidean hits around the loop.",
    },
    {
      label: "Spread",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Spread pulses with controlled irregularity.",
    },
    {
      label: "Accent",
      key: "gravity",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Bias Euclidean hits toward strong beats.",
    },
    {
      label: "Skip",
      key: "drop",
      min: 0,
      max: 1,
      step: 0.001,
      format: (value) => `${Math.round(value * 100)}%`,
      tooltip: "Set deterministic hit skipping after pulse placement.",
    },
  ],
  "cellular-automata": [
    {
      label: "Rule",
      key: "caRule",
      min: 0,
      max: 255,
      step: 1,
      integer: true,
      tooltip: "Select the cellular automata rule number.",
    },
    {
      label: "Density",
      key: "caInit",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set initial CA fill density.",
    },
    {
      label: "Decay",
      key: "drop",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Thin generated hits after each pass.",
    },
    {
      label: "Mutate",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Introduce controlled CA mutations.",
    },
    {
      label: "Rate",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Set CA playback rate via timing subdivision.",
    },
    {
      label: "Thresh",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set output threshold for active CA cells.",
    },
  ],
  "fractal": [
    {
      label: "Depth",
      key: "length",
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set the effective fractal recursion horizon.",
    },
    {
      label: "Scale",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Scale subdivision depth for fractal timing.",
    },
    {
      label: "Branch",
      key: "gravity",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Bias branching toward clustered structures.",
    },
    {
      label: "Jitter",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Add timing and density jitter to fractal branches.",
    },
    {
      label: "Rotate",
      key: "euclidRot",
      min: -32,
      max: 32,
      step: 1,
      integer: true,
      tooltip: "Rotate fractal phase offset around the loop.",
    },
    {
      label: "Sym",
      key: "determinism",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Lock recursive symmetry versus asymmetrical drift.",
    },
  ],
  "non-euclidean": [
    {
      label: "Density",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set how active non-Euclidean pulses are.",
    },
    {
      label: "Len",
      key: "length",
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set cycle length for non-Euclidean patterns.",
    },
    {
      label: "Div",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Control timing subdivision density.",
    },
    {
      label: "Warp",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Add geometric timing warp to the pulse grid.",
    },
    {
      label: "Rotate",
      key: "euclidRot",
      min: -32,
      max: 32,
      step: 1,
      integer: true,
      tooltip: "Rotate pattern phase around the loop.",
    },
    {
      label: "Prob",
      key: "drop",
      min: 0,
      max: 1,
      step: 0.001,
      format: (value) => `${Math.round((1 - value) * 100)}%`,
      tooltip: "Set final trigger probability.",
    },
  ],
  "hybrid": [
    {
      label: "Density",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set overall activity for hybrid generation.",
    },
    {
      label: "Len",
      key: "length",
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set hybrid pattern cycle length.",
    },
    {
      label: "Div",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Adjust temporal resolution of hybrid patterns.",
    },
    {
      label: "Mutate",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Increase deterministic variation in blended layers.",
    },
    {
      label: "Blend",
      key: "determinism",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Move between strict intersection and looser union.",
    },
    {
      label: "Weight",
      key: "gravity",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Bias balance toward anchored structural hits.",
    },
  ],
  "markov-chains": [
    {
      label: "Density",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set expected note-on frequency.",
    },
    {
      label: "Len",
      key: "length",
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set the chain cycle length in steps.",
    },
    {
      label: "Rate",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Set sequence rate through subdivision.",
    },
    {
      label: "Random",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Increase transition unpredictability.",
    },
    {
      label: "Memory",
      key: "determinism",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Bias transitions toward stable recurrent states.",
    },
    {
      label: "Bias",
      key: "gravity",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Pull chains toward anchor steps.",
    },
  ],
  "l-systems": [
    {
      label: "Density",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set output occupancy of rewritten patterns.",
    },
    {
      label: "Depth",
      key: "length",
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set effective rewrite depth horizon.",
    },
    {
      label: "Rate",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Set rhythmic scale of expansion output.",
    },
    {
      label: "Branch",
      key: "gravity",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Increase branch clustering around anchors.",
    },
    {
      label: "Rewrite",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Increase structural rewrite variation.",
    },
    {
      label: "Stable",
      key: "determinism",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Preserve repeatability between expansions.",
    },
  ],
  "xronomorph": [
    {
      label: "Density",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set hit density across warped time cells.",
    },
    {
      label: "Len",
      key: "length",
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set cycle length for temporal morphology.",
    },
    {
      label: "Scale",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Scale pulse resolution across the timeline.",
    },
    {
      label: "Morph",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Increase nonlinear morphing of rhythm cells.",
    },
    {
      label: "Skew",
      key: "gravity",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Skew pulse gravity toward downbeat anchors.",
    },
    {
      label: "Shift",
      key: "euclidRot",
      min: -32,
      max: 32,
      step: 1,
      integer: true,
      tooltip: "Apply phase offset to morphed output.",
    },
  ],
  "genetic-algorithms": [
    {
      label: "Fitness",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set target occupancy fitness for selected patterns.",
    },
    {
      label: "Len",
      key: "length",
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set chromosome pattern length.",
    },
    {
      label: "Rate",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Set evolutionary playback rate.",
    },
    {
      label: "Mutate",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Control mutation intensity per generation.",
    },
    {
      label: "Select",
      key: "determinism",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Bias toward elite selection versus exploration.",
    },
    {
      label: "Cull",
      key: "drop",
      min: 0,
      max: 1,
      step: 0.001,
      format: (value) => `${Math.round(value * 100)}%`,
      tooltip: "Set deterministic removal pressure on weak hits.",
    },
  ],
  "one-over-f-noise": [
    {
      label: "Density",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set average event density in noise output.",
    },
    {
      label: "Len",
      key: "length",
      min: 1,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set the noise sequence loop length.",
    },
    {
      label: "Rate",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Set timing resolution for the noise stream.",
    },
    {
      label: "Rough",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Increase high-frequency variation in the pattern.",
    },
    {
      label: "Correl",
      key: "determinism",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Increase long-term correlation between steps.",
    },
    {
      label: "Drift",
      key: "gravity",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Bias stochastic drift toward anchor regions.",
    },
  ],
  gear: [
    {
      label: "Rings",
      key: "density",
      min: 0,
      max: 1,
      step: 0.001,
      format: (value) => `${2 + Math.round(value * 2)}`,
      tooltip: "Set active ring count for interlocking cycle alignment.",
    },
    {
      label: "Len",
      key: "length",
      min: 4,
      max: 128,
      step: 1,
      integer: true,
      tooltip: "Set the base cycle length for ring A.",
    },
    {
      label: "Rot",
      key: "euclidRot",
      min: -32,
      max: 32,
      step: 1,
      integer: true,
      tooltip: "Apply a shared rotation offset across all rings.",
    },
    {
      label: "Div",
      key: "subdiv",
      min: 1,
      max: 8,
      step: 1,
      integer: true,
      tooltip: "Scale relative ring lengths against the base cycle.",
    },
    {
      label: "Align",
      key: "determinism",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Control strictness for alignment-based trigger acceptance.",
    },
    {
      label: "Drift",
      key: "weird",
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Introduce slow phase drift between ring playheads.",
    },
  ],
};

export function renderTriggerSurface(
  root: HTMLElement,
  t: TriggerModule,
  routing: RoutingSnapshot,
  onPatchChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  onRoutingChange: (fn: (p: Patch) => void, opts?: { regen?: boolean }) => void,
  controlOptions: ControlOption[],
  attachTooltip?: TooltipBinder,
  modulePresetRecords: ModulePresetRecord[] = [],
  onLoadModulePreset?: (moduleId: string, presetId: string) => void,
  onSaveModulePreset?: (moduleId: string, name: string, overwritePresetId?: string | null) => void,
  onRemove?: () => void,
) {
  const surface = document.createElement("section");
  surface.className = "moduleSurface triggerSurface triggerSurface--withStatus";
  surface.dataset.type = "trigger";

  const header = document.createElement("div");
  header.className = "surfaceHeader";

  const presetControl = createModulePresetControl({
    module: t,
    records: modulePresetRecords,
    onLoadPreset: (presetId) => onLoadModulePreset?.(t.id, presetId),
    onSavePreset: (name, overwritePresetId) => onSaveModulePreset?.(t.id, name, overwritePresetId),
    attachTooltip,
  });

  const identity = document.createElement("div");
  identity.className = "surfaceIdentity surfaceIdentity--canonical drumIdentity";

  const badge = document.createElement("div");
  badge.className = "surfaceBadge surfaceBadge--triggerFamily";
  badge.textContent = "GEN";
  identity.append(badge, presetControl.button);

  const right = document.createElement("div");
  right.className = "rightControls";

  const toggle = document.createElement("button");
  toggle.className = "surfaceHeaderAction";
  const syncToggle = () => {
    toggle.textContent = t.enabled ? "On" : "Off";
    toggle.classList.toggle("primary", t.enabled);
  };
  syncToggle();
  toggle.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type === "trigger") m.enabled = !m.enabled;
  }, { regen: false });
  attachTooltip?.(toggle, {
    text: "Enable or bypass this generator module.",
    ariaLabel: `${t.name} power`,
  });

  const btnX = document.createElement("button");
  btnX.textContent = "×";
  btnX.className = "danger surfaceHeaderAction";
  wireSafeDeleteButton(btnX, () => onRemove?.());
  attachTooltip?.(btnX, {
    text: "Remove this generator module from the grid.",
    ariaLabel: `Remove ${t.name}`,
  });
  right.append(toggle, btnX);
  header.append(identity, right);

  const panelMain = createFaceplateMainPanel();
  panelMain.classList.add("triggerPrimary");

  const metaRow = createFaceplateSection("io", "triggerMetaRow");

  const generatorChip = document.createElement("div");
  generatorChip.className = "triggerMetaChip triggerMetaChip--gen";

  const generatorLabel = document.createElement("span");
  generatorLabel.className = "triggerMetaChipLabel";
  generatorLabel.textContent = "MODE";

  const generatorButton = document.createElement("button");
  generatorButton.type = "button";
  generatorButton.className = "triggerModeButton";
  generatorButton.setAttribute("aria-label", `${t.name} generator mode`);
  generatorButton.setAttribute("aria-haspopup", "dialog");
  generatorButton.setAttribute("aria-expanded", "false");
  attachTooltip?.(generatorButton, {
    text: "Select the active generator mode for this module.",
    ariaLabel: `${t.name} generator mode`,
  });
  const generatorValue = document.createElement("span");
  generatorValue.className = "triggerModeValue";

  generatorChip.append(generatorLabel, generatorValue, generatorButton);

  const seedGroup = document.createElement("div");
  seedGroup.className = "triggerSeedGroup";

  const seedInput = document.createElement("input");
  seedInput.className = "triggerSeedInput";
  seedInput.type = "number";
  seedInput.min = "0";
  seedInput.max = "999999";
  seedInput.step = "1";
  seedInput.inputMode = "numeric";
  seedInput.setAttribute("aria-label", `${t.name} seed value`);
  let seedDraft: string | null = null;

  const parseSeedDraft = () => {
    const raw = (seedDraft ?? seedInput.value).replace(/[^\d]/g, "");
    if (!raw.length) return null;
    const nextSeed = Number(raw);
    if (!Number.isFinite(nextSeed)) return null;
    return Math.max(0, Math.min(999_999, Math.round(nextSeed)));
  };

  const commitSeed = () => {
    const nextSeed = parseSeedDraft();
    if (nextSeed == null) {
      seedInput.value = String(t.seed).padStart(6, "0");
      seedDraft = null;
      return;
    }
    onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type === "trigger") {
        m.seed = nextSeed;
        delete m.liveState;
      }
    }, { regen: true });
    seedDraft = null;
  };

  seedInput.addEventListener("focus", () => {
    seedDraft = seedInput.value;
  });
  seedInput.addEventListener("input", () => {
    seedInput.value = seedInput.value.replace(/[^\d]/g, "");
    seedDraft = seedInput.value;
  });
  seedInput.addEventListener("blur", () => {
    commitSeed();
  });
  seedInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitSeed();
      seedInput.blur();
      return;
    }
    if (event.key === "Escape") {
      seedDraft = null;
      seedInput.value = String(t.seed).padStart(6, "0");
      seedInput.blur();
    }
  });
  attachTooltip?.(seedInput, {
    text: "Edit the deterministic seed value for this generator.",
    ariaLabel: `${t.name} seed value`,
  });

  const randomizeSeed = document.createElement("button");
  randomizeSeed.type = "button";
  randomizeSeed.className = "triggerSeedRandomize";
  randomizeSeed.textContent = "↻";
  attachTooltip?.(randomizeSeed, {
    text: "Generate a fresh seed value.",
    ariaLabel: `${t.name} randomize seed`,
  });
  randomizeSeed.onclick = () => onPatchChange((p) => {
    const m = p.modules.find((x) => x.id === t.id);
    if (m?.type === "trigger") {
      m.seed = (Math.random() * 999_999) | 0;
      delete m.liveState;
    }
  }, { regen: true });

  const seedLabel = document.createElement("span");
  seedLabel.className = "triggerSeedLabel";
  seedLabel.textContent = "SEED";

  seedGroup.append(seedLabel, seedInput, randomizeSeed);
  seedGroup.addEventListener("click", (event) => {
    if (event.target === randomizeSeed) return;
    seedInput.focus();
  });

  const routingChip = document.createElement("button");
  routingChip.className = "triggerMetaChip triggerMetaChip--routing";
  routingChip.type = "button";
  routingChip.setAttribute("aria-haspopup", "dialog");
  attachTooltip?.(routingChip, {
    text: "Assign trigger output targets from the main face.",
    ariaLabel: `${t.name} routing`,
  });
  let routingPanel: HTMLElement | null = null;
  let routingPanelCleanup: { destroy: () => void } | null = null;
  let modePanel: HTMLElement | null = null;
  let modePanelCleanup: { destroy: () => void } | null = null;
  const setMode = (nextMode: Mode) => {
    onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type === "trigger") {
        m.mode = nextMode;
        delete m.liveState;
      }
    }, { regen: true });
  };
  const closeModePanel = () => {
    if (modePanelCleanup) {
      modePanelCleanup.destroy();
      modePanelCleanup = null;
    }
    modePanel?.remove();
    modePanel = null;
    generatorChip.classList.remove("isOpen");
    generatorButton.setAttribute("aria-expanded", "false");
  };
  const closeRoutingPanel = () => {
    if (routingPanelCleanup) {
      routingPanelCleanup.destroy();
      routingPanelCleanup = null;
    }
    routingPanel?.remove();
    routingPanel = null;
    routingChip.classList.remove("isOpen");
    routingChip.setAttribute("aria-expanded", "false");
  };

  const openModePanel = () => {
    if (modePanel) {
      closeModePanel();
      return;
    }
    closeRoutingPanel();

    const panel = document.createElement("div");
    panel.className = "floatingPanel triggerModeSelectorPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", `${t.name} generator mode`);
    const list = document.createElement("div");
    list.className = "triggerModeSelectorList";

    GENERATOR_MODES.forEach((mode) => {
      const row = document.createElement("button");
      row.type = "button";
      row.dataset.mode = mode.value;
      row.className = `triggerModeSelectorRow${t.mode === mode.value ? " isSelected" : ""}`;
      row.textContent = mode.label;
      row.onclick = () => {
        closeModePanel();
        if (mode.value !== t.mode) setMode(mode.value);
      };
      list.appendChild(row);
    });

    panel.appendChild(list);
    document.body.appendChild(panel);

    const position = () => (generatorChip.isConnected ? generatorChip.getBoundingClientRect() : null);
    placeFloatingPanel(panel, generatorChip.getBoundingClientRect(), {
      preferredSide: "bottom",
      align: "start",
      offset: 8,
      minWidth: 150,
      maxWidth: 210,
    });
    const reposition = bindFloatingPanelReposition(panel, position, {
      preferredSide: "bottom",
      align: "start",
      offset: 8,
      minWidth: 150,
      maxWidth: 210,
    });

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panel.contains(target) || generatorChip.contains(target)) return;
      closeModePanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeModePanel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    modePanelCleanup = {
      destroy() {
        reposition.destroy();
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
      },
    };

    modePanel = panel;
    generatorChip.classList.add("isOpen");
    generatorButton.setAttribute("aria-expanded", "true");
  };
  generatorButton.onclick = openModePanel;

  const buildRoutingRows = (panelList: HTMLElement) => {
    panelList.replaceChildren();
    const targetModules = routing.modules.size
      ? [...routing.modules.values()].filter((moduleRef) => moduleRef.family === "drum" || moduleRef.family === "tonal")
      : [];
    targetModules.sort((a, b) => a.name.localeCompare(b.name));

    if (!targetModules.length) {
      const empty = document.createElement("div");
      empty.className = "triggerRoutingSelectorEmpty";
      empty.textContent = "No route targets";
      panelList.appendChild(empty);
      return;
    }

    targetModules.forEach((target) => {
      const isConnected = (routing.triggerTargets.get(t.id) ?? []).some((voice) => voice.id === target.id);
      const row = document.createElement("button");
      row.type = "button";
      row.className = `triggerRoutingSelectorRow${isConnected ? " isSelected" : ""}`;

      const mark = document.createElement("span");
      mark.className = "triggerRoutingSelectorMark";
      mark.textContent = isConnected ? "✓" : "";
      const label = document.createElement("span");
      label.className = "triggerRoutingSelectorLabel";
      label.textContent = target.name;
      const family = document.createElement("span");
      family.className = "triggerRoutingSelectorFamily";
      family.textContent = target.family === "drum" ? "DRUM" : "SYNTH";
      row.append(mark, label, family);
      row.onclick = () => {
        closeRoutingPanel();
        onRoutingChange((p) => {
          const targetModule = p.modules.find((module) => module.id === target.id);
          if (!targetModule || (targetModule.type !== "drum" && targetModule.type !== "tonal")) return;
          targetModule.triggerSource = targetModule.triggerSource === t.id ? null : t.id;
        }, { regen: true });
      };
      panelList.appendChild(row);
    });
  };

  const openRoutingPanel = () => {
    if (routingPanel) {
      closeRoutingPanel();
      return;
    }
    closeModePanel();

    const panel = document.createElement("div");
    panel.className = "floatingPanel triggerRoutingSelectorPanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", `${t.name} routing targets`);
    const panelList = document.createElement("div");
    panelList.className = "triggerRoutingSelectorList";
    buildRoutingRows(panelList);
    panel.appendChild(panelList);
    document.body.appendChild(panel);

    const position = () => (routingChip.isConnected ? routingChip.getBoundingClientRect() : null);
    placeFloatingPanel(panel, routingChip.getBoundingClientRect(), {
      preferredSide: "bottom",
      align: "end",
      offset: 8,
      minWidth: 210,
      maxWidth: 250,
    });
    const reposition = bindFloatingPanelReposition(panel, position, {
      preferredSide: "bottom",
      align: "end",
      offset: 8,
      minWidth: 210,
      maxWidth: 250,
    });

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panel.contains(target) || routingChip.contains(target)) return;
      closeRoutingPanel();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeRoutingPanel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    routingPanelCleanup = {
      destroy() {
        reposition.destroy();
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("keydown", onKeyDown, true);
      },
    };

    routingPanel = panel;
    routingChip.classList.add("isOpen");
    routingChip.setAttribute("aria-expanded", "true");
  };
  routingChip.onclick = openRoutingPanel;

  metaRow.append(generatorChip, seedGroup, routingChip);

  const display = createTriggerDisplaySurface({
    module: t,
    getStepPattern: () => patternPreviewText(),
    onCommitLivePattern: (pattern, mode) => {
      onPatchChange((p) => {
        const m = p.modules.find((x) => x.id === t.id);
        if (m?.type !== "trigger") return;
        if (!pattern || pattern.length === 0) {
          delete m.liveState;
          return;
        }
        m.liveState = {
          mode,
          steps: pattern.length,
          pattern: Array.from(pattern, (bit) => (bit ? "1" : "0")).join(""),
          revision: Date.now(),
        };
      }, { regen: true });
    },
  });

  const mainControlRack = createFaceplateSection("controls", "triggerPulseRack triggerPrimaryControls");
  let renderedMode: Mode | null = null;
  let renderedModeControls: RenderedModeControl[] = [];
  const renderModeControls = () => {
    const modeControls = MODE_CONTROL_REGISTRY[t.mode] ?? BASE_STEP_CONTROLS;
    renderedModeControls = modeControls.map((spec) => ({
      spec,
      el: ctlFloat({
        label: spec.label,
        value: t[spec.key],
        min: spec.min,
        max: spec.max,
        step: spec.step,
        integer: spec.integer,
        tooltip: spec.tooltip,
        format: spec.format,
        attachTooltip,
        onChange: (x) => setParam(spec.key, x),
      }),
    }));
    renderedMode = t.mode;
    mainControlRack.replaceChildren(...renderedModeControls.map((control) => control.el));
  };
  const syncModeControlValues = () => {
    if (renderedMode !== t.mode) {
      renderModeControls();
      return;
    }
    renderedModeControls.forEach(({ spec, el }) => el.syncValue?.(t[spec.key]));
  };
  renderModeControls();

  const idToken = document.createElement("span");
  idToken.className = "drumInfoToken";
  idToken.textContent = t.id.slice(-6).toUpperCase();

  const stateToken = document.createElement("span");
  stateToken.className = "drumInfoToken";

  const modeToken = document.createElement("span");
  modeToken.className = "drumInfoToken";

  const transportReadout = document.createElement("span");
  transportReadout.className = "drumInfoToken drumInfoToken--meta triggerTransportReadout";

  const infoBar = document.createElement("div");
  infoBar.className = "drumInfoBar triggerInfoBar";
  infoBar.append(idToken, stateToken, modeToken, transportReadout);

  panelMain.append(metaRow, display.wrap, mainControlRack, createFaceplateSpacer());

  const outgoingVoices = routing.triggerTargets.get(t.id) ?? [];
  const incomingMods = routing.triggerIncoming.get(t.id) ?? [];

  const panelRouting = createFaceplateStackPanel("utilityPanel utilityPanel--triggerRouting");

  const targetsCard = createRoutingCard("Voice out", outgoingVoices.length ? `${outgoingVoices.length} sink${outgoingVoices.length === 1 ? "" : "s"}` : "No sinks");
  const targetsList = document.createElement("div");
  targetsList.className = "routingChipList";
  if (outgoingVoices.length) {
    const visibleTargets = outgoingVoices.slice(0, 6);
    visibleTargets.forEach((voice) => targetsList.appendChild(createModuleRefChip(voice)));
    if (outgoingVoices.length > visibleTargets.length) {
      targetsList.appendChild(createRoutingChip(`+${outgoingVoices.length - visibleTargets.length} more`, "muted"));
    }
  } else targetsList.appendChild(createRoutingChip("Unassigned", "muted"));
  targetsCard.appendChild(targetsList);
  panelRouting.appendChild(targetsCard);

  const modulationCard = createRoutingCard("Density mod", incomingMods.length ? `${incomingMods.length} source${incomingMods.length === 1 ? "" : "s"}` : "No source");
  const modField = createCompactSelectField({
    label: "Source",
    options: controlOptions.map((opt) => ({ value: opt.id, label: opt.label })),
    selected: t.modulations?.density,
    emptyLabel: "None",
    tooltip: "Choose a control source that modulates density.",
    attachTooltip,
    onChange: (value) => onRoutingChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type !== "trigger") return;
      m.modulations = m.modulations ?? {};
      if (value) m.modulations.density = value;
      else delete m.modulations.density;
    }, { regen: false }),
  });
  const modList = document.createElement("div");
  modList.className = "routingChipList";
  if (incomingMods.length) {
    const visibleMods = incomingMods.slice(0, 6);
    visibleMods.forEach((modulation) => modList.appendChild(createModuleRefChip(modulation.source, modulation.parameterLabel)));
    if (incomingMods.length > visibleMods.length) {
      modList.appendChild(createRoutingChip(`+${incomingMods.length - visibleMods.length} more`, "muted"));
    }
  } else modList.appendChild(createRoutingChip("No mod", "muted"));
  modulationCard.append(modField.wrap, modList);
  panelRouting.appendChild(modulationCard);

  const panelSettings = createFaceplateStackPanel("surfaceSettingsPanel triggerSettingsPanel");
  const settingsGrid = createFaceplateSection("controls", "moduleKnobGrid moduleKnobGrid-2");
  settingsGrid.append(
    ctlFloat({
      label: "Drop",
      value: t.drop,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Thin the pattern by dropping hits after generation.",
      attachTooltip,
      onChange: (x) => setParam("drop", x),
    }),
    ctlFloat({
      label: "Det",
      value: t.determinism,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Bias the generator toward repeatable results.",
      attachTooltip,
      onChange: (x) => setParam("determinism", x),
    }),
    ctlFloat({
      label: "Grav",
      value: t.gravity,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Pull generated hits toward denser clusters.",
      attachTooltip,
      onChange: (x) => setParam("gravity", x),
    }),
    ctlFloat({
      label: "Rotate",
      value: t.euclidRot,
      min: -32,
      max: 32,
      step: 1,
      integer: true,
      tooltip: "Rotate Euclidean hits around the loop.",
      attachTooltip,
      onChange: (x) => setParam("euclidRot", x),
    }),
    ctlFloat({
      label: "CA rule",
      value: t.caRule,
      min: 0,
      max: 255,
      step: 1,
      integer: true,
      tooltip: "Select the cellular automata rule number.",
      attachTooltip,
      onChange: (x) => setParam("caRule", x),
    }),
    ctlFloat({
      label: "CA init",
      value: t.caInit,
      min: 0,
      max: 1,
      step: 0.001,
      tooltip: "Set the initial fill used by CA-based patterns.",
      attachTooltip,
      onChange: (x) => setParam("caInit", x),
    }),
  );
  panelSettings.append(settingsGrid);

  const shell = createModuleTabShell({
    specs: [
      { id: "MAIN", label: "Main", panel: panelMain },
      { id: "ROUTING", label: "Routing", panel: panelRouting },
      { id: "SETTINGS", label: "Advanced", panel: panelSettings },
    ],
    activeTab: "MAIN",
  });

  surface.append(header, shell.face, shell.tabs, infoBar);
  root.appendChild(surface);
  syncTriggerFace();

  function patternPreviewText() {
    return getPatternPreview(t, `${t.id}:preview`, 64);
  }

  function syncTriggerFace() {
    if (!surface.isConnected) {
      closeRoutingPanel();
      closeModePanel();
    }
    syncModeControlValues();
    badge.textContent = t.mode === "gear" ? "GEAR" : "GEN";
    generatorLabel.textContent = t.mode === "gear" ? "GEAR" : "MODE";
    generatorValue.textContent = GENERATOR_MODE_LABELS[t.mode]?.short ?? "GEN";
    if (modePanel) {
      const rows = modePanel.querySelectorAll<HTMLElement>(".triggerModeSelectorRow");
      rows.forEach((row) => {
        row.classList.toggle("isSelected", row.dataset.mode === t.mode);
      });
    }
    if (routingPanel) {
      const panelList = routingPanel.querySelector<HTMLElement>(".triggerRoutingSelectorList");
      if (panelList) buildRoutingRows(panelList);
    }
    if (document.activeElement !== seedInput) seedInput.value = String(t.seed).padStart(6, "0");
    routingChip.textContent = !outgoingVoices.length ? "ROUT" : outgoingVoices.length >= 3 ? "ROUT 3+" : `ROUT ${outgoingVoices.length}`;
    stateToken.textContent = t.enabled ? "ACTIVE" : "BYPASS";
    modeToken.textContent = `MODE ${GENERATOR_MODE_LABELS[t.mode]?.full ?? "GEN"}`;
    display.sync(t);
    transportReadout.textContent = `${t.length} st · /${t.subdiv} · ${Math.round(t.density * 100)}%`;
  }

  function setParam(key: TriggerControlKey, value: number) {
    onPatchChange((p) => {
      const m = p.modules.find((x) => x.id === t.id);
      if (m?.type === "trigger") {
        if (key === "length" || key === "subdiv" || key === "euclidRot" || key === "caRule") {
          (m as TriggerModule)[key] = Math.round(value) as never;
        } else {
          (m as TriggerModule)[key] = value as never;
        }
        if (key === "length" || key === "subdiv") delete m.liveState;
      }
    }, { regen: true });
  }

  return () => {
    syncToggle();
    syncTriggerFace();
  };
}

export const renderTriggerModule = renderTriggerSurface;
