# 01. Quick Start

This walkthrough is for a first session in GRIDI. The exact labels and placement of some controls may continue to evolve, but the basic patch idea is stable: create a generator, create a sound module, route the generator into the sound module, then perform.

## 1. Open GRIDI and start the audio engine

1. Open GRIDI in a browser.
2. Use the header/global area to start or enable audio if the browser asks for it.
3. If you see an output, audio, or engine status indicator, confirm that audio is running before expecting sound.

Browsers often require a click or tap before audio can start. If nothing is audible, check the audio/output state first.

## 2. Load or create a session

A session is the whole instrument state: modules, placement, routing, transport/global settings, and each module's current local state.

For a first run, use one of the current starter examples if available, or create a blank/local session. Starter sessions are intended as onboarding examples, not as a complete preset library.

## 3. Add a GEN module

1. Find an empty add slot in the workspace grid.
2. Add a **GEN** module.
3. Choose a GEN mode if the UI offers a mode selector.

GEN modules do not make sound by themselves. They generate timed events that other modules can play.

## 4. Add a Drum or Synth module

Add one sound module:

- **Drum** for percussive hits, kicks, hats, noise, and transient sounds.
- **Synth** for tonal notes, basses, leads, pads, and pitched sounds.

For the simplest first patch, use one GEN and one Drum module. Synth is also valid, especially if you want pitched sound or MIDI input.

## 5. Route GEN to the sound module

Connect the GEN module to the Drum or Synth module. Depending on the current surface, this may appear in a module Routing tab, a trigger/source selector on the sound module, or a routing overview in the header area.

At a user level, the relationship is simple:

```text
GEN -> Drum or Synth
```

If the sound module has a trigger source selector, choose your GEN module as its source. If you are using the Routing overview, look for an event route from the GEN to the sound module.

## 6. Press play

Use the transport controls in the header/global area to start playback. You should hear the sound module respond to the GEN pattern if:

- audio is running;
- transport is playing;
- the sound module is enabled and audible;
- the GEN is routed to the sound module;
- levels are not turned down.

## 7. Tweak controls while it plays

Try small changes first:

- On the GEN module, adjust density, length, subdivision, drop, determinism/weirdness, seed/reseed, or mode-specific controls.
- On the Drum module, adjust pitch/body, decay, tone/noise, level, and pan.
- On the Synth module, adjust waveform, filter, envelope, level, and pan.

The goal is to treat GRIDI like an instrument: listen, change one thing, listen again, then keep shaping the patch.

## 8. Save the session when you like it

Use the session controls when you want to keep the whole patch. Module presets and session presets are related but different: a module preset stores one module's local setup, while a session stores the whole instrument configuration.
