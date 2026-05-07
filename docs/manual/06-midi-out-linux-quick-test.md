# MIDI Out Linux Quick Test

GRIDI MIDI Out uses Web MIDI, so start with Chrome or Chromium. Other browsers may hide Web MIDI completely or require extra flags.

## What the first test should prove

The first MIDI Out test is only meant to prove that GRIDI emits note-on and note-off messages and that your Linux MIDI graph forwards them to a synth. It is not a MIDI clock, CC, MPE, drum-map, or DAW-sync test.

Good first destinations are melodic or modular hosts that make MIDI input easy to see and arm:

- AMSynth
- Cardinal
- Ardour with a MIDI/instrument track armed and monitoring enabled

Hydrogen is useful later, but it is not the best first generic melodic MIDI test. It usually expects GM drum notes such as 36 for kick, 38 for snare, 42 for closed hat, and 46 for open hat, so a normal melodic note stream around middle C may appear to do nothing unless a future drum map matches the kit.

## Quick header setup

Use the compact header **MIDI I/O** pill for Phase 1.x MIDI Out setup:

1. Choose the **Output** destination. If you use ALSA/JACK/PipeWire routing, this is often the browser/Chromium MIDI output port that will be connected to the external synth in your patchbay.
2. Choose the **Source GEN** module. Only this generator is mirrored to MIDI Out.
3. Set the compact mapping controls:
   - **Ch**: MIDI channel 1–16. The default is channel 1.
   - **Base**: base note 0–127. The default is 60 (middle C). Tonal GEN note offsets are added to this base note.
   - **Gate ms**: note length in milliseconds. The default is 120 ms.
   - **Vel**: velocity scale from 0–1. The default is 1.0.
4. Press **Test note**. This sends a short note-on/note-off using the selected channel, base note, gate, and velocity scale. It works while transport is stopped and updates the last-sent diagnostics in the MIDI Output status line.
5. Press Play only after the Test note reaches your synth.

If no usable MIDI output is selected, **Test note** fails gracefully: GRIDI does not crash, and the MIDI status line/output list remains the place to confirm whether Web MIDI can see a destination.

## First external synth test: AMSynth or Cardinal

A simple AMSynth/Cardinal smoke test is:

1. Open GRIDI in Chrome/Chromium.
2. Open AMSynth or Cardinal and enable/monitor its MIDI input.
3. In GRIDI, open **MIDI I/O**, select a MIDI Output, select a **Source GEN**, leave **Ch 1**, **Base 60**, **Gate 120**, and **Vel 1.0**.
4. Use `aconnect -l`, QMidiRoute, or your JACK/PipeWire patchbay to connect Chromium/GRIDI's MIDI source to AMSynth/Cardinal's MIDI input.
5. Click **Test note**. You should hear or see one short note.
6. Start GRIDI transport. The selected GEN should now play the external synth while GRIDI's normal WebAudio behavior remains unchanged.

## Verify messages before blaming the synth

Tools such as QMidiRoute and `aseqdump` are best used first as diagnostics: they can confirm that GRIDI/Chromium is sending note events even when a synth does not yet respond.

Useful commands:

```bash
aconnect -l
aseqdump -p "Midi Through Port-0"
aconnect <source> <destination>
```

Typical workflow:

1. Open GRIDI in Chrome/Chromium and use the compact header **MIDI I/O** pill for quick setup: choose the MIDI Output destination, choose the GEN source module, set channel/base/gate/velocity, and click **Test note**.
2. Open the **Routing** panel when you need the global inspector: it still shows routing health, event diagnostics, and the full MIDI input/output route rows.
3. Run `aconnect -l` to list ALSA MIDI clients and ports.
4. Use `aseqdump` or QMidiRoute to confirm incoming note-on/note-off messages from Chromium/GRIDI.
5. Connect the Chromium/GRIDI source to a destination synth with `aconnect <source> <destination>` or your JACK/PipeWire patchbay.
6. In the synth, explicitly enable/arm/monitor its MIDI input if the app requires it.

## QMidiRoute gotcha

QMidiRoute can prove that GRIDI is sending events, but it can also swallow them. If **Discard unmatched events** is enabled, QMidiRoute will not forward any event that does not match a configured rule. Either disable that option while testing or add rules that forward the channel and notes you see in its log.

Observed GRIDI Phase 1.2 MIDI Out messages are usually channel 1 note-on/note-off events around base note 60 unless you change the **Ch** or **Base** mapping controls. If those appear in QMidiRoute or `aseqdump`, GRIDI has emitted MIDI and the remaining issue is likely ALSA/JACK/PipeWire bridge routing, QMidiRoute forwarding rules, destination app input configuration, or channel/note mapping.

## Stuck-note safety

GRIDI sends a compact panic cleanup when MIDI Out is stopped, disabled, rerouted, or the selected output disappears: a note-off sweep for the selected channel plus all-notes-off. If an external synth still hangs, use the synth's own panic/all-notes-off command and then re-check the MIDI route.
