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

### `v0.4` — Performance routing (planned)

- More complete effect/module routing UX.
- Better transport/clock interfaces for extensibility.
- Additional safety checks around invalid graph states.

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

## Near-term priorities

1. Keep behavior stable while reducing internal complexity.
2. Expand architecture docs (`docs/architecture/`) with concrete diagrams.
3. Preserve deterministic tests as data model evolves.
