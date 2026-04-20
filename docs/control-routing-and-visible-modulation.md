# Control routing + visible modulation (phase refinement)

This phase makes CTRL routing behavior explicit and playable while keeping GRIDI's compact module surfaces.

## Rules implemented

1. **One CTRL → many parameters**
   - A control module can drive multiple modulation routes across trigger, drum, synth (and typed-route-safe control/visual targets).

2. **One parameter → one CTRL**
   - A single target parameter has a single active control owner.
   - If multiple typed modulation routes target the same `(module, parameter)`, GRIDI keeps the first route and ignores later collisions with a routing warning.
   - In local module assignment UI (legacy map-backed selectors), setting a source replaces the previous source for that parameter key.

3. **No self-modulation**
   - Typed route validation blocks `control -> same-control` modulation routes.
   - Runtime compilation also rejects self-modulation and records a warning.

## Visible modulation behavior

For currently modulatable parameters in this phase:
- Trigger `density`
- Drum `basePitch`
- Synth `cutoff`

The **real parameter control visibly moves** to the live modulated value during runtime updates.

- The primary knob/value display is moved directly (no ghost-only indicator).
- A subtle modulation highlight is applied to indicate that the control is currently being driven.
- Hover/focus reveal is provided via compact source title text (e.g. `CTRL <id>`).

## User override behavior

During active user interaction (drag/edit gesture) on a modulated control:
- direct manipulation temporarily takes priority;
- incoming modulation display updates for that parameter are suppressed.

When interaction ends:
- control immediately resumes following the connected CTRL source, if route assignment still exists.

This keeps performance edits authoritative without disconnecting routing.

## Deferred in this phase

Still intentionally deferred:
- multi-source modulation blending for one parameter,
- giant modulation matrix / patchbay redesign,
- full MIDI routing expansion,
- broad mixer-control modulation.

## Future velocity/intensity compatibility note

The modulation display/ownership pattern introduced here is compatible with later velocity/intensity-aware expansions:
- event intensity can be layered on top of stable per-parameter control ownership,
- future trigger/MIDI intensity mappings can reuse the same "single owner + temporary user override" interaction policy.
