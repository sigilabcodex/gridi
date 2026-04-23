# GRIDI Roadmap

This roadmap tracks architecture-first milestones. It intentionally avoids feature churn and prioritizes timing correctness, modularity, and maintainability.

## Current phase: `v0.32.x` stabilization

### Objectives in progress

- Harden modular patch model and migration behavior.
- Keep scheduler and pattern rendering deterministic.
- Improve docs/onboarding for new contributors.
- Tighten repository hygiene and dependency reproducibility.

## Milestones

### `v0.30` — Modular baseline (completed)

- Dynamic module grid and add-slot flow.
- Patch persistence with bank import/export.
- Initial visual modules and transport controls.

### `v0.31` — Core reinforcement (partially completed)

- Pattern source abstractions and tests.
- Routing foundations and validation.
- Ongoing cleanup of coupling between UI and engine concerns.

### `v0.32.x` — Sequencing separation (current)

- UI tab separation (`MAIN` / `SEQ` / `MIDI`).
- Stable look-ahead scheduler behavior with overlap dedupe tests.
- Patch `0.3` module/bus/connection shape active.
- Drum channel assignment (`Auto` + manual `01`–`04`) with compact faceplate control and backward-compatible auto dispatch fallback.
- CTRL routing refinement: one-controller-per-parameter enforcement, self-modulation blocking, and visible in-place modulation feedback with user override/resume behavior.

### `v0.4` — Performance routing (planned)

- More complete effect/module routing UX.
- Better transport/clock interfaces for extensibility.
- Additional safety checks around invalid graph states.
- First direct USB/Web MIDI keyboard input for synth performance (single-target live play) is now in place.
- MIDI IN routing has started moving into the Routing domain/UI (compact input+target assignment + overview visibility); MIDI OUT and deeper editing remain future work.

### `v0.41` — Visual analysis expansion (planned)

- Expand the Visual family with performance-usable analyzer modes while preserving fixed-shell module ergonomics.
- Add a **time-sensitive spectrogram** direction (frequency + intensity history over time) as an in-instrument visual mode.
- Focus on musical/engineering readability and live feedback value, not on DAW-style metering panels.

### `v0.45` — Stage / Workspace System (planned)

Motivation:
- Scale the grid for larger patches without losing instrument readability.
- Improve live-performance navigation by enabling fast workspace switching.

Initial version:
- Basic stage switching inside a single session.
- Layout separation per stage while keeping one shared patch/runtime context.
- No routing/engine/transport partitioning (all remain global).

Future expansion:
- Performance-oriented scene workflows built on stages.
- Optional transition-oriented interaction ideas that keep transport continuity.
- Deeper navigation ergonomics for larger live sets without DAW-like shells.

### `v0.5` — Generative ecosystem (planned)

- Additional pattern engines and module types.
- External sync and interoperability exploration.
- Extended test coverage for cross-module interactions.
- Exploration of advanced generation-mode families:
  - image-driven (image-to-sound) generation,
  - quantum/Schrödinger-inspired conceptual generation,
  - dataset/spreadsheet-driven generation (data-driven, non-AI).

### `v0.6+` — Exploratory generation families (long-term)

- Mature non-traditional generation directions into coherent, instrument-grade mode families.
- Keep image/data/conceptual generation module-scoped and performance-oriented.
- Avoid DAW drift and avoid pivoting into generic media-analysis or analytics-product scope.

## Near-term priorities

1. Keep behavior stable while reducing internal complexity.
2. Expand architecture docs (`docs/architecture/`) with concrete diagrams.
3. Preserve deterministic tests as data model evolves.
4. Define lightweight external asset-ingestion guardrails (image/data limits, scan/mapping boundaries) before implementation.
