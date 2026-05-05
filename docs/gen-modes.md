# GEN modes reference

This is the stable reference for GRIDI's current GEN family.

## 1) What GEN is

- **GEN** is the UI-facing name for GRIDI's Trigger generator family.
- In patch/engine terms, this is the `trigger` engine family.
- GEN modules generate timed event patterns that other modules (for example Drum/Synth) consume.

GEN is an instrument generator surface, not a DAW arrangement timeline.

## 2) GEN is generator/event architecture, not DAW timeline architecture

GEN runs inside GRIDI's look-ahead scheduler and emits event windows from mode-specific algorithms. It is built for looped, parameterized generation with deterministic timing and controlled indeterminism, rather than clip/arrangement editing.

Practical implication:
- You shape behavior with mode + controls + seed, then perform/tune.
- You do not author a linear song timeline inside GEN.

## 3) Identity model: mode IDs, shared patch keys, labels, and display behavior

### Stable mode identity

Each GEN mode has a **stable patch-level mode ID** (`mode`) and registry metadata (`fullLabel`, `shortLabel`, family, stage). Mode IDs are the contract for saved patches and must not be renamed casually.

### Shared patch keys (cross-mode control surface)

Many modes reuse shared trigger keys (`density`, `length`, `subdiv`, `weird`, `drop`, `determinism`, `gravity`, `accent`, plus `euclidRot`, and CA internals where relevant). This preserves patch compatibility and keeps modulation/routing shape consistent.

### Per-mode labels (UI semantics)

Main and Advanced/Fine-tune controls are mode-aware: the same underlying key can carry a different label/tooltip per mode (for example `determinism` → Lock/Memory/Select depending on mode). This is intentional semantic layering, not a schema change.

### Display behavior

Display surfaces are expected to communicate generator truth, not decorative motion. Some modes are already strong and model-driven; others are currently acceptable/weak and documented honestly below.

## 4) Display truthfulness principle (current)

GEN display surfaces should map to at least one real runtime layer:
- generator state,
- scheduler/playhead phase,
- emitted event behavior,
- or an explicitly minimal honest placeholder.

Do not fake deeper simulation than the current algorithm provides.

## 5) RADAR vs SONAR

- **RADAR is implemented now** as rotating directional scan semantics with angular/step-aligned detection behavior.
- **SONAR is not implemented** as a GEN mode today. SONAR remains a planned future concept (pulse propagation / echo-style semantics) and should not be described as currently available.

## 6) Main vs Advanced/Fine-tune controls

- **Main**: compact performance controls with mode-specific names and immediate musical impact.
- **Advanced/Fine-tune**: mode-aware grouping for deeper shaping (global shaping, stability/bias, phase/topology, CA internals when relevant).

Advanced/Fine-tune organization is now mode-aware while preserving existing patch keys.

## 7) Current implemented GEN modes

Truthfulness status legend:
- **strong**: direct mapping to algorithm/runtime behavior.
- **acceptable**: mostly honest, but partially coarse/abstract.
- **weak**: metaphor is present, but linkage to real generator internals is limited.
- **misleading risk**: visuals can imply deeper/other behavior than implemented.

### Step Sequencer
- **Display name:** Step Sequencer
- **Stable mode ID:** `step-sequencer`
- **Conceptual metaphor:** direct step-grid patterning.
- **Actual generator behavior:** step pattern generation with shared runtime drop/accent shaping and deterministic seeded variation controls.
- **Display truthfulness:** **strong**.
- **Major follow-up:** continue refining mode-specific velocity phrasing over fallback shaping.

### Euclidean
- **Display name:** Euclidean
- **Stable mode ID:** `euclidean`
- **Conceptual metaphor:** evenly distributed pulses on a cycle.
- **Actual generator behavior:** Bjorklund pulse distribution with rotation, then mode shaping via weird/determinism/gravity and shared drop/accent semantics.
- **Display truthfulness:** **strong**.
- **Major follow-up:** incremental labeling/usability polish only.

### Cellular Automata
- **Display name:** Cellular Automata
- **Stable mode ID:** `cellular-automata`
- **Conceptual metaphor:** rule-evolved cellular rows sampled into rhythm.
- **Actual generator behavior:** 1D CA evolution (`caRule`, `caInit`) sampled into step activity with density/weird/gravity interactions.
- **Display truthfulness:** **strong** (with compressed window abstraction).
- **Major follow-up:** keep CA internals legible while avoiding duplicated surface noise.

