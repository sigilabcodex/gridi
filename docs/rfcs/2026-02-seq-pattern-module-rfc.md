# RFC: Deterministic Pattern Module Boundary (Engine / Scheduler / UI)

- **Status**: Proposed (Revision 3)
- **Authors**: GRIDI Planning & Architecture
- **Last Updated**: 2026-02-17
- **Target Release Window**: v0.32.x (internal architecture), no version bump in this RFC

---

## 1) Summary

This RFC formalizes a strict PatternModule boundary while mapping directly to the current codebase. The revision adds:

1. Explicit **as-is → to-be** mapping (files + functions).
2. A reduced-scope **pilot**: immutable EventWindow for **one mode first** (`step`).
3. A concrete EventWindow **timebase decision** and conversion path consistent with current scheduler behavior.

Goal remains unchanged: preserve controlled indeterminacy, deterministic timing, and clean Engine/Scheduler/UI separation.

---

## 1.1) Minimal Architecture Diagram (Current vs Pilot)

```text
CURRENT (as-is)

UI intent ───────────────────────────────────────────────┐
                                                         │
Scheduler                                                │
  - look-ahead loop                                      │
  - pattern generation (all modes)                       │
  - mutable per-voice sequencing state                   │
  - decides hit + dispatch time                          │
             │                                           │
             └──────── triggerVoice(timeSec) ───────────▶ Engine
                                                        (audio synthesis @ exact time)


PILOT (PR-1..PR-5, step mode only)

UI intent ───────────────────────────────────────────────┐
                                                         │
PatternModule (step pilot)
  - owns step pattern generation
  - returns immutable EventWindow (beat offsets)
             │
             │  EventWindow boundary
             ▼
Scheduler
  - look-ahead + transport cursor
  - beat->seconds conversion
  - dispatch only (no step generation internals)
             │
             └──────── triggerVoice(timeSec) ───────────▶ Engine
                                                        (audio synthesis @ exact time)

Legacy modes (euclid/ca/hybrid/fractal): remain on fallback adapter path during pilot.
```

---

## 2) As-Is → To-Be Mapping (Concrete Repo Pointers)

## 2.1 As-Is (current implementation)

### Pattern generation currently happens in scheduler layer
- File: `src/engine/scheduler.ts`
- Functions:
  - `genStepPattern` (random density pattern). 
  - `genEuclidPattern` + `bjorklund` + `rotatePattern`.
  - `genCAPattern`.
  - `genHybridPattern`.
  - `regenVoice` selects mode and writes generated pattern into state.
  - `regenAll` calls `regenVoice` for each voice.

Implication: generation logic lives inside scheduler, not in a dedicated pattern component.

### Scheduler currently mutates sequencing state
- File: `src/engine/scheduler.ts`
- Mutable per-voice state (`VoiceState`):
  - `step`
  - `nextTime`
  - `pattern`
- Mutation sites:
  - `regenVoice` mutates `st.pattern` and resets `st.step`.
  - `scheduleLoop` mutates `st.step` and `st.nextTime` while scheduling.
  - `start`/`stop` reset timing counters.

Implication: scheduler currently owns both timing progression and pattern memory/mutation.

### Trigger path (timing handoff)
- File: `src/engine/scheduler.ts`
  - `scheduleLoop` calls `engine.triggerVoice(i, patch, st.nextTime)`.
- File: `src/engine/audio.ts`
  - `triggerVoice` receives exact `AudioContext` time and schedules envelopes/oscillator/noise at that timestamp.

Implication: scheduler timebase is already `AudioContext.currentTime` seconds for the final trigger handoff.

---

## 2.2 To-Be (target boundary)

### PatternModule ownership
- New responsibility: pattern generation moves out of scheduler internals.
- Scheduler asks PatternModule for immutable event windows.
- Scheduler no longer regenerates/rewrites pattern buffers directly.

### Scheduler ownership
- Keeps transport/look-ahead loop and exact-time dispatch only.
- Consumes immutable windows and advances timing cursor.
- No mode-specific generation algorithms embedded in scheduler loop.

### UI ownership
- Continues emitting intent (params, mode, seed), but does not own canonical sequence timing state.

---

## 3) Scope (Revised)

### In Scope
- Add PatternModule contract for pilot mode.
- Add immutable EventWindow contract.
- Refactor scheduler consumption path for pilot mode only.
- Keep legacy modes available via adapter/fallback path.
- Add tests for deterministic EventWindow behavior in pilot.

### Out of Scope
- Multi-mode migration in this RFC cycle.
- UI redesign or new controls.
- Version changes.
- New synthesis features.

---

