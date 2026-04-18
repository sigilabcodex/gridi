# Architecture Overview

GRIDI is organized as a client-only instrument runtime.

## Layers

1. **Patch data model** (`src/patch.ts`)
   - typed source of truth for modules, buses, connections.
2. **Engine** (`src/engine/*`)
   - WebAudio graph lifecycle, synthesis triggering, routing.
3. **Scheduler + pattern rendering** (`src/engine/scheduler.ts`, `src/engine/pattern/*`)
   - look-ahead event scheduling with deterministic generation.
4. **UI** (`src/ui/*`)
   - controls, state persistence, module rendering, modals.

## Session and Stage model

- **Session** = one full patch loaded in one browser tab.
- **Stage** (also called Scene or Worktable) = one workspace view inside that same session.
- A session can contain multiple stages for layout segmentation (for example drums/synth/bass/leads or song-part zones).

Stages are a workspace organization primitive, not a runtime boundary:

- Routing remains global across the full session.
- Engine state remains global across the full session.
- Transport remains global across the full session.
- Signal flow semantics do not change when switching stages.

This means stage switching only changes what workspace layout the performer is currently viewing/editing, while the patch remains one connected instrument.

## Runtime flow

- `src/main.ts` creates engine and scheduler.
- App mounts UI and loads persisted state.
- UI mutates patch; scheduler and engine are synced from patch updates.
- Scheduler renders upcoming event windows and triggers voices at exact audio times.
