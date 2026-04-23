# MIDI routing UI (Routing-domain integration)

## What changed in this phase

MIDI is now represented and surfaced as a first-class route domain in GRIDI's routing model and routing UI.

- Typed routing overview now includes `midi` routes alongside `event`, `modulation`, and `audio`.
- The global **Routing overview** panel now includes a compact **MIDI input routing** editor:
  - `Input: Auto (prefer hardware)` or a specific MIDI input device
  - `Target: <Synth module>`
- MIDI route visibility is now present in the overview route list as lines such as:
  - `MIDI IN <device> -> Synth 1`

This keeps MIDI patchable in the same conceptual space as other routes, without introducing a giant DAW matrix.

## Editing model

Primary editing now lives in the Routing overview (header **Routing** panel):

1. Open **Routing** from the header utility area.
2. In **MIDI input routing**:
   - choose input device (`Auto` or explicit device),
   - choose synth target (`Target: <Synth>`).
3. The patch stores this as a typed `midi` route with source `external:midi` and target synth module.

When `Target: None` is selected, the MIDI IN route is removed.

## Runtime target semantics (clarified)

Live MIDI target resolution now prefers explicit typed MIDI route target first.

- If a MIDI IN route exists, incoming MIDI is routed to that explicit synth target.
- If no MIDI IN route exists, previous fallback behavior remains: focused/inspected synth target, then first enabled synth.

This preserves playability while reducing target ambiguity.

## Top-bar MIDI indicator relationship

The top-bar MIDI chip remains a compact status/quick selector surface.

- It still reports MIDI availability and current selected device.
- It is no longer the sole place where MIDI routing is edited.
- Routing ownership now lives in the Routing domain and appears in the Routing overview.

## MIDI out preparation (deferred but scaffolded)

Typed routes already support `domain: "midi"` and external endpoints, so this phase keeps a clean extension path for future:

- module -> MIDI OUT routes,
- channelized output policies,
- advanced popup/lightbox editing.

Not implemented in this phase:

- full MIDI output execution,
- CC mapping,
- aftertouch/MPE,
- DAW-style matrix editing.
