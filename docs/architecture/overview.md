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

## Runtime flow

- `src/main.ts` creates engine and scheduler.
- App mounts UI and loads persisted state.
- UI mutates patch; scheduler and engine are synced from patch updates.
- Scheduler renders upcoming event windows and triggers voices at exact audio times.
