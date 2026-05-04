# UI Faceplate Grammar (current Drum + GEN + SYNTH baseline)

This document captures the current, practical faceplate grammar emerging from Drum, GEN, and SYNTH work.

## Current state (implemented reality)

### Canonical shell order

1. **Header**: `[type/kind] [preset] [on/off + actions]`
2. **Main display/feature surface** (dominant when behaviorally meaningful)
3. **Primary controls** (6-column grammar where applicable)
4. **Tabs** (`Main / Fine-tune / Routing` in UX; many modules still map Fine-tune to internal `SETTINGS` IDs for compatibility)
5. **Bottom status strip** (compact state/readout role)

### Fixed-shell rule

- Module outer footprint is fixed across module kinds.
- Tab changes swap face content without resizing the module shell.
- Main face should stay playable without forcing navigation to setup-heavy tabs.

### Six-column control logic

- Main controls are arranged with a six-column rhythm where applicable.
- Main remains compact/performance-first (typically one or two rows max).
- Deeper controls belong in the Fine-tune face (often backed by existing `SETTINGS` tab IDs).

### Display surfaces are behavior surfaces

Display areas are not decorative labels.

They should communicate active behavior:
- GEN: mode/seed/algorithm pattern behavior.
- Drum: envelope/body/noise/shape behavior context.
- Synth: coherent tonal/timbre behavior context (structurally in place; richer behavior display still evolving).
- Control/Visual: currently functional but pending deeper interaction and expansion.

### Face rhythm

Current module rhythm is:
- identity first,
- behavior surface second,
- playable controls third,
- fine-tune/routing split into dedicated tabs,
- compact bottom strip for persistent status.

This rhythm is now the practical baseline for new module work.

## Near-term pending UI refinements (documented, not implemented)

- Add-module placeholder plus should be centered above the label (not top-anchored).
- Top/global header still needs refinement.
- Global sliders may move toward a more chip-like/custom GRIDI aesthetic.
- Display surfaces likely need richer interaction feedback.
- Routing UX may continue evolving without necessarily changing routing ownership architecture.

## Longer-term direction (speculative)

- Richer animated/live behavior in module display surfaces.
- More interactive display modules and behavior-linked visual controls.
- Expanded family-specific face grammars as CONTROL and VISUAL mature.

See also: [`docs/ui-principles.md`](ui-principles.md), [`docs/faceplate-architecture-v1.md`](faceplate-architecture-v1.md), [`docs/roadmap-instrument-state.md`](roadmap-instrument-state.md).
