# Audio control instability diagnosis (2026-04-13)

## Scope

This pass is diagnosis-only for runtime instability during synth/drum/control edits while transport is running.

Investigated paths:

- UI control write cadence (`knob`/`ctlFloat` and module surfaces)
- Patch mutation and scheduler/engine synchronization (`onPatchChange`)
- Audio routing synchronization and effect updates (`engine.syncRouting`, `effects`)
- Voice trigger/render behavior (`engine.triggerVoice`)
- Modulation/control sampling (`engine/control`, `scheduler`)
- Undo gesture batching and whether it changes runtime writes

## High-confidence findings

### 1) Primary root cause: every knob tick performs full routing teardown/rebuild

`onPatchChange` always calls `engine.syncRouting(patch)` even for simple parameter tweaks such as drum tone, synth cutoff, pan, etc. That means high-frequency knob events trigger routing synchronization continuously. In `syncRouting`, the engine:

1. updates/creates effect instances,
2. disconnects every effect module,
3. validates and rebuilds all active connections,
4. reconnects default-to-master fallbacks.

This graph churn happens on non-routing edits and is likely the main source of zipper/glitch artifacts and short gain discontinuities while audio is active.

### 2) Secondary root cause: gain-like params are assigned as hard steps, not smoothed ramps

Effects `update()` applies `this.output.gain.value = ...` directly. No `cancelScheduledValues` / `setTargetAtTime` / linear ramp is used. If any effect gain/bypass change lands mid-signal, discontinuity risk is high.

Master gain also uses immediate assignment in `setMasterGain` when unmuted (`master.gain.value = masterTarget`), so header gain moves can step abruptly.

### 3) Voice model is one-shot allocation per trigger (not live-parameter voice updates)

Drum and tonal voices are fully instantiated inside `triggerVoice()` and parameters are sampled at trigger time. There is no persistent active-voice registry receiving continuous parameter updates from UI changes. Result:

- many controls are *safe* in that they only affect future triggers,
- but edits to currently sounding notes generally do not smoothly morph active voices,
- any instability heard during editing is more likely from global routing/effect graph churn than per-voice param smoothing errors.

### 4) UI write cadence is high enough to amplify engine-side graph churn

Knob drag `pointermove` emits `onChange` continuously. Each emission mutates patch + scheduler patch + routing sync. There is no write throttling/coalescing at UI boundary.

By itself this is expected for expressive controls; combined with full graph rebuild on every tick, it becomes unstable under load.

### 5) Cross-voice interaction risk is mostly in shared downstream path, not shared synth voice state

Per-trigger voices are independent node chains. Cross-voice jumps are most plausibly introduced where all voices converge (effect/master routing) and that shared graph is being repeatedly disconnected/reconnected.

## Answers to requested questions

### Which parameters currently update safely and which do not?

**Relatively safer now (future-note only, no live active-voice morph):**

- Most drum/synth synthesis controls (attack/decay/tone/cutoff/etc.) because they are sampled when a voice is triggered.

**Not safe for click-free runtime updates:**

- Routing-related changes (and currently *all* parameter changes due to shared `onPatchChange` behavior) because they force global routing sync.
- Effect gain/bypass changes (hard `.value` assignment).
- Master gain changes (hard `.value` assignment when not muted).

### Are some controls rebuilding audio state instead of smoothing values?

Yes. In current behavior, virtually all control movements indirectly rebuild routing state (disconnect/reconnect cycles) because `onPatchChange` calls `engine.syncRouting` unconditionally.

### Is there shared gain compensation or cross-voice interaction causing temporary jumps?

There is no explicit shared “gain compensation” module causing jumps. Temporary jumps are most likely caused by shared downstream graph churn and immediate gain parameter steps in effect/master paths.

### Are there missing ramps/smoothing on specific parameters?

Yes:

- Effect output gain (including bypass transitions)
- Master gain (`setMasterGain` path)

Also, there is no dedicated smoothing layer for live-updatable per-voice parameters (because active voices are not tracked/updated after trigger).

### Are UI update frequency or parameter write cadence contributing to glitches?

Yes, materially. Knob pointer movement emits rapid updates; each currently triggers scheduler patch update + full routing sync. Cadence is appropriate for musical controls, but runtime handling is too heavy for that cadence.

### Safest fix sequence from here

1. **Split patch-change pathways (highest impact, low risk):**
   - Add a lightweight mutation path for non-routing parameter edits that *does not* call `engine.syncRouting`.
   - Call `syncRouting` only when routing topology/effect module connectivity actually changes.

2. **Add smoothing for shared gain params (low risk):**
   - Effect gain/bypass transitions: apply short ramp (`setTargetAtTime` ~5–20 ms).
   - Master gain changes: same smoothing approach as mute path.

3. **Optional write coalescing (moderate risk, optional):**
   - If needed after #1/#2, coalesce high-frequency UI writes per animation frame for non-critical visual state.
   - Keep direct control feel; avoid introducing latency in audible parameter response.

4. **Future-proof for modulation/live morphing (larger design pass):**
   - If true live morph of sustaining voices is desired, introduce active-voice tracking and explicit AudioParam automation paths.
   - Keep this separate from stability hotfixes.

## Risk notes

- Do **not** attempt broad synth redesign in the first fix pass.
- First implementation pass should be routing-sync gating + gain smoothing only.
- Re-test with multiple voices + at least one effect route while continuously moving drum/synth knobs.

## Validation run in this pass

- `npm run typecheck`
- `npm run build`
