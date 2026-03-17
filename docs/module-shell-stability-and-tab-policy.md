# Module shell stability and tab policy

## Fixed footprint rule

All module families now render inside a fixed workspace cell (`--module-cell-w`, `--module-cell-h`) and each module surface fills that cell height. Tabs only swap panel visibility; they no longer change card dimensions. This keeps the grid rhythm stable when switching tabs or mixing module families.

## No internal scrollbar rule

Instrument modules no longer rely on generic internal scrolling regions. The surface face and tab panels are clipped (`overflow: hidden`) and content was curated to fit the shell. Overflow is handled by reducing/control-splitting content instead of introducing mini scroll panes.

## Per-family tab policy

Tabs are now contextual by family:

- **Trigger**: `Main`, `Settings`
- **Drum / Synth**: `Main`, `Routing`, `Settings`
- **Visual**: `Main`, `Settings`

Removed first-class tabs that were placeholder-only or not meaningful yet (for example global MIDI/Debug tabs on voice cards, routing/debug tabs on trigger cards).

## Main-face control philosophy

Main tabs now prioritize compact, musically meaningful controls:

- **Trigger**: pattern rail + generator/seed machine readouts, then density/length/drop/subdiv/determinism/weird controls.
- **Drum**: pitch/snap/decay/tone/noise plus level/pan.
- **Synth**: waveform/cutoff/resonance/envelope core (attack/decay) plus level/mod/pan.
- **Visual**: scope/spectrum display-focused main face.

Less-critical or setup controls were moved to `Settings` tabs.

## Display-language improvements

Trigger generator and seed controls were converted from plain form widgets into compact machine readouts that feel embedded in the instrument surface:

- generator mode is shown as a labeled mode display and can be cycled quickly
- seed appears as a padded readout with an explicit reseed affordance
- visual settings selectors now sit inside machine-style readout cards for consistency

## Delete safety aligned with undo

Delete uses a lightweight two-tap arm/confirm flow directly on the close button:

- first tap arms delete briefly and updates affordance text
- second tap confirms removal
- arm state times out automatically

This reduces accidental removals while staying fast and preserving the existing undo-first workflow (Ctrl/Cmd+Z).
