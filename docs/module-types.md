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
