# MIDI Out Linux Quick Test

GRIDI MIDI Out uses Web MIDI, so start with Chrome or Chromium. Other browsers may hide Web MIDI completely or require extra flags.

## What the first test should prove

The first MIDI Out test is only meant to prove that GRIDI emits note-on and note-off messages and that your Linux MIDI graph forwards them to a synth. It is not a MIDI clock, CC, MPE, custom drum-map editor, or DAW-sync test.

Good first destinations are melodic or modular hosts that make MIDI input easy to see and arm:

- AMSynth
- Cardinal
- Ardour with a MIDI/instrument track armed and monitoring enabled

Hydrogen is useful for the drum-map test below. It often works with GM drum notes such as 36 for kick, 38 for snare, 42 for closed hat, and 46 for open hat, but Hydrogen kits, Ardour drum plugins, Cardinal patches, and hardware drum machines may not use identical note maps. Use **Mode: Drum map** and the compact **Map** selector instead of assuming a normal melodic note stream around middle C will hit useful drum voices.

## Quick header setup

Use the compact header **MIDI I/O** pill for Phase 1.x MIDI Out setup:

1. Choose the **Output** destination. If you use ALSA/JACK/PipeWire routing, this is often the browser/Chromium MIDI output port that will be connected to the external synth in your patchbay.
2. Choose the **Source GEN** module. MIDI Out follows this generator's **GEN stream** directly; local GRIDI DRUM/SYNTH voice mute/off state does not silence the external MIDI output.
3. Set the compact mapping controls:
   - **Mode: Melodic**: current/base-note behavior. Tonal GEN note offsets are added to **Base**. Drum events without melodic note data fall back to **Base**.
   - **Mode: Drum map**: maps available drum lane/index data through the selected **Map** preset. If no lane/index is available, GRIDI falls back to **Base** and reports that fallback in the last-sent diagnostics.
   - **Map** (shown only in Drum map mode):
     - **GM Basic**: lane 0 → 36 kick, lane 1 → 38 snare, lane 2 → 42 closed hat, lane 3 → 46 open hat, then 49 crash, 45 low tom, 47 mid tom, and 50 high tom.
     - **Chromatic from Base**: lane/index becomes **Base + lane**. This is the best discovery mode when a plugin only responds to an unknown note range.
     - **Low drum kit**: tries lower drum notes around 35–43.
     - **Cymbal/hat test**: tries hat/cymbal notes around 42, 44, 46, 49, and 51.
     - **Single base note**: every lane sends **Base**, useful for proving the external route/channel is correct before debugging per-lane drum maps.
   - **Ch**: MIDI channel 1–16. The default is channel 1. Channel 10 is common for drum instruments, but some hosts/plugins use any armed/selected channel.
   - **Base**: base note 0–127. The default is 60 (middle C). In Drum map mode it is the fallback when no lane/index is available, the fixed note for **Single base note**, and the starting note for **Chromatic from Base**.
   - **Gate ms**: note length in milliseconds. The default is 120 ms.
   - **Vel**: velocity scale from 0–1. The default is 1.0.
4. Press **Test note**. This sends a short note-on/note-off using the selected channel, base note, gate, and velocity scale. It works while transport is stopped and updates the last-sent diagnostics in the MIDI Output status line.
5. Press Play only after the Test note reaches your synth.

If no usable MIDI output is selected, **Test note** fails gracefully: GRIDI does not crash, and the MIDI status line/output list remains the place to confirm whether Web MIDI can see a destination.

## First external synth test: AMSynth or Cardinal

A simple AMSynth/Cardinal smoke test is:

1. Open GRIDI in Chrome/Chromium.
2. Open AMSynth or Cardinal and enable/monitor its MIDI input.
3. In GRIDI, open **MIDI I/O**, select a MIDI Output, select a **Source GEN**, confirm **Mode: GEN stream**, use **Map mode: Melodic**, leave **Ch 1**, **Base 60**, **Gate 120**, and **Vel 1.0**.
4. Use `aconnect -l`, QMidiRoute, or your JACK/PipeWire patchbay to connect Chromium/GRIDI's MIDI source to AMSynth/Cardinal's MIDI input.
5. Click **Test note**. You should hear or see one short note.
6. Start GRIDI transport. The selected GEN should now play the external synth while GRIDI's normal WebAudio behavior remains unchanged.


## Hydrogen drum-map quick test

Use this test when you want GRIDI to drive a drum instrument instead of a melodic synth:

