# MIDI input foundation (USB / external keyboard)

## Implemented in this phase

GRIDI now supports direct browser Web MIDI note input for synth modules:

- Requests MIDI input access via `navigator.requestMIDIAccess({ sysex: false })`.
- Auto-selects a preferred MIDI input device using lightweight hardware-first heuristics.
- Reacts to device hot-plug changes (`MIDIAccess.onstatechange`).
- Parses Note On / Note Off messages (including Note On with velocity 0 as Note Off).
- Routes incoming note messages into the synth engine path with velocity.

Scope is intentionally compact and instrument-oriented; this is not a full MIDI routing matrix.

## MIDI input selection model

### Automatic preference

GRIDI no longer blindly binds the first enumerated input.

- Inputs are scored with conservative heuristics.
- Likely virtual/thru/loopback ports are deprioritized (for example names containing `MIDI Through`, `Through`, `Loopback`, or `Virtual`).
- Connected/non-virtual ports are preferred when present.

If a user has not manually selected a device, the auto-preferred input is used.

### User input selector (minimal UI)

The header MIDI chip now acts as a compact input selector:

- click/tap the MIDI chip to open a small device list popover
- choose:
  - **Auto (prefer hardware)**, or
  - a specific input device
- active input is shown as selected in the popover

No large settings page is introduced.

### Hot-plug behavior

- Device list updates when MIDI ports appear/disappear.
- If a manually selected device disappears, GRIDI falls back to the current best available input and marks fallback state in status text.
- Manual selection remains sticky when that device exists; GRIDI does not silently override it just because another port appears.

## MIDI target model

This phase uses **single-target live MIDI**:

- The current MIDI target is the last **inspected/focused synth module** (`tonal` type).
- Inspecting/focusing another synth retargets live MIDI to that synth.
- If target synth disappears, GRIDI falls back to the first available enabled synth.

This keeps direct playability without adding a large settings surface.

## MIDI event path into synth reception

Incoming Web MIDI note messages are transformed into GRIDI note events and passed through engine triggering.

- Note number -> frequency -> semitone offset relative to target synth base tuning.
- Event payload includes `source: "midi"`, `gate: "on" | "off"`, velocity, and note metadata.
- The synth runtime applies reception mode policy (`mono`/`poly`) for note selection behavior.

## Mono/poly behavior for live MIDI

- **Mono synth reception**: new note-on steals previous sounding MIDI notes for the target synth.
- **Poly synth reception**: simultaneous MIDI notes can ring at once and are released individually on note-off.
- Note-off events release the matching sounding MIDI note voice.

This gives first playable live keyboard semantics while preserving the existing scheduler-trigger behavior.

## MIDI + GEN coexistence rule

The coexistence policy in this phase is:

- GEN/scheduler triggering remains active exactly as before.
- Live MIDI overlays on the targeted synth only.
- MIDI notes are managed as live-gated voices; GEN voices remain one-shot scheduled voices.

Result: no GEN removal, no routing redesign, and deterministic behavior boundaries remain clear.

## Minimal UI added

- Header now shows a compact MIDI status chip that can also open the input selector:
  - pending / unsupported / denied / unavailable
  - connected input label (and target synth when active)
  - fallback/virtual-device clarity states when applicable
- Target synth gets a subtle surface highlight so the performer can see where live MIDI lands.

No giant MIDI preferences panel has been added.

## Current limitations (intentional)

Deferred for later phases:

- MIDI output
- Ardour integration / DAW sync / transport sync
- Full multi-target MIDI routing matrix
- CC mapping / aftertouch / MPE
- Advanced device routing / filtering UI beyond the compact selector
