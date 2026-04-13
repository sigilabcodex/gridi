# GRIDI Instrument State and Roadmap

This document is a practical backlog/vision map so recent module progress is not lost and future work stays clearly separated from implemented behavior.

## Current state (implemented)

GRIDI is now credibly evolving into a playable instrument.

- Drum is substantially refined.
- GEN is substantially refined.
- SYNTH is structurally viable and visually coherent.
- CONTROL exists and is usable, but still pending major refinement.
- VISUAL exists and is usable, but still pending major expansion.

Implemented foundation highlights:
- Fixed module shell and unified workspace grid.
- Canonical header/display/controls/tabs/status-strip module rhythm.
- Module-level preset library and session-level preset system.
- Active routing model with current voice-owned trigger source relationships.

## Near-term next steps (active backlog)

## A) Module system and semantics

- Keep module terminology explicit in docs and UI copy:
  - module kind,
  - mode/subtype,
  - module preset,
  - session (whole instrument state).
- Continue applying kind+mode+preset architecture across all module families.

## B) Preset bank curation (instrument experience)

Treat curated banks as part of the playable instrument, not just storage.

- **Drum bank direction**: kicks, hats, cymbals, rattles, percussion families.
- **Synth bank direction**: basses, leads, pads, unstable/strange textures.
- **GEN bank direction**: meaningful mode examples showing distinct generative personalities.

## C) Faceplate and UI refinement

- Keep reclaiming vertical space for behavior surfaces.
- Improve display feedback depth while preserving compact shell discipline.
- Resolve pending add-slot plus alignment refinement.
- Continue top/global header simplification and hierarchy cleanup.
- Explore custom chip-like slider language for global controls.
- Iterate routing UX affordances without forcing immediate routing-ownership migration.

## Longer-term ideas (speculative / not yet implemented)

## Generator and display evolution

- Richer GEN mode completion.
- Full graphical representation coverage for all generator modes.
- Animated/live behavior for generator displays.
- More interactive behavior/display surfaces.

## Module-family expansion

- CONTROL redesign and expansion.
- VISUAL expansion with multiple visual modes.
- Possible dedicated routing-management module.

## Performance and ecosystem features

- MIDI implementation.
- Live coding module.
- Sampling / looping / granular (grain-based) directions.
- Experimental / dangerous mode track.
- Future multichannel / installation-aware spatial ideas.

## Unresolved questions

- Whether trigger-side routing UX should eventually become canonical routing ownership or remain a bridge over voice-owned relationships.
- How far Main-face density can increase before reducing playability.
- How deeply display surfaces should become interactive versus remaining explanatory.
- How preset-bank curation should be authored/versioned/distributed over time.
