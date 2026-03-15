# Pattern engines behavior (dev notes)

This document describes the sequencing behavior behind `PatternModule` mode engines.

## Shared rendering model

All engines render a deterministic binary pattern cycle (`0` = no event, `1` = event) with cycle length derived from `voice.length` (clamped to `[1, 128]`).

Window rendering then maps cycle steps into beat positions using:

- `stepsPerBeat = 2 * subdiv`
- event beat = `step / stepsPerBeat`
- repeating cycle indexing via modulo
- deterministic per-step drop masking via `seed`, `voiceId`, and `drop`

This model is compatible with look-ahead scheduling and overlapping windows because event positions are purely step-index based.

## Step mode

- Core behavior: seeded Bernoulli gate per cycle step.
- Primary controls: `seed`, `density`, `length`.
- Timing controls: `subdiv`, `drop`.

Notes:

- `determinism`, `gravity`, `weird`, `euclidRot`, `caRule`, `caInit` are currently ignored by step generation.
- This preserves existing step behavior.

## Euclid mode

- Core behavior: Bjorklund pulse distribution (`k` pulses in `n` steps).
- Primary controls:
  - `length` -> `n`
  - `density` -> pulse count `k`
  - `euclidRot` -> explicit phase rotation
- Character controls:
  - `gravity` and `weird` add small deterministic phase bias
  - `determinism` and `weird` shape deterministic mutation intensity (bit flips)
- Timing controls: `subdiv`, `drop`.

Notes:

- `caRule` and `caInit` are ignored in Euclid mode.

## CA mode

- Core behavior: 1D elementary cellular automata on a circular row.
- Primary controls:
  - `caRule` -> rule number `[0..255]`
  - `caInit` + `seed` -> deterministic initial row occupancy
  - `gravity` + `weird` -> iteration count / evolution depth
- Density response:
  - `density` acts as deterministic post-evolution occupancy gate to keep macro control consistent.
- Timing controls: `length`, `subdiv`, `drop`.

Notes:

- `euclidRot` is ignored in CA mode.

## Hybrid mode

- Core behavior: deterministic fusion of Euclid + CA structure, with step influence.
- Primary controls:
  - `determinism` decides structural merge bias (`AND` vs `OR` tendency)
  - `weird` controls probability of borrowing from step texture
  - `gravity` applies extra gate pressure
  - `seed` controls all stochastic-looking choices deterministically
- Timing controls: `length`, `subdiv`, `drop`.

Notes:

- `caRule`, `caInit`, and `euclidRot` are indirectly meaningful because hybrid uses CA and Euclid sub-engines.

## Fractal/proto mode

- Core behavior: intentionally simple deterministic proto-fractal fold from index bits + seed mask.
- Primary controls:
  - `seed` establishes fold mask
  - `density` controls occupancy threshold
  - `weird` and `gravity` bias threshold asymmetrically
  - `caRule` and `euclidRot` influence seed mask for coarse character variation
- Timing controls: `length`, `subdiv`, `drop`.

Notes:

- `caInit` and `determinism` are currently ignored in fractal/proto mode.
- Goal is coherent repeatable motifing rather than full fractal synthesis.
