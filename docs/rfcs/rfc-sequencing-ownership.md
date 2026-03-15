# RFC: Sequencing Ownership Boundary for v0.32

- **Status**: Proposed
- **Authors**: GRIDI Architecture
- **Last Updated**: 2026-03-15
- **Roadmap Alignment**: v0.32 “Structural Evolution”

## 1) Current Architecture Summary (Audit)

This section documents the current sequencing flow as implemented.

### 1.1 Patch model and sequencing parameters

`VoiceModule` currently mixes three concerns in one object:
- sequence generation controls (`mode`, `seed`, `density`, `length`, `subdiv`, `drop`, `determinism`, `gravity`, `weird`, `euclidRot`, `caRule`, `caInit`),
- timbre/output controls (`amp`, `timbre`, `pan`),
- transport eligibility (`enabled`).

Source: `src/patch.ts`.

### 1.2 Scheduler flow (today)

The scheduler currently does both transport and sequencing ownership:
- owns mutable per-voice sequencing cursors (`step`, `nextTime`, `pattern`, `lastScheduledBeat`),
- regenerates legacy patterns via `regenAll()/regenVoicePattern()` for non-step modes,
- handles lookahead loop and beat/sec conversion,
- dispatches `engine.triggerVoice(...)` with exact `AudioContext` timestamps.

Source: `src/engine/scheduler.ts`.

### 1.3 Step pattern and event-window rendering

Step-mode uses immutable-window rendering now:
- `genStepPattern(...)` is deterministic from `(length, seed, density)`,
- `renderStepWindow(...)` materializes events in `[startBeat, endBeat)`,
- scheduler deduplicates overlap with `lastScheduledBeat`.

Sources: `src/engine/pattern/stepPatternModule.ts`, `src/engine/pattern/stepEventWindow.ts`, `src/engine/scheduler.ts`.

### 1.4 Legacy mode generation path

Euclid/CA/hybrid/fractal generation remains stateful legacy sequencing data consumed by scheduler step cursors. It is now centralized in `renderLegacyVoicePattern(...)` as a transitional adapter.

Source: `src/engine/pattern/legacyPatternRenderer.ts`.

### 1.5 UI assumptions

UI currently assumes sequencing edits are immediate patch edits and controls when regeneration happens:
- many sequencing controls call `onPatchChange(..., { regen: true/false })`,
- mode/seed/density/length/drop changes typically force regen,
- amp/timbre/pan changes do not.

This means UI implicitly understands scheduler regeneration behavior.

Source: `src/ui/voiceModule.ts`.

## 2) Current Pain Points

1. **Mixed ownership in scheduler**
   - Scheduler is both transport and sequence domain owner.
2. **Hidden coupling between UI and scheduler internals**
   - `regen` flags in UI encode scheduling policy.
3. **Two sequencing models in one runtime path**
   - Step mode uses immutable event windows, non-step modes use mutable pattern cursor logic.
4. **Patch model conflates timbre and sequence responsibilities**
   - Harder to reason about future module boundaries.
5. **Difficult migration surface for PatternModule**
   - Without explicit phases, new sequencing features risk adding more scheduler coupling.

## 3) Target Ownership Model

### 3.1 Scheduler (target)

Scheduler should become a **transport/timing service only**:
- owns transport clock (`running`, BPM mapping, lookahead tick),
- requests events for a beat window,
- converts beat offsets → seconds,
- dispatches timestamped triggers,
- performs overlap dedupe only at boundary integration points.

Scheduler should not own mode algorithms or mutable sequence-generation internals.

### 3.2 Voice module (target)

Voice module should own **timbre/synthesis** concerns only:
- `triggerVoice` synthesis behavior,
- gain/pan/timbre shaping,
- no sequencing algorithm ownership.

### 3.3 PatternModule domain (target)

PatternModule should own **sequence rendering**:
- accepts immutable params snapshot(s),
- renders immutable `EventWindow` objects,
- provides deterministic output from seed + params + beat window,
- eventually supports boundary-aware parameter updates (e.g., apply-at-next-step).

## 4) Migration Phases

### Phase A (done / prep)
- Document ownership seams and invariants.
- Keep behavior unchanged.
- Extract non-step generator logic into explicit legacy adapter (`renderLegacyVoicePattern`).
- Keep step-mode event-window path intact.

### Phase B (next)
- Introduce `PatternModuleRegistry` keyed by voice id.
- Route step mode through a first-class PatternModule instance instead of direct function calls.
- Preserve exact scheduling semantics and dedupe behavior.

### Phase C
- Add PatternModule implementations for euclid/ca/hybrid/fractal.
- Replace legacy scheduler cursor/pattern storage for those modes with window rendering.
- Keep fallback adapter behind a temporary feature gate until parity is verified.

### Phase D
- Remove `regen` semantics from UI-facing callbacks (or map to explicit boundary intents).
- Move sequencing update policy out of UI components.
- Keep UI controls, but stop exposing scheduler internals via booleans.

### Phase E
- Decommission legacy adapter and mutable pattern state in scheduler.
- Scheduler stores only transport cursors and per-voice dedupe metadata.

## 5) Risks and Non-Goals

### 5.1 Risks

- **Timing drift/duplication** during mixed-mode transition.
- **Behavior parity risk** for non-step modes when moving from cursor playback to window rendering.
- **UI expectation mismatch** if regeneration semantics change without compatibility shims.

### 5.2 Mitigations

- Keep one conversion point for beat→seconds in scheduler.
- Add deterministic tests for each migrated mode before cutover.
- Keep migration incremental with fallback adapter per mode.

### 5.3 Non-goals (this RFC)

- No patch-cable/routing design.
- No UI redesign.
- No new state-management framework.
- No synthesis redesign.

## 6) Implementation Notes for Next Agent

1. Create `PatternModuleRegistry` in engine layer and wire scheduler to request windows per voice.
2. Start with step mode parity tests against current `renderStepWindow` behavior.
3. Introduce mode-by-mode migration flags for safe rollout.
4. Remove `regen` boolean from UI callbacks only after scheduler no longer depends on legacy regeneration.

