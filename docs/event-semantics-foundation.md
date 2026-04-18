# Event semantics foundation (Phase: drummer/conductor scaffold)

This phase introduces the first typed musical event layer for GRIDI runtime scheduling and voice triggering.

## 1) Event model introduced

A new runtime event union now carries semantic intent from scheduler to sound runtime:

- `drum` events
  - `timeSec`
  - `velocity`
  - optional lane role (`low | mid | high | accent`)
- `note` events
  - `timeSec`
  - `velocity`
  - `notes: number[]`
  - optional duration/register hints (reserved)

Important in this phase:

- `notes` are **semitone offsets** relative to each tonal module's internal base frequency.
- This keeps previous scalar tonal behavior compatible while introducing multi-note structure.

## 2) Drum lane-role scaffolding

Pattern events already carried lane-like information (`targetLane`).

This phase formalizes that by mapping scheduler pattern lanes to explicit drum roles:

- lane `0` → `low`
- lane `1` → `mid`
- lane `2` → `high`
- lane `3` → `accent`

Current drum runtime remains intentionally simple. It receives structured lane-tagged events but does not yet implement advanced lane-targeted behavior policies.

## 3) Synth reception policy

Tonal modules now include explicit reception policy state:

- `reception: "mono" | "poly"`

Current defaults and migration behavior:

- old patches without this field normalize to `mono`
- new tonal modules default to `mono`

Runtime reads this policy directly when interpreting note events.

## 4) Mono/poly behavior in this phase

This phase does **not** implement full synth voice allocation.

What it does implement:

- `mono`: uses first incoming note offset.
- `poly`: accepts note arrays (up to 4 notes per event) and renders stacked tonal oscillators.
- fallback safety: empty/invalid note arrays resolve to `[0]`.

This provides structural note-stream support now, with room for future advanced policies.

## 5) Deferred intentionally

Still deferred to later phases:

- no MIDI/event IO
- no free-form lane editing UI
- no full drum role assignment UI
- no advanced synth voice-stealing/allocator policies
- no DAW-style piano-roll system

This phase is foundation only: typed semantic events + policy scaffolding while preserving existing instrument behavior.
