# GEN mode semantics, controls, and display audit (2026-04)

## 1) Executive summary

This pass audits the full implemented GEN family (13 modes) across identity, generation semantics, controls, velocity/accent behavior, and display truthfulness.

Overall findings:

- The **architecture baseline is healthy**: mode registry/staging metadata exists, flat mode IDs are preserved, and all audited modes are implemented end-to-end with distinct generators in `module.ts` (or `gear.ts`).
- **Main controls have improved significantly**, but several modes still expose generic/shared labels where mode-specific labels would better communicate actual behavior.
- The current **Advanced tab is functionally useful but semantically overloaded**: it mixes mode-agnostic globals (`accent`) with mode-specific internals (`caRule`, `caInit`) without grouping.
- **Display truthfulness has materially improved** (especially RADAR / Markov / Non-Euclidean / XronoMorph relative to earlier audits), but quality still varies: some modes are clear and structural; others remain honest-but-weak or imply deeper simulation than currently generated.
- **Velocity/accent semantics are now coherent at family level**, but many modes still share fallback shaping; future passes should make accent interpretation more mode-specific (without breaking compatibility).

Most urgent corrections:

1. Control-label alignment for conceptual modes (Fractal, L-Systems, GA, XronoMorph, Non-Euclidean).
2. Advanced tab information architecture (grouping + mode-conditioned labels).
3. Display strengthening for Genetic Algorithms, Fractal, L-Systems, and Hybrid.

Follow-up note (implemented in a later pass):
- Trigger GEN `Advanced` now supports mode-aware fine-tune grouping and relevance filtering while keeping existing patch keys stable (`drop`, `determinism`, `gravity`, `accent`, `euclidRot`, `caRule`, `caInit`).

---

## 2) Per-mode audit

Classification legend used below:

- Controls:
  - ✅ truthful + mode-specific
  - ◻ truthful but generic
  - ⚠ misleading / weakly connected
  - ↕ should move between Main and Advanced
  - ✎ rename recommended
- Displays:
  - **strong** / **acceptable** / **weak** / **misleading risk** / **deferred**

### 2.1 step-sequencer

**Claimed identity**
- Direct step-grid trigger programming with deterministic structure.

**Actual generation behavior**
- Uses `genStepPattern` as the core source; final event emission applies runtime drop gate and shared velocity/lane mapping in `toStepWindowEvents`.

**Current Main controls**
- Density ◻ (truthful but generic)
- Len ✅
- Div ✅
- Var ⚠✎ (maps to `weird`, but “Var” is generic and undersells specific effect)
- Swing ⚠✎ (maps to `gravity`, but “Swing” may over-promise groove timing vs density anchoring)
- Prob ✅ (post-generation drop probability)

**Current Advanced controls**
- Shows Drop, Det, Grav, Accent, Rotate, CA rule, CA init for all modes.
- For step-sequencer: Rotate/CA controls are irrelevant clutter ↕.

**Velocity / Accent behavior**
- Velocity base is a rising step-position curve; accent blends neutral velocity toward this structural profile.
- Musically plausible; could be improved with stronger downbeat/upbeat phrasing model.

**Display truthfulness and quality**
- **strong**: grid with playhead and activity intensity is direct and legible.
- Real state shown: pattern bits + runtime step index.
- Missing: editable velocity overlay (deferred by architecture).

**Recommended correction**
- **Advanced/Fine-tune cleanup** (hide or dim irrelevant fields per mode).

---

### 2.2 euclidean

**Claimed identity**
- Even pulse distribution on a cycle.

**Actual generation behavior**
- Bjorklund pulses from density/length, rotated by `euclidRot`, then warped by weird+determinism and anchor pull from gravity.

**Current Main controls**
- Pulse ✅
- Steps ✅
- Rotate ✅
- Spread ✅
- Accent ⚠✎ (this is gravity-based anchor pull, not velocity accent)
- Skip ✅

**Current Advanced controls**
- Global advanced list duplicates Main semantics and adds unrelated CA fields ↕.

