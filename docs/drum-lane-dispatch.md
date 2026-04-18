# Drum lane dispatch

This phase adds the first internal **GEN → DRUM role dispatch** behavior layer while keeping the existing routing model and timing behavior intact.

## Lane model

Drum events use a fixed lane set:

- `low`
- `mid`
- `high`
- `accent`

`mid` is the default lane fallback when lane data is missing or invalid.

## How GEN produces lanes

GEN pattern events already carry an internal lane index (`targetLane`).
The scheduler now normalizes that index into explicit lane roles:

- `0 → low`
- `1 → mid`
- `2 → high`
- `3 → accent`

Lane generation remains deterministic and tied to the existing pattern engine behavior. Density, probability (`drop`), and timing are unchanged.

## How DRUM modules interpret lanes

For each DRUM module, a preferred lane is inferred from `basePitch`:

- `basePitch < 0.30` → `low`
- `0.30 ≤ basePitch < 0.62` → `mid`
- `0.62 ≤ basePitch < 0.88` → `high`
- `basePitch ≥ 0.88` → `accent`

Dispatch policy:

- If a trigger drives **multiple drums**, each drum accepts only events matching its preferred lane.
- If a trigger drives **one drum**, that drum accepts all events (legacy behavior).
- If preferred-lane inference is unavailable, fallback is accept-all.

## Backward compatibility guarantees

- Existing patches continue to run.
- No lane UI/editor is introduced.
- No routing UI changes are required.
- No scheduler timing changes are introduced.
- No MIDI/polysynth changes are introduced.
- Event streams without lane metadata still have a stable fallback (`mid`) and continue to function.

## Not implemented yet

- User-editable lane assignment
- Per-lane modulation or velocity shaping
- Dedicated lane routing controls in the UI
- Advanced lane role synthesis behavior (kit articulation, choke groups, etc.)
