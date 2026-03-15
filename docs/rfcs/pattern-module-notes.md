# Pattern module implementation notes

The scheduler now consumes a **PatternModule** abstraction (`src/engine/pattern/module.ts`) instead of importing step-specific rendering helpers.

## Current architecture

- Transport owns beat window timing (`startBeat`, `endBeat`) and look-ahead polling.
- Pattern modules own deterministic event rendering for that beat window.
- Scheduler performs event dedupe at the transport boundary using `lastScheduledBeat`.

This keeps event generation pure and deterministic, while preserving overlap-safe scheduling.

## How to add a new pattern engine

1. Add a new `PatternModule` implementation with:
   - a stable `id`
   - a `kind` label
   - a `renderWindow(request)` function that returns beat-offset events in `[startBeat, endBeat)`.
2. Keep `renderWindow` deterministic for identical input parameters.
3. Register routing in `createPatternModuleForVoice(...)`.
4. If the module can consume external data later, use `request.source`:
   - `{ type: "self" }` for voice-local params (current default)
   - `{ type: "module", moduleId }` for future upstream pattern providers.
5. Add tests for:
   - deterministic output
   - overlap+dedupe behavior with `lastScheduledBeat`
   - scheduler parity expectations.

## Why dedupe stays in scheduler

`lastScheduledBeat` remains scheduler-owned so every module follows one overlap policy and transport can safely re-render look-ahead windows without per-module mutable cursor state.
