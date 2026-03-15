# Routing foundations (v0.4 prep)

This document captures the minimal scaffolding added ahead of full v0.4 routing work.

## What was added

- `Patch` now includes:
  - `connections[]`: lightweight directed links from module output ports to module/bus/master targets.
  - `buses[]`: minimal bus metadata (id/name/gain/mute) for future bus routing.
- `EffectModule` now has a minimal shape (`kind`, `bypass`, `gain`) and supports a placeholder `gain` effect type.
- Engine exposes module lifecycle-oriented methods:
  - `syncRouting(patch)` to resolve/update/rewire audio-capable modules.
  - `disconnectModule(moduleId)` for teardown-safe disconnect.
  - `dispose()` for full cleanup.
- Added `AudioModuleInstance` contract to normalize connect/disconnect/update/dispose behavior for DSP modules.
- Added connection validation helper that safely drops invalid links and surfaces warnings.

## Behavioral constraints

- Existing playback remains stable when no explicit connections are present.
  - Voices still route to master by default.
- Scheduler/transport logic remains independent from routing internals.
- Placeholder DSP (`gain` effect) is bypass-safe and intentionally removable.

## Why this is intentionally minimal

- No patch-cable UI yet.
- No full graph editor or dynamic graph algorithms.
- No speculative bus DSP path yet; buses are model-first placeholders.

This keeps the current product behavior intact while unblocking the next routing/effects phase.
