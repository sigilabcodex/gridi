# Canonical module faceplate grammar

This document defines the shared inner-tab composition grammar used by Trigger, Drum, Synth, Control, and Visual modules.

## Shell contract (already shared)

- Header row (identity + module controls)
- Face row (active tab panel)
- Bottom tab row

Shell dimensions and row heights are fixed by canonical shell tokens in `src/ui/style.css`.

## Faceplate section primitives

All families compose tab content with shared section primitives:

- `.faceplatePanel`: base panel wrapper
- `.faceplateMainPanel`: canonical Main tab panel
- `.faceplateStackPanel`: canonical Routing/Settings stack panel
- `.faceplateSection--io`: compact summary/IO strip
- `.faceplateSection--feature`: primary visual/generator/mode block
- `.faceplateSection--controls`: primary control grid/rows
- `.faceplateSection--secondary`: optional secondary control strip
- `.faceplateSection--bottom`: bottom strip anchored to remain visible

Spacing rhythm uses shared tokens only:

- `--faceplate-gap-xs: 4px`
- `--faceplate-gap-sm: 8px`
- `--faceplate-gap-md: 12px`

## Tab responsibilities

- **Main**: compact IO summary (optional), family primary feature block, playable controls, anchored bottom strip where applicable.
- **Routing**: source/target assignment and connectivity-specific editing only.
- **Advanced** (current code label: `Settings`): secondary controls only; avoid empty placeholders.

For the full canonical rule set (zones, density limits, accessibility, MIDI-readiness, and module-family matrix), see [`docs/faceplate-architecture-v1.md`](faceplate-architecture-v1.md).

## Family application notes

- Trigger: Main = IO summary + generator/readout feature + playable rhythm controls + anchored bottom rack.
- Drum: Main prioritizes tone/performance controls; secondary Snap/Noise moved to Settings.
- Synth: Main prioritizes timbre/envelope/performance controls; secondary Mod depth moved to Settings.
- Control: Main = compact target summary + mode/shape + core shaping knobs + bottom meter.
- Visual: Main prioritizes display canvas/readout; routing complexity remains in Routing.
