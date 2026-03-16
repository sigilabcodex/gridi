# Trigger Modes Architecture

This document defines the intended behavior of Trigger sequencing modes and their parameter semantics.

## Design goals

- Modes must be musically distinct when all other controls are equal.
- Rendering must be deterministic for a given parameter set and seed.
- Event windows must be stable under scheduler look-ahead overlap.
- Parameters should have explicit, truthful meaning by mode.

## Shared scheduling model

All mode engines produce a binary step pattern of `length` steps, then scheduler rendering maps active steps into beat time.

- `subdiv` controls temporal resolution (`stepsPerBeat = 2 * subdiv`).
- `drop` is a deterministic post-pattern gate applied at scheduling time.
- Rendering is pure from `(trigger params, voiceId, stepIndex)` and does not use mutable state.

This keeps overlapping look-ahead windows merge-safe and free from duplicate timing bursts.

## Mode identities

### step

**Identity:** explicit grid motif with repeat structure.

Behavior:
- Builds a short deterministic motif then repeats it across `length`.
- Strongly grid-oriented and anchor-biased (downbeats favored).
- Low `determinism` + higher `weird` introduces controlled motif mutation.

### euclid

**Identity:** balanced pulse distribution.

Behavior:
- Uses Bjorklund distribution for `round(density * length)` pulses.
- `euclidRot` rotates phase.
- `determinism` + `weird` can warp placements by local deterministic shifts.
- `gravity` gently attracts pulses toward grid anchors.

### ca

**Identity:** evolving local-rule structure.

Behavior:
- Builds a 1D elementary CA field from `caRule` and seeded `caInit` occupancy.
- Samples diagonally through generations to produce rhythmic lanes.
- `gravity` increases sampled generation depth; `weird` skews sampling diagonal.
- `density` gates the sampled field deterministically.

### hybrid

**Identity:** meaningful blend of explicit and emergent structures.

Behavior:
- Combines step scaffold + euclid scaffold + CA texture.
- `determinism` moves blend between strict structural intersection and permissive union.
- `weird` introduces deterministic bit flips (not non-deterministic randomness).

### fractal

**Identity:** recursive / scale-related logic.

Behavior:
- Computes per-step activity score from several recursive block scales.
- Larger and smaller scales both contribute; thresholding yields self-similar clusters.
- `determinism` stabilizes level gates; `weird` adds odd/even asymmetry at scales.

## Parameter semantics by mode

Legend: **Primary** = strong direct effect, **Secondary** = moderate effect, **N/A** = ignored by design.

| Parameter | step | euclid | ca | hybrid | fractal |
|---|---|---|---|---|---|
| `seed` | Primary | Primary | Primary | Primary | Primary |
| `length` | Primary | Primary | Primary | Primary | Primary |
| `subdiv` | Scheduler timing | Scheduler timing | Scheduler timing | Scheduler timing | Scheduler timing |
| `drop` | Scheduler post-gate | Scheduler post-gate | Scheduler post-gate | Scheduler post-gate | Scheduler post-gate |
| `density` | Primary threshold | Pulse count | Deterministic gate | Blend occupancy | Threshold |
| `determinism` | Motif stability | Warp resistance | Secondary sampling stability | Blend strictness | Scale gate stability |
| `gravity` | Downbeat pull | Anchor attraction | Generation depth | Scaffold emphasis | Threshold bias |
| `weird` | Syncopation/mutation | Warp amount | Diagonal skew | Mutation amount | Scale asymmetry |
| `euclidRot` | N/A | Primary phase rotate | N/A | Secondary via euclid contribution | Secondary phase offset |
| `caRule` | N/A | N/A | Primary | Secondary via CA contribution | N/A |
| `caInit` | N/A | N/A | Primary seed occupancy | Secondary via CA contribution | N/A |

## Determinism guarantees

- Pseudorandom decisions are hash/xorshift based and seeded.
- No mode keeps mutable generation cursor across renders.
- Re-rendering same window with same inputs yields identical events.

## Current limitations

- Fractal engine is binary-threshold based (not yet polyrhythmic multi-lane fractal voiceing).
- Hybrid can still collapse toward source modes under extreme parameter corners.
- CA remains elementary (radius-1, 8-bit rule), no higher-order neighborhoods yet.
