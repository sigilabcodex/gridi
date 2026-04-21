# CTRL target selection

This document describes control-modulation assignment flows and constraints.

## Two assignment entry points

GRIDI supports both routing directions:

1. **Source-side (CTRL Routing tab)**
   - Best for "this CTRL should modulate multiple things."
   - Uses the target module → parameter group → parameter checklist flow.

2. **Target-side (GEN/DRUM/SYNTH Routing tabs)**
   - Best for "this parameter needs a CTRL source."
   - Uses grouped **Mod in** sections with per-parameter source dropdowns.

Both entry points modify the same target module `modulations` map, so they remain coherent.

## Selection flow

Inside a CTRL module's **Routing** tab:

1. **Target module**
   - Choose a target module from controllable families.
   - Current controllable families in this pass: `DRUM`, `SYNTH` (tonal), and `GEN` (trigger).

2. **Parameter group**
   - After selecting a module, choose a compact parameter group for that module family.
   - Groups are intentionally structured to avoid long unscannable parameter lists.

3. **Parameter list (multi-select)**
   - Check one or multiple parameters in that group.
   - One CTRL can own many target parameters.

## Grouping logic

The current grouping catalog is family-based:

- **GEN/Trigger**: Rhythm, Feel, Pattern
- **DRUM**: Envelope, Tone, Spatial, Dynamics
- **SYNTH/Tonal**: Envelope, Tone, Pitch, Spatial

This grouping is designed to stay compact, readable, and expandable without introducing matrix routing.

## Constraint rules

- **One CTRL -> many parameters**: supported.
- **One parameter -> one CTRL**: assignment replaces prior owner on that specific target parameter key.
- **No self-modulation**: target selector excludes the current CTRL module, and routing validation/compiler also rejects self-modulation routes.

## Routing edit context behavior

Routing updates are applied with stable rerender behavior and persisted module tab state, so users remain on the active Routing tab while assigning or replacing routes.

## Transport-aware behavior

Modulation sampling/application is transport-aware:

- If transport is stopped, modulation is inactive.
- If audio context is suspended/stopped, modulation is inactive.
- When transport + audio are active again, modulation resumes.

This applies at modulation sampling/application layers, not only visual styling.

## Future expansion notes

Deferred intentionally:

- No global matrix editor.
- No graph/patch-cable routing editor.
- No full MIDI routing expansion.

Planned next expansions can add more controllable module families/parameter groups while preserving the same module -> group -> parameter flow.
