# Module identity and presets

This note defines the baseline model for separating module identity, engine type, and preset identity in GRIDI.

## Three distinct identities

Each module now carries three different identity layers:

1. **Instance identity** (`name`)
   - Human-readable name for this module instance in the current workspace.
   - Examples: `Trigger 1`, `Drum 2`, `Synth 1`, `Scope 1`.
2. **Engine identity** (`engine`)
   - Stable engine family used by runtime/audio/rendering code.
   - Allowed values: `trigger`, `drum`, `synth`, `visual`.
   - Engine identity is intentionally small and does not encode musical roles like kick/snare/pad.
3. **Preset identity** (`presetName`, optional `presetMeta`)
   - User-facing preset label and lightweight metadata container.
   - Examples: `Deep Kick`, `Dust Hat`, `Rubber Bass`, `Sparse Euclid`.
   - This is separate from instance name and can change independently.

## Naming logic

Default instance naming is now sequential and family-based:

- Trigger modules: `Trigger N`
- Drum modules: `Drum N`
- Synth modules: `Synth N`
- Visual modules: `Scope N`

The module instance name no longer uses preset labels.

## Default preset behavior

New modules get a default preset label immediately:

- Trigger: `Sparse Euclid`
- Drum: `Deep Kick`
- Synth: `Rubber Bass`
- Visual: family default (`Scope Default`, `Spectrum Default`, `Pattern Default`)

No preset persistence layer is introduced in this step; this is only the data-model and UI identity split.

## Why this prepares future preset/session systems

Separating `name`, `engine`, and `presetName` establishes a clean path for future capabilities:

- Swap presets without renaming modules.
- Keep stable module identity while trying sound/sequence variations.
- Add preset save/load and session management without changing engine taxonomy.
- Build preset browser/import/export flows on top of `presetName`/`presetMeta` fields.

This keeps GRIDI's engine model minimal while allowing rich variation through parameters and presets.
