# GRIDI architecture

This document is the high-level mental model for contributors.

## 1) Module system

GRIDI uses a patch document as the source of truth for module state and routing.

Core fields per module include:

- `type`: UI/domain shape (for example `trigger`, `drum`, `tonal`, `visual`, `control`)
- `engine`: runtime engine family (`trigger`, `drum`, `synth`, `visual`, `control`)
- `name`: instance label in the current workspace
- `presetName` (+ optional `presetMeta`): preset identity

Important distinction:

- `tonal` module type currently maps to `synth` engine.
- engine identity is intentionally small/stable; preset and instance labels carry user-facing variation.

## 2) Engine types

Current engine families:

- **trigger**: generates timed events/windows.
- **drum**: percussive synthesis/voice playback.
- **synth**: tonal synthesis/voice playback.
- **visual**: non-audio display/analysis modules.
- **control**: modulation signal generation.

## 3) Runtime layers

1. **Patch model** (`src/patch.ts`)
   - typed data model, normalization, migration, defaults.
2. **Audio/engine runtime** (`src/engine/*`)
   - voice handling, routing application, modulation sampling.
3. **Scheduler + pattern rendering** (`src/engine/scheduler.ts`, `src/engine/pattern/*`)
   - look-ahead window rendering and sample-accurate event scheduling.
4. **UI layer** (`src/ui/*`)
   - workspace rendering, module surfaces, tab state, user mutation flows.

## 4) Data flow (high level)

1. UI interaction edits patch state.
2. Patch update is normalized and propagated.
3. Scheduler renders upcoming event windows from trigger/pattern state.
4. Engine schedules or updates voices at exact audio time.
5. Visual/control modules sample or display runtime state.

The patch remains the stable boundary between UI intent and runtime behavior.

## 5) Future extensibility

The current model is designed so new capabilities can be added without changing the core taxonomy:

- New module variants can reuse existing engine families.
- New pattern/control engines can plug into scheduler/engine boundaries.
- Preset system work can expand on `presetName`/`presetMeta`.
- Routing UX can evolve while keeping patch-level connections as source of truth.

Planned extensibility themes (high level):

- **Visual mode extensibility**: Visual modules should support additional analyzer/display modes (including time-sensitive spectrogram behavior) without changing shell or routing fundamentals.
- **Generation-mode extensibility**: Trigger/GEN mode families should remain pluggable so conceptual/image/data-driven generation modes can share common scheduling boundaries.
- **External source ingestion boundaries**: future image/table inputs should be treated as lightweight creative assets with explicit size/format constraints rather than unrestricted file pipelines.
- **Image reduction boundary**: large uploaded images may be accepted at input, but generation modes should operate on reduced/quantized internal image fields for predictable performance.
- **Mapping layer growth**: reserve room for future mapping policies (scan direction/angle, traversal changes over time, value translation, weighting), with CTRL-modulatable traversal in scope; keep mapping contracts provisional until mode semantics are validated musically.
- **Data-driven (non-AI) scope**: spreadsheet/CSV generation should remain deterministic creative mapping behavior, not AI-agent or ML-analysis architecture.

See also staging guidance: [`docs/architecture/gen-family-staging-2026-04.md`](docs/architecture/gen-family-staging-2026-04.md).

## 6) Session vs Stage (Scene/Worktable)

- A **session** is the full patch state in one browser tab.
- A **stage** is a selectable workspace inside that same session.
- Stages are intended for layout segmentation and cognitive/performance navigation.

Non-goals of stages:

- Not separate audio worlds.
- Not separate engines.
- Not separate transport timelines.
- Not separate routing graphs.

Routing, engine state, and transport remain global across all stages so the instrument behaves as one coherent patch while the visible workspace changes.
