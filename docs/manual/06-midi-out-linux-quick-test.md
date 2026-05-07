# MIDI Out Linux Quick Test

GRIDI MIDI Out uses Web MIDI, so start with Chrome or Chromium. Other browsers may hide Web MIDI completely or require extra flags.

## What the first test should prove

The first MIDI Out test is only meant to prove that GRIDI emits note-on and note-off messages and that your Linux MIDI graph forwards them to a synth. It is not a MIDI clock, CC, MPE, drum-map, or DAW-sync test.

Good first destinations are melodic or modular hosts that make MIDI input easy to see and arm:

- AMSynth
- Cardinal
- Ardour with a MIDI/instrument track armed and monitoring enabled

Hydrogen is useful later, but it is not the best first generic melodic MIDI test. It usually expects GM drum notes such as 36 for kick, 38 for snare, 42 for closed hat, and 46 for open hat, so a normal melodic note stream around middle C may appear to do nothing unless the mapping matches the kit.

## Verify messages before blaming the synth

Tools such as QMidiRoute and `aseqdump` are best used first as diagnostics: they can confirm that GRIDI/Chromium is sending note events even when a synth does not yet respond.

Useful commands:

```bash
aconnect -l
aseqdump -p "Midi Through Port-0"
aconnect <source> <destination>
```

Typical workflow:

1. Open GRIDI in Chrome/Chromium and enable/select MIDI Out from the routing overview.
2. Run `aconnect -l` to list ALSA MIDI clients and ports.
3. Use `aseqdump` or QMidiRoute to confirm incoming note-on/note-off messages from Chromium/GRIDI.
4. Connect the Chromium/GRIDI source to a destination synth with `aconnect <source> <destination>` or your JACK/PipeWire patchbay.
5. In the synth, explicitly enable/arm/monitor its MIDI input if the app requires it.

## QMidiRoute gotcha

QMidiRoute can prove that GRIDI is sending events, but it can also swallow them. If **Discard unmatched events** is enabled, QMidiRoute will not forward any event that does not match a configured rule. Either disable that option while testing or add rules that forward the channel and notes you see in its log.

Observed GRIDI Phase 1 MIDI Out messages are usually channel 1 note-on/note-off events near notes 57–62 when using melodic GEN output and the default base-note mapping. If those appear in QMidiRoute or `aseqdump`, GRIDI has emitted MIDI and the remaining issue is likely ALSA/JACK/PipeWire bridge routing, QMidiRoute forwarding rules, destination app input configuration, or channel/note mapping.

## Stuck-note safety

GRIDI sends a compact panic cleanup when MIDI Out is stopped, disabled, rerouted, or the selected output disappears: a note-off sweep for the selected channel plus all-notes-off. If an external synth still hangs, use the synth's own panic/all-notes-off command and then re-check the MIDI route.
