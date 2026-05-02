# GEN display truthfulness audit (2026-04-23)

## Display contract (GEN-specific)

- Displays are behavior surfaces, not decorations.
- Every moving element must be tied to pattern phase, scheduler time, generated events, or mode state.
- Every major control should have a visible consequence when practical.
- If a mode cannot yet display its algorithm truthfully, prefer a simple honest readout over fake complexity.
- Display visuals may be beautiful, but beauty must emerge from structure.

## Mode-by-mode audit

### step-sequencer — **truthful / strong**
- Current display: fixed read-only step grid with playhead and per-cell intensity.
- Represents: actual pattern bits + runtime step index.
- Misleading/decorative risk: low.
- Parameters that should visibly affect display: `length`, `subdiv`, `density`, `gravity`, `accent`, `drop`.

### euclidean — **truthful / strong**
- Current display: ring dots + moving playhead indicator.
- Represents: Euclidean pulse placement and rotation.
- Misleading/decorative risk: low.
- Parameters: `density`, `length`, `euclidRot`, `weird`, `drop`.

### cellular-automata — **truthful / strong**
- Current display: evolving CA rows with row playhead.
- Represents: sampled CA generations used to derive pattern activity.
- Misleading/decorative risk: low-medium (generation windowing is compressed).
- Parameters: `caRule`, `caInit`, `density`, `subdiv`, `weird`, `drop`.

### hybrid — **mostly truthful but visually weak**
- Current display: step preview + Euclidean ring + blend meter.
- Represents: hybrid scaffold and blend direction.
- Misleading/decorative risk: low, but state linkage is coarse.
- Parameters: `determinism`, `gravity`, `density`, `length`, `weird`.

### gear — **mostly truthful but visually weak**
- Current display: concentric gears, tooth slots, coincidence indicator.
- Represents: ring lengths/rotations and coincidence triggering.
- Misleading/decorative risk: medium-low (appearance implies richer tooth physics than used).
- Parameters: `length`, `subdiv`, `density`, `gravity`, `determinism`, `weird`, `euclidRot`.

### RADAR — **truthful / strong**
- Current display: rotating sweep + moving targets + return pulses.
- Represents: discrete step-aligned scan, range weighting, and generated hit detections.
- Misleading/decorative risk: low.
- Parameters that visibly affect display: `density` target count, `length` scan range, `subdiv` sweep speed, `weird` drift instability, `determinism` lock width, `gravity` range bias.
- Note: this mode was previously named `SONAR`; naming is now corrected to `RADAR` for semantic accuracy.

### SONAR — **not implemented (planned)**
- Planned system: pulse-based propagation field (no rotational sweep); this remains intentionally separate from implemented RADAR scan behavior.
- Emits periodic radial waves from an origin point.
- Targets respond to pulse traversal based on distance, density, and terrain/field interaction.
- Detection is based on wave intersection and echo/resonance return behavior.
- Planned parameter concepts:
  - pulse rate (frequency),
  - propagation speed,
  - attenuation,
  - terrain deformation,
  - reflection/absorption.
- Constraint: SONAR is a distinct future mode and must not reuse RADAR sweep logic.

### fractal — **mostly truthful but visually weak**
- Current display: layered recursive paths + cursor.
- Represents: fractal-like sampled contours tied to parameters.
- Misleading/decorative risk: medium (visual recursion stronger than generator evidence).
- Parameters: `length`, `subdiv`, `gravity`, `weird`, `euclidRot`, `density`.

### non-euclidean — **placeholder / deferred**
- Current display: warped segment bars with playhead.
- Represents: only coarse segmentation mood.
- Misleading/decorative risk: medium-high.
- Parameters: `weird`, `gravity`, `density`, `length`, `euclidRot`, `drop`.

### markov-chains — **mostly truthful but visually weak**
- Current display: simple node graph + 4x4 matrix readout.
- Represents: inferred transition tendencies.
- Misleading/decorative risk: medium (not an actual runtime state-transition trace).
- Parameters: `determinism`, `weird`, `gravity`, `density`, `drop`.

### l-systems — **mostly truthful but visually weak**
- Current display: branch path + tracer.
- Represents: parameterized turtle-like branching shape.
- Misleading/decorative risk: medium.
- Parameters: `density`, `weird`, `determinism`, `gravity`, `caRule`.

### xronomorph — **should be simplified until stronger semantics exist**
- Current display: lane A/B plus merged lane.
- Represents: phase-morphing intent.
- Misleading/decorative risk: medium-high when merge implies causality not present in generator output.
- Parameters: `length`, `subdiv`, `weird`, `density`, `gravity`, `euclidRot`.

### genetic-algorithms — **should be simplified until stronger semantics exist**
- Current display: population rows with fitness tint and playheads.
- Represents: pseudo-population concept.
- Misleading/decorative risk: medium-high (no explicit generation/selection timeline shown).
- Parameters: `length`, `density`, `weird`, `drop`, `gravity`.

### one-over-f-noise — **mostly truthful but visually weak**
- Current display: 1/f path + threshold grid + spark.
- Represents: smoothed noise trajectory and thresholded activation.
- Misleading/decorative risk: low-medium.
- Parameters: `density`, `weird`, `determinism`, `gravity`, `drop`.

## Focused correction implemented in this pass

Target: **RADAR**.

### What was corrected
- Sweep angle is now tied to the actual discrete radar scan step (`resolveAnimatedStepIndex`) rather than an unrelated continuous oscillator.
- Display target count now follows the same target-count model as pattern generation (`density` + `gravity`).
- Target drift/wander now follows the same per-step seeded wander model used by radar pattern generation.
- Detection brightness is derived from the same response/threshold relationship as radar generation (`lock` controls detection width, `gravity` contributes bias).
- Hit pulse/glow is now tied to actual generated hits at the current scan step.
- Decorative target-behavior categories and visual trails were removed to keep display semantics honest.

### Manual validation notes
- `Targets` visibly changes blip count.
- `Range` (`length`) changes sweep quantization and event spacing over a cycle.
- `Sweep` (`subdiv`) changes scan speed through the shared playhead timing model.
- `Drift` (`weird`) increases target instability/wander amplitude.
- `Lock` (`determinism`) narrows/widens effective detection acceptance.
- `Bias` (`gravity`) shifts field/range weighting and affects hit thresholding.
- Sweep highlights now coincide with real hit steps; strong pulse occurs only when generated hit events occur.

## Recommended next corrections

1. **Markov Chains**: tie node-transition highlighting to actual generated transition path over the current window.
2. **Genetic Algorithms**: either show explicit generation/selection steps or simplify to honest pattern density + mutation readout.
3. **XronoMorph**: expose actual morph phase/interpolation state instead of implied lane causality.
4. **Non-Euclidean**: replace decorative bar warp with true segment-edge/warp map derived from generator segment boundaries.