### Hybrid
- **Display name:** Hybrid
- **Stable mode ID:** `hybrid`
- **Conceptual metaphor:** blended scaffold from multiple structural generators.
- **Actual generator behavior:** combines step/euclidean/CA sources with determinism- and weird-dependent structural decisions.
- **Display truthfulness:** **acceptable**.
- **Major follow-up:** strengthen source-attribution visibility in display.

### GEAR
- **Display name:** GEAR
- **Stable mode ID:** `gear`
- **Conceptual metaphor:** interlocking rotating rings producing coincidence hits.
- **Actual generator behavior:** multi-ring length/phase/direction model with coincidence gating, strictness weighting, drift, and drop gating.
- **Display truthfulness:** **acceptable**.
- **Major follow-up:** keep visuals from over-implying physical simulation depth.

### RADAR
- **Display name:** RADAR
- **Stable mode ID:** `radar`
- **Conceptual metaphor:** rotating directional scan with target returns.
- **Actual generator behavior:** discrete angle-step sweep over target field with lock/drift/bias interactions and hit thresholding.
- **Display truthfulness:** **strong**.
- **Major follow-up:** none required for baseline semantics; treat as reference quality.

### Fractal
- **Display name:** Fractal
- **Stable mode ID:** `fractal`
- **Conceptual metaphor:** recursive/self-similar rhythmic structure.
- **Actual generator behavior:** multi-scale block-gating and threshold behavior shaped by determinism/weird/gravity.
- **Display truthfulness:** **weak**.
- **Major follow-up:** improve display and velocity semantics so recursion metaphor is better evidenced.

### Non-Euclidean
- **Display name:** Non-Euclidean
- **Stable mode ID:** `non-euclidean`
- **Conceptual metaphor:** warped local pulse geometry across unequal segments.
- **Actual generator behavior:** segmented local pulse generation with per-segment rotations/warps and perturbation/drop behavior.
- **Display truthfulness:** **acceptable** (still coarse).
- **Major follow-up:** expose segment-edge/warp truth more directly in the display.

### Markov Chains
- **Display name:** Markov Chains
- **Stable mode ID:** `markov-chains`
- **Conceptual metaphor:** state-transition-driven rhythmic decisions.
- **Actual generator behavior:** transition-probability/state-path generation shaped by determinism/weird/gravity and shared drop/accent behavior.
- **Display truthfulness:** **acceptable**.
- **Major follow-up:** tighter runtime transition trace visualization.

### L-Systems
- **Display name:** L-Systems
- **Stable mode ID:** `l-systems`
- **Conceptual metaphor:** grammar/branch growth mapped to pulse activity.
- **Actual generator behavior:** branch-grammar-inspired pattern shaping mapped into step hits and shared trigger dynamics.
- **Display truthfulness:** **weak**.
- **Major follow-up:** improve branch grammar to display-state correspondence.

### XronoMorph
- **Display name:** XronoMorph
- **Stable mode ID:** `xronomorph`
- **Conceptual metaphor:** phase-morph blend between rhythmic source lanes.
- **Actual generator behavior:** source-lane phase/morph pattern construction with mode-aware stability/pull controls.
- **Display truthfulness:** **acceptable**.
- **Major follow-up:** reduce implied causality where display exceeds currently exposed internals.

### Genetic Algorithms
- **Display name:** Genetic Algorithms
- **Stable mode ID:** `genetic-algorithms`
- **Conceptual metaphor:** population/selection/mutation motif evolution.
- **Actual generator behavior:** GA-inspired candidate/fitness-style pattern shaping rather than a full explicit evolutionary timeline UI.
- **Display truthfulness:** **misleading risk**.
- **Major follow-up:** either expose explicit generation/selection progression or simplify visuals.

### 1/f Noise
- **Display name:** 1/f Noise
- **Stable mode ID:** `one-over-f-noise`
- **Conceptual metaphor:** pink-noise-like correlated fluctuation crossing event thresholds.
- **Actual generator behavior:** smoothed stochastic trajectory with thresholded hit extraction and shared shaping controls.
- **Display truthfulness:** **acceptable**.
- **Major follow-up:** strengthen direct mapping between threshold dynamics and event output.
