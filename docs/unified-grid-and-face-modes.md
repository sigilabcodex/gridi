# Unified grid + face mode simplification pass

## What workspace grouping was removed

The workspace no longer renders family lanes (`Trigger Family`, `Drum Family`, `Synth Family`, `Visual Family`) as dominant containers.

It now renders a single neutral modular grid (`workspaceGrid`) where:

- every occupied module uses the same cell footprint,
- every empty cell is an add-slot,
- add-slots offer all module types,
- drag-move targets any empty slot in the unified grid.

This shifts the mental model from family catalog browsing to spatial patch building.

## How tabs now switch the module face

Trigger, drum, synth, and visual modules now place tabs at the bottom and switch the full face area above tabs.

Each module surface is organized as:

1. compact header/identity,
2. `surfaceFace` container with tab panels,
3. bottom tab bar.

When a tab changes, the currently active panel in `surfaceFace` changes; tabs no longer just reveal a small lower subsection.

## What was removed from default faces to reduce clutter

- Trigger default face keeps one primary pulse visualization (step grid rail) and removes duplicate symbolic preview from Main.
- Trigger advanced/diagnostic controls moved to Debug/Settings faces.
- Drum and synth default faces now show a compact 4-control performance set each.
- Routing, MIDI, and advanced setup are on non-main faces.
- Visual default face is display-first; mode/FFT controls moved to Settings face.

## How the default patch was simplified

Default patch now starts with:

- 2 triggers (`TRG_A`, `TRG_B`),
- 2 drums,
- 1 synth,
- 1 scope visual.

The synth and one drum share `TRG_A`, while the second drum uses `TRG_B`, making trigger-to-multiple-voice routing legible without a large showcase patch.