**Velocity / Accent behavior**
- Velocity follows normalized pulse index; accent depth meaning is musically coherent.
- Could add pulse-class accents (primary/secondary pulses).

**Display truthfulness and quality**
- **strong** ring + playhead.
- Controls visibly affect display.

**Recommended correction**
- **label/control rename** (`Accent`→`Bias` or `Anchor`) and Advanced declutter.

---

### 2.3 cellular-automata

**Claimed identity**
- Rule-based cellular evolution sampled into rhythm.

**Actual generation behavior**
- 1D CA with `caRule`/`caInit` over computed generations; diagonal sampling into pattern with density/weird shaping.

**Current Main controls**
- Rule ✅
- Density (caInit) ⚠✎ (label collides with global density concept)
- Decay ✅
- Mutate ✅
- Rate ◻
- Thresh ✅

**Current Advanced controls**
- CA Rule/Init duplicated in Advanced; useful if Main becomes simpler, but currently repetitive.

**Velocity / Accent behavior**
- Velocity derived from local neighborhood density; accent meaning is plausible.
- Could be strengthened by generation-age influence (early vs late row energy).

**Display truthfulness and quality**
- **strong/acceptable**: evolving rows and playhead communicate CA behavior.
- Slight compression abstraction remains.

**Recommended correction**
- **label/control rename** (`Density` for `caInit` -> `Seed Fill`), plus small Advanced cleanup.

---

### 2.4 hybrid

**Claimed identity**
- Blends structural sources (step/euclid/CA) into one generator.

**Actual generation behavior**
- Combines step/euclid/CA using determinism-dependent logic (intersection/union tendencies), weird flips, gravity scaffold bias.

**Current Main controls**
- Density ◻
- Len ◻
- Div ◻
- Mutate ✅
- Blend ✅
- Weight ✅

**Current Advanced controls**
- Same generic advanced matrix; lacks explicit hybrid-specific “source balance” readouts.

**Velocity / Accent behavior**
- Uses fallback step-normal base; accent works but is not hybrid-specific enough.

**Display truthfulness and quality**
- **acceptable but weak**: communicates blended intent, but state linkage is coarse.

**Recommended correction**
- **display truthfulness pass** (show per-step dominant source and agreement confidence).

---

### 2.5 gear

**Claimed identity**
- Interlocking rotational ring coincidence rhythm.

**Actual generation behavior**
- `createGearModel`: 2–4 rings from density, ring length ratios from length/subdiv, directional/phase drift from weird, coincidence gating with determinism/drop.

**Current Main controls**
- Rings ✅
- Len ✅
- Phase ✅
- Ratio ✅
- Mesh ✅
- Drift ✅

**Current Advanced controls**
- Generic advanced row still present; some values duplicate mental model.

**Velocity / Accent behavior**
- Velocity combines local density and pulse-index traces; accent blend is effective and musically plausible.

**Display truthfulness and quality**
- **acceptable** and interesting.
- Honest enough, but visuals can imply richer mechanical physics than generator actually computes.

**Recommended correction**
- **no action** (minor wording pass only).

---

### 2.6 radar

**Claimed identity**
- Rotating angular scan with target detections.

**Actual generation behavior**
- Creates density/gravity-dependent target population, sweeps discrete step angles, computes detection strength vs lock/drift/bias, thresholds hits, then drop-gates.

**Current Main controls**
- Targets ✅
- Range ✅
- Sweep ✅
- Drift ✅
- Lock ✅
- Bias ✅

**Current Advanced controls**
- Generic fields still shown though RADAR Main is already semantically complete.

**Velocity / Accent behavior**
- Mode-specific via `radarReturnStrengthAtStep`; accent depth meaning is strong.

**Display truthfulness and quality**
- **strong**: sweep, targets, and hit pulses tied to generated state.

**Recommended correction**
- **no action** (keep as reference quality baseline).

---

### 2.7 fractal

**Claimed identity**
- Recursive self-similar gating texture.

