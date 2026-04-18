# Routing overview UI (Phase 3)

## What changed

Phase 3 moves routing UI read-models onto the canonical compiled routing layer.

- Module routing summaries now derive from `buildRoutingSnapshot`, which is built from `compileRoutingGraph` output.
- The snapshot now carries a `UIRoutingOverview` with domain-grouped routes:
  - `eventRoutes`
  - `modulationRoutes`
  - `audioRoutes`
  - `byModule` (incoming/outgoing route index)
- Module link highlighting uses this canonical overview index rather than ad-hoc per-surface derivation.

## Global routing overview

A new read-only global routing overview is available from the header utility cluster via **Routing**.

Current capabilities:

- Session-level list of event/modulation/audio routes
- Domain filter (all/event/modulation/audio)
- Module filter (focus routes touching one module)
- Hover/click inspection signal that highlights related modules in the workspace
- Compact empty state when a section has no routes

## Intentional constraints in this phase

This overview is intentionally **read-only** and utility-scoped.

Not included yet:

- Global route editing
- Drag cables / patchbay graph editing
- MIDI route execution behavior
- Synth mono/poly policy UI
- Drum lane-role execution UI
- Audio bus runtime expansion

Phase 3 is visibility + canonical read-model migration, not patchbay editing.