## 4) Pilot Strategy (Single Mode First)

Recommendation: **pilot with `step` mode**.

Why `step` first:
- Simplest generator and easiest determinism assertions.
- Lowest migration risk.
- Fastest validation of immutable-window + scheduler contract.

Legacy handling during pilot:
- `euclid`, `ca`, `hybrid`, `fractal` remain on existing path behind a compatibility adapter.
- No functional redesign for non-pilot modes during pilot PRs.

Exit criterion for pilot completion:
- `step` mode fully served through EventWindow path with deterministic tests.
- Legacy modes still functioning unchanged through fallback adapter.

---

## 5) EventWindow Timebase Decision

## Decision
Use **beat-relative offsets** inside EventWindow, then convert to AudioContext seconds in scheduler.

### Representation
- `EventWindow` contains events with `beatOffset` (relative to window start beat).
- Window is requested by beat range: `[startBeat, endBeat)`.

### Conversion path
1. Scheduler computes beat range from transport cursor + look-ahead.
2. PatternModule returns immutable events in beat offsets.
3. Scheduler converts `beatOffset` to absolute seconds using current BPM:
   - `seconds = windowStartSec + beatOffset * (60 / bpm)`
4. Scheduler calls `engine.triggerVoice(..., seconds)`.

### Why this is simplest for GRIDI now
- Current scheduler already derives per-step timing from BPM (`voiceStepDur`).
- Audio engine already expects exact AudioContext seconds.
- Beat-relative windows avoid floating accumulation in generators while preserving deterministic conversion at dispatch.

---

## 6) Contracts (Pilot-Sized)

### PatternModule (pilot)
- `setParams(nextParams, effectiveAtStep)`
- `renderWindow(startBeat, endBeat, ctx): EventWindow`

### EventWindow constraints
- Immutable after creation.
- Sorted by `beatOffset`.
- Event identity stable enough for de-dup checks in tests.

### Consistency rule
- Scheduler reads fully materialized windows only.
- Parameter updates applied at explicit boundaries (pilot default: next-step).

---

## 7) Atomic PR Plan (Revised, Small PRs)

## PR-1: As-is documentation + pilot scaffolding
- Add code comments/doc notes that mark current generation/mutation ownership.
- Introduce pilot-level types: `PatternModule`, `EventWindow`.
- No behavior change.

**Acceptance criteria**
- Build passes.
- Contracts compile.
- Runtime unchanged.

## PR-2: Step-mode PatternModule extraction
- Move only `step` generation logic from scheduler internals into pilot PatternModule.
- Keep legacy modes on existing generator path.

**Acceptance criteria**
- `step` mode generation no longer implemented inline in scheduler loop.
- Non-step modes unaffected functionally.

## PR-3: Immutable EventWindow scheduling for step mode
- Scheduler consumes EventWindow for `step` mode.
- Convert beat offsets to AudioContext seconds at dispatch.
- Legacy adapter handles non-step modes.

**Acceptance criteria**
- `step` mode timing parity within baseline tolerance.
- No duplicate/missed step events in look-ahead windows.

## PR-4: Determinism + state-consistency tests (pilot)
- Add tests for seeded reproducibility in `step` mode.
- Add overlap/edge tests for window boundaries.

**Acceptance criteria**
- Determinism tests green across repeated runs.
- No dup/drop at window boundaries in pilot mode.

## PR-5: Boundary-queued params for pilot path
- Apply param updates at explicit next-step boundary for `step` EventWindow path.
- Keep scope limited to pilot plumbing (no UI feature changes).

**Acceptance criteria**
- Rapid param changes do not create half-applied step windows.
- Existing legacy modes remain stable.

---

## 8) Risk Analysis (Pilot-Focused)

### Audio timing
- Risk: conversion error from beats to seconds.
- Mitigation: single conversion location in scheduler + tolerance tests.

### State consistency
- Risk: dual path divergence (pilot vs legacy).
- Mitigation: explicit adapter boundary + per-mode routing table.

### UI coupling
- Risk: accidental UI dependence during pilot.
- Mitigation: no UI behavior changes; only scheduler/pattern plumbing.

---

## 9) Invariants

1. Engine dispatch still happens with explicit AudioContext timestamp.
2. `step` mode sequence is reproducible from seed + params.
3. Scheduler does not mutate emitted EventWindow contents.
4. Legacy modes continue through fallback path until explicitly migrated.
5. No UI redesign introduced by this RFC.

---

## 10) Decision Request

Approve this revised RFC with a **step-mode pilot** and explicit as-is/to-be mapping. This keeps PRs small, reduces migration risk, and validates immutable EventWindow design before multi-mode rollout.