**Actual generation behavior**
- Multi-level block-gate scoring across powers-of-two scale; determinism/weird/gravity reshape thresholds and odd-block bias.

**Current Main controls**
- Depth ⚠✎ (mapped to `length`; naming implies recursion-depth directly)
- Scale ◻
- Branch ⚠✎ (gravity affects threshold bias; branch metaphor is loose)
- Jitter ✅
- Rotate ✅
- Sym ✅

**Current Advanced controls**
- Generic advanced matrix does not expose fractal-specific internals.

**Velocity / Accent behavior**
- Velocity currently sinusoidal by index; musically usable but semantically weak for fractal identity.

**Display truthfulness and quality**
- **weak/acceptable**: evocative but can imply more explicit recursion tree semantics than algorithm exposes.

**Recommended correction**
- **generation semantics pass (small)** for velocity shaping + label cleanup.

---

### 2.8 non-euclidean

**Claimed identity**
- Segmented uneven metric space with local pulse distributions.

**Actual generation behavior**
- Builds warped segment edges, per-segment local pulse models/rotations, then applies bend/drop/injection perturbations.

**Current Main controls**
- Density ◻
- Len ◻
- Div ◻
- Warp ✅
- Rotate ✅
- Prob ✅

**Current Advanced controls**
- Generic advanced has useful internals (Det/Grav), but grouping absent.

**Velocity / Accent behavior**
- Uses fallback step-normal velocity; under-represents segment topology.

**Display truthfulness and quality**
- **acceptable** after truthfulness correction, but still needs stronger segment-state readout.

**Recommended correction**
- **velocity/accent pass** (segment-local accent weighting).

---

### 2.9 markov-chains

**Claimed identity**
- Probabilistic state transitions (memory/randomness balance).

**Actual generation behavior**
- Two-state chain with per-step `p11`/`p01`, anchor influence from subdiv/gravity, optional drop, optional rotation.

**Current Main controls**
- Density ✅
- Len ◻
- Rate ◻
- Random ✅
- Memory ✅
- Bias ✅

**Current Advanced controls**
- Generic advanced matrix duplicates semantics and introduces unrelated CA controls.

**Velocity / Accent behavior**
- Velocity uses local density + step position; decent but could map to transition confidence.

**Display truthfulness and quality**
- **acceptable**: improved, but still not a fully explicit transition trace across time.

**Recommended correction**
- **display truthfulness pass** (animate actual state-path transitions).

---

### 2.10 l-systems

**Claimed identity**
- Rewrite-system branching transformed into rhythm.

**Actual generation behavior**
- Token rewrite generations with mutation, then life-density gating with branch/determinism/drop controls.

**Current Main controls**
- Density ◻
- Depth ⚠✎ (mapped to length; “horizon” interpretation, not literal generation depth)
- Rate ◻
- Branch ✅
- Rewrite ✅
- Stable ✅

**Current Advanced controls**
- Generic list; no rewrite-specific grouping.

**Velocity / Accent behavior**
- Fallback velocity profile; not rewrite-aware.

**Display truthfulness and quality**
- **weak/acceptable**: branch tracer is conceptually right but semantically thin.

**Recommended correction**
- **display + velocity/accent pass** (rewrite-age or branch-depth-informed energy).

---

### 2.11 xronomorph

**Claimed identity**
- Phase-morph fusion among multiple generator sources.

**Actual generation behavior**
- Builds Euclid/CA/Step sources, computes sinusoidal chooser/phase tracks, selects/fuses bits via determinism/morph rules.

**Current Main controls**
- Density ◻
- Len ◻
- Scale ◻
- Morph ✅
- Skew ⚠✎ (gravity mostly acts as source shaping/bias, “Skew” is vague)
- Shift ✅

**Current Advanced controls**
- Generic advanced clutter; mode would benefit from explicit “fusion” fine controls eventually.

**Velocity / Accent behavior**
- Fallback profile; should reflect dominant source/chooser confidence.

**Display truthfulness and quality**
- **acceptable** after truthfulness pass, still somewhat abstract for live interpretation.

