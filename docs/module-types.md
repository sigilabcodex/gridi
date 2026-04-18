# Module types

This document describes module families in terms of purpose and behavior.

## Trigger

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

## Module organization via stages

- Stages (Scenes/Worktables) provide additional workspace organization within a single session.
- Typical usage is role-based grouping: e.g. a drums stage, synth stage, bass stage, lead stage, or part-based stage split.
- This supports live performance navigation by letting players jump quickly between focused module groupings.
- Module behavior, routing semantics, and transport context remain global across stages.