1. Open Hydrogen and load a kit. Confirm the kit/instrument list responds to GM-style notes such as 36 (kick), 38 (snare), 42 (closed hat), and 46 (open hat), or adjust Hydrogen's instrument MIDI note assignments to match.
2. Open GRIDI in Chrome/Chromium and open the **MIDI I/O** pill.
3. Select a MIDI **Output** and a **Source GEN**.
4. Set **Mode: Drum map** and start with **Map: GM Basic** if the target claims GM compatibility.
5. If you only hear one cymbal, one hat, or a limited subset of sounds, switch **Map** to **Chromatic from Base**. Start with **Base 35** or **Base 36**, run transport, then move **Base** upward in small steps until useful hits appear. The last-sent diagnostics should show text like `Last: Ch 10 Note 42 · lane 2 · Vel 100`, which confirms both the mapped note and the source lane.
6. Set **Ch** to the channel your target listens to. Channel 10 is common for drum workflows, but Hydrogen/hosts may also respond to the selected/omni input depending on configuration.
7. Use `aconnect -l` or your patchbay to connect the Chromium/GRIDI MIDI source (often visible through **MIDI Through**) to Hydrogen's MIDI input. For example, connect MIDI Through/Chromium's output to Hydrogen's input in ALSA, JACK, or PipeWire.
8. Start GRIDI transport. With **GM Basic**, drum lanes should trigger 36 kick, 38 snare, 42 closed hat, and 46 open hat for the first four lanes. With **Chromatic from Base**, the same lanes send Base, Base+1, Base+2, and Base+3.
9. If Hydrogen stays silent, verify both sides: use `aseqdump` to confirm GRIDI emits the expected note numbers, and verify Hydrogen's instrument mapping/input channel/monitor settings. Try **Single base note** to prove one known Hydrogen instrument note before returning to a multi-note map.

The same **Mode: Drum map** setup is the practical starting point for Ardour drum tracks, Cardinal drum patches, and hardware drum machines. Do not assume these targets share the exact same drum layout: Ardour instrument plugins, Hydrogen kits, and Cardinal drum patches can all use different note numbers. In Ardour, arm and monitor the MIDI/instrument track; in Cardinal, patch the host MIDI input into the drum voices/modules; on hardware, match the channel and note map expected by the device. When in doubt, use **Chromatic from Base** to discover which note range produces useful hits, then return to **GM Basic**, **Low drum kit**, or **Cymbal/hat test** if one of those presets fits the target better.


## GEN stream vs. local voices

MIDI Out source selection is GEN-stream based. When **Source GEN** is set to `Generator 1`, external MIDI follows `Generator 1` even if local GRIDI DRUM/SYNTH modules routed from that generator are muted, disabled, or deleted. Connecting the same GEN to multiple local voices should not duplicate external MIDI notes.

GRIDI may add an explicit voice-mirror/post-voice MIDI mode later, but that is not the current MIDI Out source behavior. If a future mode mirrors local voices, it should be labeled separately because it would intentionally follow local voice routing and mute/off state.

## Verify messages before blaming the synth

Tools such as QMidiRoute and `aseqdump` are best used first as diagnostics: they can confirm that GRIDI/Chromium is sending note events even when a synth does not yet respond.

Useful commands:

```bash
aconnect -l
aseqdump -p "Midi Through Port-0"
aconnect <source> <destination>
```

Typical workflow:

1. Open GRIDI in Chrome/Chromium and use the compact header **MIDI I/O** pill for quick setup: choose the MIDI Output destination, choose the GEN source module, set mode/channel/base/gate/velocity, and click **Test note**.
2. Open the **Routing** panel when you need the global inspector: it still shows routing health, event diagnostics, and the full MIDI input/output route rows.
3. Run `aconnect -l` to list ALSA MIDI clients and ports.
4. Use `aseqdump` or QMidiRoute to confirm incoming note-on/note-off messages from Chromium/GRIDI.
5. Connect the Chromium/GRIDI source to a destination synth with `aconnect <source> <destination>` or your JACK/PipeWire patchbay.
6. In the synth, explicitly enable/arm/monitor its MIDI input if the app requires it.

## QMidiRoute gotcha

QMidiRoute can prove that GRIDI is sending events, but it can also swallow them. If **Discard unmatched events** is enabled, QMidiRoute will not forward any event that does not match a configured rule. Either disable that option while testing or add rules that forward the channel and notes you see in its log.

Observed GRIDI MIDI Out messages in GEN-stream Melodic map mode are usually channel 1 note-on/note-off events around base note 60 unless you change the **Ch** or **Base** mapping controls. In Drum map mode, expect note numbers from the selected **Map** preset when lane/index data is present: **GM Basic** starts 36/38/42/46…, while **Chromatic from Base** sends Base/Base+1/Base+2/Base+3…. If no lane/index is available, the MIDI Output status line says `fallback base`. If the expected notes appear in QMidiRoute or `aseqdump`, GRIDI has emitted MIDI and the remaining issue is likely ALSA/JACK/PipeWire bridge routing, QMidiRoute forwarding rules, destination app input configuration, or channel/note mapping.

## Stuck-note safety

GRIDI sends a compact panic cleanup when MIDI Out is stopped, disabled, rerouted, or the selected output disappears: a note-off sweep for the selected channel plus all-notes-off. If an external synth still hangs, use the synth's own panic/all-notes-off command and then re-check the MIDI route.
