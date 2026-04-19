# Drum channel assignment (Auto + manual override)

This phase adds explicit drum-channel assignment while preserving the existing automatic differentiated drum behavior.

## User-facing model

Each drum module now has a `drumChannel` mode:

- `auto`
- `01`
- `02`
- `03`
- `04`

`auto` is the default for new and migrated patches.

## Auto behavior and compatibility

`auto` keeps the previous lane-role behavior:

- If one drum is connected to a trigger, it accepts all trigger events (legacy behavior).
- If multiple drums are connected to the same trigger, each drum is filtered by inferred role from `basePitch` (`low | mid | high | accent`).

This means old patches continue to behave the same after migration because missing/invalid `drumChannel` values normalize to `auto`.

## Manual channel override behavior

When `drumChannel` is explicitly set to a numbered channel, that drum no longer uses inferred role dispatch for that trigger relationship.

Channel mapping in this phase:

- `01` -> `low`
- `02` -> `mid`
- `03` -> `high`
- `04` -> `accent`

This enables intentional channel choices and shared channels:

- multiple drum modules can be assigned to the same channel
- explicit channel assignment wins over inferred auto dispatch

## UI changes

### Drum upper selector area

The upper compact selector area now prioritizes:

- `Trg` (trigger source)
- `Chan` (drum channel)

`Chan` includes a compact two-character hardware-style readout:

- `AU` for Auto
- `01` ... `04` for explicit channels

### Focus control moved

`Focus` (boost target) remains available but moved from the upper selector area into Drum **Advanced**.

## Deferred in this phase

- MIDI routing UI changes
- CTRL routing expansion
- per-channel parameter pages
- arbitrary channel count expansion
- full drum matrix/popup editors

This phase is intentionally compact: explicit channel assignment layered on top of existing routing and event semantics.
