# GRIDI Status

## Current version

- App version: `0.33.0` (`src/version.ts`)
- Patch model: `0.3`

## Current state (implemented reality)

GRIDI is now transitioning from prototype behavior into a playable modular instrument.

### Module maturity snapshot

- **Drum**: substantially refined and currently the most mature sound faceplate/reference for compact playable density.
- **GEN (Trigger)**: substantially refined with mode-aware Main + Fine-tune organization and multiple behavior-truthful/model-driven displays, while some conceptual modes remain intentionally marked as acceptable/weak for follow-up.
- **SYNTH (Tonal)**: now structurally viable and visually coherent within the shared shell and tab grammar.
- **CONTROL**: functional and usable, but still pending major refinement in interaction depth and surface clarity.
- **VISUAL**: functional for core monitoring (scope/spectrum), but still pending major expansion in mode breadth and interaction richness.


### GEN status (current milestone)

Implemented GEN modes (13):
- step-sequencer
- euclidean
- cellular-automata
- hybrid
- gear
- radar
- fractal
- non-euclidean
- markov-chains
- l-systems
- xronomorph
- genetic-algorithms
- one-over-f-noise

Current strengths:
- Mode registry/staging metadata and convergence audit are in place.
- GEN display truthfulness contract is active and now reflected in mode implementation/docs.
- Mode-aware Main/Fine-tune organization is established, with global tab order now standardized as `Main | Fine-tune | Routing`.
- `Advanced` naming has been replaced by `Fine-tune` at the UX level.
- Velocity/accent semantics are now coherent at family level, including fractal + l-systems alignment where merged.

Recently completed stabilization/display/control work:
- RADAR rename and semantic correction are complete; implemented rotating scan mode is **RADAR**.
- **SONAR** is intentionally reserved for a future pulse/echo/terrain mode and is not implemented yet.
- RADAR display correction landed (discrete scan-step alignment, truthful hit pulses, control-meaning alignment).
- Markov, Non-Euclidean, and XronoMorph display corrections landed to reduce decorative/misleading behavior.
- Step Sequencer display/readout refinements landed.

Remaining known weak spots:
- Some conceptual modes still have weaker visual truthfulness/readability than reference-quality modes (notably GA/Fractal/L-Systems/Hybrid).
- A subset of modes still rely on generic/shared control labels where mode-specific labels would better communicate behavior.
- Fine-tune clarity can still improve in mode-specific grouping density and wording consistency.

Recommended next GEN follow-ups:
1. Strengthen weakest mode displays with direct runtime-state mappings (especially GA, Fractal, L-Systems, Hybrid).
2. Continue semantic label refinement on Main/Fine-tune while preserving stable patch keys.
3. Start interactive display editing from Step Sequencer and Hybrid before broad rollout to all GEN modes.
4. Keep RADAR and future SONAR semantics separate (rotating scan vs pulse/echo propagation).

Reference: [`docs/gen-mode-design-principles.md`](gen-mode-design-principles.md), [`docs/gen-modes.md`](gen-modes.md).

### Instrument-level status

- GEN reference: [`docs/gen-modes.md`](gen-modes.md) (stable mode IDs, semantics, display-truthfulness status, RADAR vs planned SONAR distinction).

- Shared fixed shell + tabbed module face system is stable.
- Routing ownership is currently voice-owned (`triggerSource` on sound modules), with trigger-side routing UI acting as an editor/bridge.
- CTRL routing now enforces single-owner modulation per parameter, blocks self-modulation, drives visible in-place movement on modulated controls (trigger density, drum pitch, synth cutoff), supports temporary user-override while editing, gates modulation activity by transport/audio-running state, and provides structured module/group/parameter selection in CTRL Routing while staying aligned with the global routing overview model.
- Drum modules now support explicit channel assignment (`Auto`, `01`–`08`) with Auto fallback preserving differentiated behavior, while explicit channels behave as strict shared subscriptions.
- Session presets (whole-patch state) and module presets (local module state) both exist and are active.
- First live Web MIDI keyboard input foundation is now active for synth modules (single target, note on/off, mono/poly-aware reception, compact input selector with hardware-first auto preference).
- MIDI now appears as a first-class routing domain in the global Routing UI: users can assign `MIDI IN` input source + synth target explicitly, and MIDI routes are listed alongside event/modulation/audio routes.

## Near-term next steps (active priority)

1. Keep Drum/GEN/SYNTH quality high while improving CONTROL and VISUAL parity.
2. Continue clarifying module-kind / mode / preset / session semantics across docs and UI text.
3. Expand module preset banks from starter seeds toward curated instrument-grade defaults.
4. Improve display-surface interaction feedback so displays act as behavior surfaces, not passive labels.
5. Refine top/global header and add-slot affordances without breaking current shell/routing architecture.
6. Introduce a dedicated mobile global-controls pattern (recommended next: compact launcher + sheet/drawer) so transport/session utilities stop competing with module workspace height on landscape phones/tablets.
7. GEN field modes are intentionally split by metaphor/behavior:
   - **RADAR** (implemented): rotating directional scan, discrete phase/playhead timing, angular target detection.
   - **SONAR** (future): pulse-based radial propagation with distance/time-of-flight and echo/resonance behavior; terrain/field simulation hooks are planned.

## Longer-term ideas (not implemented yet)

- Richer GEN mode completion and stronger mode-specific visual behavior.
- Full graphical representations for all generator modes.
- More animated/live module displays and interactive behavior surfaces.
- CONTROL redesign and expansion.
- VISUAL expansion with multiple dedicated visual modes.
- Time-sensitive spectrogram visual mode for frequency/intensity-over-time analysis in performance and sound-design workflows.
- Image-driven generation direction (image-to-sound scanning/mapping exploration).
- Quantum/Schrödinger-inspired generation direction (conceptual indeterminacy/observation metaphors).
- Dataset/spreadsheet-driven generation direction (tabular data as structured event source; data-driven and explicitly non-AI).
- Possible dedicated routing-management module.
- MIDI implementation and mapping workflows.
- Live coding module exploration.
- Sampling/looping/granular ideas.
- Experimental/dangerous mode track.
- Preset-bank curation as a first-class instrument experience.
- Future multichannel / installation-aware spatial workflows.

## Known limitations

- UI and mutation orchestration are still centralized in `src/ui/app.ts`.
- No browser integration/e2e test harness yet.
- Runtime state is browser-local (localStorage), no multi-user/session sync.
- Security posture is primarily static review plus disciplined DOM usage.

See also: [`docs/ui-principles.md`](ui-principles.md), [`docs/module-identity-and-presets.md`](module-identity-and-presets.md), [`docs/roadmap-instrument-state.md`](roadmap-instrument-state.md).
