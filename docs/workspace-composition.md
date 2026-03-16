# Workspace composition redesign (modular canvas)

## Design note
This pass replaces the previous “family cards + browser card” feeling with a disciplined modular canvas:

- Each family (Trigger, Drum, Synth, Visual) now renders as a lane containing **uniform module cells**.
- Lanes always remain balanced by filling unused cells with intentional add-slots.
- Add is now local to the slot location (click in-cell to open a compact insertion menu).

## Fixed module dimensions
Fixed proportions are enforced in CSS with shared cell variables:

- `--module-cell-w`
- `--module-cell-h`

All module and add-slot surfaces are rendered inside `.moduleCell`, and `.moduleCell > .moduleSurface` is forced to `height: 100%`, so every occupied and empty cell shares the same visible footprint.

## Add-slot behavior
Add-slots are now a dedicated module-shaped placeholder:

- subdued card with a centered plus sign
- click opens local “insert here” menu anchored near click point
- keyboard enter/space toggles the menu
- hover/focus states are restrained
- drag-over adds receptive highlighting (`.dragReady`)
- drop handler accepts family-compatible module kinds when drag payloads are provided

## Drag-and-drop status
Full drag-and-drop move/reorder is **prepared structurally** in this pass:

- add-slots already expose dragenter/dragover/dragleave/drop affordances
- slot compatibility checks are implemented for dropped kinds
- module-origin drag payload production and live grid reordering can be added in a follow-up pass without changing slot architecture

## Screenshot deliverables
I attempted to produce before/after screenshots, but this environment cannot install frontend dependencies (`vite` unavailable due registry policy), so the app could not be launched for capture in this run.