**Recommended correction**
- **velocity/accent pass** + minor control rename.

---

### 2.12 genetic-algorithms

**Claimed identity**
- Population evolution with selection and mutation.

**Actual generation behavior**
- Fixed-size population, density/anchor fitness scoring, elite selection + crossover + mutation over generations, best chromosome output.

**Current Main controls**
- Fitness ✅
- Len ◻
- Rate ◻
- Mutate ✅
- Select ✅
- Cull ✅

**Current Advanced controls**
- Generic matrix; no generation/population context.

**Velocity / Accent behavior**
- Fallback step-normal profile; misses GA semantics (fitness/confidence/emergence).

**Display truthfulness and quality**
- **weak with misleading risk**: can imply explicit population timeline that is not fully shown.

**Recommended correction**
- **display truthfulness pass** (either explicit generation stages or simplified honest output view).

---

### 2.13 one-over-f-noise

**Claimed identity**
- Colored stochastic process (correlated noise) thresholded into rhythm.

**Actual generation behavior**
- Multi-band stochastic refresh (low/mid/high), weighted color score vs moving threshold, drop gate, rotation.

**Current Main controls**
- Density ✅
- Len ◻
- Rate ◻
- Rough ✅
- Correl ✅
- Drift ✅

**Current Advanced controls**
- Generic matrix; acceptable but repetitive.

**Velocity / Accent behavior**
- Velocity is random sample; musically plausible but could better track local color/threshold distance.

**Display truthfulness and quality**
- **acceptable**: honest trajectory + threshold feel.

**Recommended correction**
- **no action** (optional future enhancement only).

---

## 3) Cross-mode parameter-label analysis

### A) Shared parameter problem

Current shared params are useful for patch compatibility and common modulation wiring, but labels should stay mode-local in Main.

Recommended semantic label map by intent:

- `density`: Density / Pulse / Targets / Fitness / Fill / Activity (mode dependent)
- `length`: Len / Steps / Range / Horizon / Chromosome / Cycle
- `subdiv`: Div / Rate / Sweep / Ratio / Scale
- `weird`: Var / Spread / Mutate / Drift / Morph / Rough / Rewrite
- `determinism`: Det / Memory / Lock / Mesh / Select / Stable / Sym
- `gravity`: Bias / Anchor / Weight / Branch / Drift-bias / Pull
- `drop`: Prob / Skip / Decay / Cull
- `euclidRot`: Rotate / Shift / Phase
- `caRule`: Rule (only where CA-derived)
- `caInit`: Seed Fill / Init (only where CA-derived)
- `accent`: Accent Depth / Velocity Accent (family-global but should remain explicit)

Recommendation: keep underlying keys unchanged; continue per-mode labels on Main; extend this strategy to Advanced.

### B) Main vs Advanced/Fine-tune placement

**Main should contain**
- identity-defining controls (about 6 controls, two rows max)
- direct performance shaping

**Advanced/Fine-tune should contain**
- secondary stochastic/tuning controls
- shared infrastructure controls when not central to mode identity
- optional expert offsets/thresholds in future

Current issue: Advanced currently shows near-global fixed matrix regardless of mode. Recommended: mode-conditioned Advanced sections with shared fallback.

### C) Naming of Advanced tab

Recommendation: migrate label from **Advanced** to **Fine-tune** once control grouping is improved.

Why:
- Better matches GRIDI’s instrument-first identity (playable surface + deeper shaping),
- Less “developer panel” tone,
- Aligns with compact fixed-shell ergonomics.

---

## 4) Advanced/Fine-tune tab analysis

Current contents (all modes): Drop, Det, Grav, Accent, Rotate, CA rule, CA init.

Audit result:

- Pros:
  - Gives access to key shared internals quickly.
  - Keeps patch compatibility obvious for power users.
- Cons:
  - Not mode-aware enough (irrelevant controls visible for many modes).
  - Duplicates Main semantics heavily in mature modes.
  - Visual grouping is flat; no “Global vs Mode” segmentation.

