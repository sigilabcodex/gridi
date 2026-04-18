# Routing hybrid model (Phase 2 scaffold)

## Why `routes[]` now exists

GRIDI now carries an explicit typed route list (`patch.routes[]`) as a forward-compatible routing scaffold.
It provides one place to describe event, modulation, audio, and future MIDI routes with explicit endpoints.

This is **model foundation work** only. It does not introduce a new routing UI, a global route editor,
or DAW-style patching interactions.

## Why legacy fields remain

Legacy fields remain compatibility-critical and are intentionally preserved:

- `triggerSource` on sound modules
- `modulations` maps on trigger/sound modules
- `connections[]` (+ `buses[]`) for current audio graph behavior

Existing UI surfaces still edit legacy fields today. Runtime behavior must stay stable during this phase.

## Route schema (current scaffold)

- `domain`: `event | modulation | audio | midi`
- `source`/`target`: typed endpoints (`module`, `bus`, `master`, `external:midi`)
- `enabled`
- optional `gain`
- optional `metadata`:
  - `createdFrom`
  - `parameter` (modulation target parameter)
  - `lane` (placeholder for future lane semantics)

## Resolver precedence policy (hybrid)

Per domain (`event`, `modulation`, `audio`):

1. If valid typed routes exist in `routes[]` for that domain, they are canonical.
2. If not, resolver backfills equivalent typed routes from legacy fields for that domain.

This prevents double-application in hybrid patches while preserving behavior for legacy-only patches.

### Consequences

- Legacy-only patches still resolve exactly as before.
- Hybrid patches can migrate incrementally by domain.
- Typed and legacy data can coexist during transition without duplicate effective routes.

## Validation (lightweight, conservative)

Current validation ignores invalid typed routes and surfaces warnings for issues such as:

- duplicate route ids
- invalid/missing module or bus references
- impossible domain↔endpoint combinations
- missing required metadata for modulation routes (`metadata.parameter`)

Invalid routes are safely ignored rather than causing runtime failure.

## Intentionally deferred (not in this phase)

- Global routing popup/editor
- New routing UX paradigms (cable/matrix/free-form patch panel)
- MIDI behavior/runtime wiring
- Synth mono/poly policy and voice allocation
- Drum lane-role execution semantics
- Bus DSP execution beyond current runtime support

This phase is only to establish typed route foundations with zero behavior regression.
