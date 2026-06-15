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
- Routing health summary with compact warning counts
- Confirmed `Clean stale routing refs` action for missing module/bus references only
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

## Stale-reference cleanup

The Routing overview can now offer a confirmed cleanup action when validation finds references to modules or buses that no longer exist. The action removes only invalid references from legacy `triggerSource`, legacy `modulations`, legacy `connections`, and typed `Patch.routes` records. Opening the overview does not mutate state, and cancellation leaves the patch unchanged.

This is not a routing ownership migration. Legacy routing remains supported, `Patch.routes` remains an optional typed overlay rather than the sole runtime authority, and typed-route parity/ownership consolidation remain future v0.4 work.

## Typed/legacy parity characterization

The next v0.4 routing pass added an executable compatibility matrix for typed and legacy route coexistence: [`routing-compatibility-matrix.md`](routing-compatibility-matrix.md).

That pass did not change routing ownership. The global overview still follows `compileRoutingGraph()` output, which means it can intentionally differ from runtime fallback behavior in known hybrid cases, especially partial typed event adoption and typed modulation routes.
