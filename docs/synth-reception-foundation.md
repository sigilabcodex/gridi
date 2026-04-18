# Synth reception foundation (mono/poly)

## What changed in this pass

- Synth modules now carry an explicit normalized reception policy in patch state:
  - `type SynthReceptionMode = "mono" | "poly"`
  - `normalizeSynthReceptionMode(value)` guards invalid persisted values.
- Tonal normalization defaults to `mono` and runtime consumes the normalized mode.
- A minimal **Reception** selector is exposed in Synth **Advanced** settings (`Mono` / `Poly`).
- Synth faceplate upper pills now prioritize routing context:
  - **Trg** (incoming trigger/source)
  - **Artic** (articulation profile)

## Why synth behavior felt effectively mono before

Even with note-array event semantics in place, real-world behavior was perceived as monophonic because:

1. **Default policy was mono** and there was no direct synth UI control for switching reception mode.
2. In mono mode, note arrays are intentionally collapsed to one semantic primary note.
3. Runtime voice lifecycle is still one-shot per trigger event, with no persistent poly voice manager (`maxVoices`, steal policy, chord memory, per-note gate lifecycle).

## Current event/runtime path audit

- Scheduler creates tonal events as `kind: "note"` with `notes: number[]` derived from trigger pattern/lane semantics.
- Runtime receives `event.notes` and applies reception policy:
  - `mono` -> first valid note
  - `poly` -> up to 4 valid notes (current safety cap)
- Synth render path now structurally instantiates oscillator pairs per selected note, so multi-note payloads are no longer architecturally discarded.

## What is fully functional now

- Explicit synth reception mode in module state, migration-safe normalization, and runtime access.
- Minimal UI control for mono/poly mode.
- Poly mode can accept multi-note arrays without crashing and render simultaneous note stacks within current voice envelope model.

## What remains deferred (intentional)

This pass does **not** implement:

- full keyboard/MIDI note input,
- advanced poly voice allocation (`maxVoices`, steal modes, per-note retrigger policy),
- richer harmonic/chord generation UX,
- manual drum lane assignment (future routing refinement).

Manual drum lane/channel assignment remains a planned follow-up and is deliberately out of scope for this pass.
