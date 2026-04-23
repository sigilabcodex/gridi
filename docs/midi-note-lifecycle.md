# MIDI note lifecycle hardening

This document describes GRIDI's runtime handling for live Web MIDI note lifecycles.

## 1) Tracking model for live MIDI notes

Live MIDI voices are tracked by **module target + MIDI note + press order**.

- Runtime keeps per-module note queues.
- Each note-on registration gets a unique voice tracking id.
- Note-off consumes one tracked voice for that module/note pair.
- Cleanup is identity-based (tracking id), so an older voice end callback cannot accidentally delete a newer voice entry.

This fixes the prior key-collision issue where a single `Map<midiNote, voice>` could be overwritten and then removed by a stale callback.

## 2) Note-off handling

Both note-off forms are normalized in the MIDI input layer:

- explicit MIDI Note Off (`0x8n`)
- Note On with velocity 0 (`0x9n, velocity=0`)

Engine note-off handling now releases exactly one tracked matching voice for the target module/note.

## 3) Mono vs poly behavior

### Mono reception

On note-on in mono mode:

- runtime drains/release all tracked live MIDI voices for the target synth,
- then registers the new note voice.

This prevents stale held notes after mono reassignment.

### Poly reception

On note-on in poly mode:

- runtime registers a new tracked note voice without stealing other notes.

On note-off:

- only one matching voice is released for that note, preserving independent chord release behavior.

## 4) Panic / all-notes-off path

The engine exposes `stopAllMidiVoices(moduleId?)` as an internal panic path:

- with `moduleId`: drain/release all tracked voices for that synth
- without `moduleId`: global drain/release for all synths

This is used for safe runtime transitions (target swaps, teardown) and as an emergency cleanup path.

## 5) Target/mode transition safety

When MIDI target synth changes (including routing target changes), runtime now releases tracked voices for the previous target before switching.

When tonal modules are disabled/removed or their reception mode changes, runtime stops tracked voices for those modules to avoid orphaned live notes.

## 6) Deferred

Still deferred:

- explicit UI panic button
- sustain pedal / CC-based hold semantics
- per-channel voice partitioning beyond current target/module model
