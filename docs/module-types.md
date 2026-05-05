# Module types

This document describes module families in terms of purpose and behavior.

## Trigger (GEN / Generator)

**Naming / identity**
- UI-facing label: **GEN** (Generator).
- Engine family: `trigger`.
- Mode IDs (for example `step-sequencer`, `radar`) are stable patch-level identifiers.
- Reference: [`docs/gen-modes.md`](gen-modes.md).

**Purpose**
- Generate timed events that drive other modules.

**Behavior**
- Produces deterministic pattern windows from seed + parameters.
- Can target multiple sound modules.

**Typical controls**
- Density, length, subdivision, drop probability, determinism/weirdness.
- Generator mode and seed/reseed controls.

## Drum

**Purpose**
- Percussive voice generation.

**Behavior**
- Usually responds to Trigger events.
- Designed for transient/percussive shaping.

**Typical controls**
- Pitch/body, decay, tone/noise, level, pan.
- Trigger source selection and routing/settings in tabs.

## Synth

**Purpose**
- Tonal voice generation.

**Behavior**
- Implemented as `tonal` module type using the `synth` engine.
- Typically triggered by Trigger modules.

**Typical controls**
- Waveform, filter (cutoff/resonance), envelope, level/pan.
- Trigger source/routing and additional settings in tabs.

## Visual

**Purpose**
- Display and analysis of runtime behavior.

**Behavior**
- Non-audio modules such as scope/spectrum/pattern display.
- Main face prioritizes visualization output.

**Typical controls**
- Display mode and analysis settings (kept compact).

**Planned visual-mode direction**
- Add a **time-sensitive spectrogram** mode: frequency + intensity history over time with readable color/gradient history.
- Position this as a performance and engineering aid inside the Visual family (alongside scope/spectrum/pattern views), not as a separate utility product.
- Keep implementation details open for now (render path, buffering strategy, and exact interaction model remain design-stage decisions).

## Control

**Purpose**
- Generate modulation signals for parameter movement.

**Behavior**
- Includes LFO/drift/stepped style sources.
- Used as modulators for trigger/voice parameters.
- Present and usable, but broader control-routing UX is still in progress.

**Typical controls**
- Kind/waveform, rate or speed, amount, phase/randomness depending on control kind.

## Cross-family design principle

For every module family, GRIDI should support three layers:

- **Kind/family** (what class of module it is),
- **Mode/subtype** (behavior variant inside that kind),
- **Module presets** (local recallable control state).

This principle is not GEN-only; it applies to Drum, Synth, Control, Visual, and future module families.

## Planned generation-mode directions (Trigger/GEN family)

These are roadmap-level generation directions, not finalized DSP/module contracts.

### Image-driven / image-to-sound

- A generation mode may accept user-uploaded images, including large source images, then reduce/convert/quantize them into a compact internal representation for instrument use.
- The reduced image representation should behave like a small 2D data field that can be scanned/interpreted musically.
- Future mapping directions include scan orientation (left→right, right→left, top→bottom, bottom→top), diagonal scans, rotating angles, and direction changes over time.
- Scan/traversal behavior should remain a future modulation target so CTRL modules can influence direction, angle, traversal, or interpretation.
- This follows established image-sonification traditions while staying instrument-first: fast experimentation, playable outcomes, and compact module workflows.

### Quantum / Schrödinger-inspired (conceptual)

- A generation mode family may use quantum-inspired metaphors (indeterminacy, branching states, observation/collapse behavior) as artistic control language.
- This is explicitly conceptual and musical rather than a claim of scientific simulation.
- Goal: expressive uncertainty and stateful variation as part of GRIDI’s exploratory instrument identity.

### Dataset / spreadsheet-driven

- A generation mode may ingest lightweight tabular sources (CSV/spreadsheet/table exports) as event-shaping input.
- Future mapping can include repetitive pattern extraction, value-to-parameter mapping, weighted variation, and constrained/probabilistic behavior grounded in dataset structure.
- This direction is explicitly **data-driven generation**, not AI/ML analysis and not an AI-agent workflow.
- Data ingestion is framed as a creative source for the instrument, not a pivot into analytics software.

## Module organization via stages

- Stages (Scenes/Worktables) provide additional workspace organization within a single session.
- Typical usage is role-based grouping: e.g. a drums stage, synth stage, bass stage, lead stage, or part-based stage split.
- This supports live performance navigation by letting players jump quickly between focused module groupings.
- Module behavior, routing semantics, and transport context remain global across stages.