Recommended structure:

1. **Global shaping**: Drop, Accent.
2. **Stability/Bias**: Determinism, Gravity (mode-local labels).
3. **Phase/Topology**: Rotate/Shift/Phase (only when used meaningfully).
4. **CA internals**: Rule, Seed Fill (only CA-involved modes, e.g., CA/Hybrid/XronoMorph).

---

## 5) Display truthfulness matrix

| Mode | Classification | Notes |
|---|---|---|
| step-sequencer | strong | clear step state + playhead |
| euclidean | strong | truthful cycle distribution |
| cellular-automata | strong/acceptable | truthful, slightly compressed |
| hybrid | acceptable/weak | truthful intent, low state granularity |
| gear | acceptable | strong identity, slight physics over-impression |
| radar | strong | best-in-class truthfulness currently |
| fractal | weak | evocative but semantically thin |
| non-euclidean | acceptable | improved, still needs stronger segment detail |
| markov-chains | acceptable | better truth, transition path could be clearer |
| l-systems | weak/acceptable | branch metaphor okay, low state specificity |
| xronomorph | acceptable | improved truth, still abstract live readability |
| genetic-algorithms | weak / misleading risk | must show real evolution state or simplify |
| one-over-f-noise | acceptable | honest and stable |

### Next 5 display correction targets (ranked)

1. genetic-algorithms
2. fractal
3. l-systems
4. hybrid
5. markov-chains

---

## 6) Recommended next 5 implementation passes

All passes are intentionally small/reviewable and preserve flat mode IDs + patch compatibility.

### Pass 1 — Mode-aware Advanced grouping + relevance filters
- Scope: UI-only control organization for trigger Advanced.
- Risk: **low**.
- Likely files: `src/ui/triggerModule.ts`, `src/ui/style.css`, docs update.
- Why first: immediate clarity win across all modes, minimal engine risk.

### Pass 2 — Label-semantic cleanup for weakest mismatches
- Scope: rename mode labels/tooltips (no engine behavior changes).
- Risk: **low**.
- Likely files: `src/ui/triggerModule.ts`, possibly docs/audits.
- Why second: resolves user-facing ambiguity before deeper behavior work.

### Pass 3 — Genetic Algorithms display honesty pass
- Scope: either explicit generation/selection snapshots or simplification to guaranteed-truthful state.
- Risk: **medium**.
- Likely files: `src/ui/triggerDisplaySurface.ts`, maybe helper model in `module.ts`.
- Why third: currently largest truthfulness risk.

### Pass 4 — Fractal + L-Systems velocity/accent semantics uplift
- Scope: mode-specific velocity signals derived from actual internal structure.
- Risk: **medium**.
- Likely files: `src/engine/pattern/module.ts`, docs note.
- Why fourth: improves musical identity without broad refactor.

### Pass 5 — Hybrid display linkage refinement
- Scope: clearer per-step source contribution/consensus visualization.
- Risk: **medium**.
- Likely files: `src/ui/triggerDisplaySurface.ts`, optional model helper in `module.ts`.
- Why fifth: completes structural family coherence and improves learnability.

---

## 7) Open questions / deferred ideas

1. Should GEN `accent` remain globally normalized or gain optional mode-specific curves in Fine-tune?
2. Should some conceptual modes expose a tiny “explain token” in footer (e.g., `p11/p01`, `segments`, `generation`) to reinforce truthfulness?
3. How far should per-step interactive editing go outside step-sequencer/hybrid without DAW drift?
4. Should Advanced be renamed immediately to Fine-tune, or only after relevance/grouping lands?
5. Should display simplification be preferred over richer visuals whenever internal state models are not yet externally exposed?

---

## Legacy alias and migration note

- Legacy mode aliases remain normalized in generation path (`step` -> `step-sequencer`, `euclid` -> `euclidean`, `ca` -> `cellular-automata`).
- Prior semantic mismatch `sonar` naming has been corrected in implemented mode naming to `radar`; SONAR remains roadmap/future distinct behavior.
