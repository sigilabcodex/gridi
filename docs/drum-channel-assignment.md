# Drum channel assignment (Auto + explicit channels)

This follow-up pass keeps the existing drum routing architecture but clarifies behavior and UI for explicit channel assignment.

## User-facing model

Each drum module has a `drumChannel` mode:

- `auto`
- `01` … `08`

`auto` remains the default for new and migrated patches.

## Semantics

### Auto (backward-compatible default)

`auto` keeps the existing differentiated drum behavior:

- If one drum is connected to a trigger, it accepts all trigger events.
- If multiple drums are connected to one trigger, drums are split by inferred role from `basePitch` (`low | mid | high | accent`).

This preserves old patch behavior because missing/invalid `drumChannel` values normalize to `auto`.

### Explicit channels (`01` … `08`)

When `drumChannel` is explicitly set to a numbered channel:

- inferred auto role filtering is disabled for that drum
- the drum subscribes to a strict shared channel event stream for `(trigger, channel)`
- drums on the same explicit channel receive the same timing pattern
- drums on different explicit channels receive different channel streams

In other words: explicit channels are true subscriptions, not lane hints.

## UI changes in this pass

- Compact selector still uses `Chan` label.
- Channel value is displayed only once (no duplicated number readout).
- Options now show:
  - `AU`
  - `01` … `08`
- `Focus` remains in Drum Advanced, reflowed on the bottom row after `Noise color`, and allowed to span two slots to keep the fixed shell stable.

## Current limitations (intentional)

Still deferred in this phase:

- no routing matrix/editor popup
- no dynamic/infinite channel count
- no MIDI routing expansion for drums
- no per-channel parameter pages

This remains a focused refinement on top of current scheduler/routing foundations.
