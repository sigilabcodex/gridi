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

## Bidirectional assignment model

Routing is now intentionally editable from both directions:

1. **Source-side (CTRL module Routing tab)**
   - Pick target module → group → parameter checklist.
   - A single CTRL can claim many parameters across modules.

2. **Target-side (GEN / DRUM / SYNTH Routing tabs)**
   - Use grouped **Mod in** rows per parameter (`None` / `CTRL n`).
   - Assignment writes into the same per-module `modulations` ownership map used by source-side editing.
   - Re-selecting a source on a parameter replaces the prior owner for that parameter key.

Because both UIs write to the same ownership map, source-side and target-side edits stay consistent with each other.

## Routing-context preservation

Routing edits now preserve the current editing context:

- routing updates use stable rerender behavior (scroll snapshot/restore),
- module tab state for **CTRL** and **GEN** modules is preserved across routing mutations,
- existing DRUM/SYNTH tab persistence remains intact.

This prevents accidental jumps back to Main while patching in Routing tabs.

## Visible modulation behavior

For currently visibly-modulated controls in this phase:
- Trigger `density`
- Drum `basePitch`
- Synth `cutoff`

Target-side assignment supports the broader grouped parameter catalog, while visible animated control motion remains scoped to the parameters listed above.

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
