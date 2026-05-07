# MIDI Out Phase 0 Audit — GRIDI

Date: 2026-05-07

## 1. Executive summary

This is an audit and implementation-plan document only. It intentionally does **not** add MIDI Out runtime behavior, change WebAudio semantics, or change the persisted patch schema.

GRIDI already has a useful foundation for MIDI work:

- the scheduler renders deterministic GEN/TRIGGER windows ahead of the WebAudio clock;
- the runtime event object already carries scheduled time, normalized velocity, drum lane information, and tonal note offsets;
- routing v0.4 already has a typed `midi` route domain and an `externalType: "midi"` endpoint shape;
- MIDI Input already requests Web MIDI access, parses note-on/note-off, tracks device state, and routes external MIDI into tonal modules.

The safest first MIDI Out path is therefore **not** a large routing rewrite. Phase 1 should add a small, mockable MIDI Out service and a narrow scheduler/event hook that mirrors selected generated note events to one user-selected MIDI output. Routing should remain compatible with v0.4 by expressing the selected source/output as a typed `domain: "midi"` route, but the initial runtime should still be intentionally narrow: one output, one selected GEN/source, note-on/note-off only, fixed/default note mapping, and no MIDI clock.

Recommended Phase 1 shape:

1. Add a browser-side MIDI Out manager parallel to `src/ui/midiInput.ts`.
2. Add pure helpers for MIDI note message formatting, note/velocity/gate mapping, and selected-output normalization.
3. Add a scheduler-level output observer/hook that receives the already-computed `GridiTriggerEvent` plus source/target context before or after the existing `engine.triggerVoice(...)` call.
4. Gate that hook behind explicit UI state / a typed MIDI route so existing WebAudio behavior is untouched when MIDI Out is disabled.
5. Start with generated tonal note events; defer drum maps, CC, clock, input/output matrices, and DAW transport sync.

## 2. Sources inspected

Required source files inspected:

- `src/engine/scheduler.ts`
- `src/routingGraph.ts`
- `src/patch.ts`
- `src/ui/triggerModule.ts`
- `src/ui/voiceModule.ts`
- `src/ui/header/routingOverviewPanel.ts`
- `src/ui/app.ts`

MIDI/event/audio related source inspected:

- `src/engine/events.ts`
- `src/engine/audio.ts`
- `src/engine/liveMidiNotes.ts`
- `src/ui/midiInput.ts`
- `src/ui/routingVisibility.ts`
- `src/ui/routingLabels.ts`
- `src/ui/state/moduleBatchActions.ts`

Tests inspected:

- `tests/schedulerPatternSource.test.mjs`
- `tests/eventSemanticsFoundation.test.mjs`
- `tests/eventWindowAndDedupe.test.mjs`
- `tests/patchMigrationRouting.test.mjs`
- `tests/routingGraphHybrid.test.mjs`
- `tests/routingVisibilityModel.test.mjs`
- `tests/midiInputFoundation.test.mjs`
- `tests/midiNoteLifecycle.test.mjs`

Audit context inspected:

- `docs/audits/routing-architecture-audit-2026-05.md`
- `docs/audits/interaction-architecture-audit-2026-05.md`

## 3. Current event and routing architecture summary

### 3.1 Where GEN events become sound events

GEN/TRIGGER modules do not directly produce audio. The current flow is:

1. `createScheduler(engine)` owns transport state, BPM, a 120 ms lookahead, and a 25 ms interval tick.
2. `scheduler.setPatch(...)` compiles the patch through `compileRoutingGraph(...)`.
3. Each scheduling tick iterates enabled sound modules, resolves each sound module's trigger source, renders the trigger's pattern window, converts each pattern event into a `GridiTriggerEvent`, and calls `engine.triggerVoice(sound.id, patch, eventTimeSec, voiceEvent)`.
4. `createEngine().triggerVoice(...)` resolves the target `drum` or `tonal` module, applies module parameters/modulations, constructs WebAudio nodes, schedules envelopes, and routes audio through effect/master destinations.

The important boundary is that the scheduler already sees both the generated event and its resolved sound target before audio starts. That is currently the first runtime boundary where generated musical events become sound-trigger requests.

### 3.2 Trigger source resolution

Event routing is hybrid:

- `compileRoutingGraph(...)` builds `eventSourceBySoundId` from valid typed `domain: "event"` routes.
- `scheduler.resolveTrigger(...)` uses the compiled event source first and falls back to the sound module's legacy `triggerSource` field.
- Routing v0.4 therefore supports typed event routes while preserving legacy patches and factory sessions.

This is relevant for MIDI Out because the first MIDI Out implementation should not require moving all event routing to a new model. It can observe the scheduler's resolved source/target context and remain compatible with both typed routes and legacy `triggerSource` patches.

### 3.3 Current MIDI routing model

`src/routingGraph.ts` already defines:

- route domains: `"event" | "modulation" | "audio" | "midi"`;
- an external MIDI endpoint: `{ kind: "external"; externalType: "midi"; portId?: string; channel?: number }`;
- route normalization for external MIDI endpoints;
- permissive validation for `domain: "midi"` routes.

Current runtime MIDI usage is MIDI Input only:

- `src/ui/midiInput.ts` calls `navigator.requestMIDIAccess({ sysex: false })` when available;
- it parses note-on/note-off messages into normalized note, velocity, and channel records;
- `src/ui/app.ts` maintains a single active MIDI input route from external MIDI to a tonal module;
- incoming note-on/off events call `engine.triggerVoice(...)` with `source: "midi"`, `gate`, `midiNote`, `velocity`, `notes`, and `timeSec`.

The `midi` route domain therefore currently represents external MIDI Input-to-module routing, but its endpoint shape is already capable of representing module-to-external MIDI Out routes.

### 3.4 Current audio routing model

Audio routing is separate from event routing:

- `Patch.connections` remains the legacy audio connection shape.
- Typed `domain: "audio"` routes are compiled back into connection-like records.
- The audio engine validates those connections and connects effect modules/master destinations.
- Sound modules are scheduled by event routing, not by audio connections.

MIDI Out should not be placed inside WebAudio routing in Phase 1. MIDI Out is event-domain behavior with an external side effect, not an audio graph node.

## 4. Event data available at dispatch time

At the scheduler dispatch boundary, these values are available or derivable:

| Data | Current availability | Notes for MIDI Out |
| --- | --- | --- |
| Source trigger / GEN id | Available in scheduler as `trigger.id` | Not included inside `GridiTriggerEvent`; pass in hook context. |
| Target voice/sound id | Available as `sound.id`; passed to `engine.triggerVoice(...)` | Useful for source scoping and future voice-mirror mode. |
| Target sound module | Available as `sound` | Useful for default tonal base mapping or drum lane filtering. |
| Scheduled timestamp | Available as `eventTimeSec`; copied into `voiceEvent.timeSec`; passed as `when` | Can convert to Web MIDI `send(data, DOMHighResTimeStamp)` using `performance.now()` offset if needed. |
| Velocity | Available as `ev.value` and `voiceEvent.velocity` | Normalized 0..1; MIDI helper should clamp/map to 1..127 for note-on, 0 for note-off. |
| Accent | Not explicit | Accent influences pattern value/lane in generators but is not a boolean dispatch field. Phase 1 should not depend on explicit accent. |
| Step index | Not directly available on `GridiTriggerEvent` | `PatternEvent` carries beat offsets, values, and lane-like data, but no stable user-facing step index is dispatched today. Defer step-index-dependent mappings. |
| Pitch/note info | Tonal events carry `notes: number[]` semitone offsets; incoming MIDI events may carry `midiNote` | Phase 1 should map note offsets to an external base MIDI note, e.g. base note 60 + rounded offset. |
| Drum lane/channel | Drum events carry normalized `lane`; drum module has `drumChannel` mode | Defer drum maps; route later through lane-to-note tables. |
| Gate length | Not produced by pattern scheduler | Phase 1 needs a configured default gate length in beats or milliseconds for generated events. |
| MIDI channel | Existing route endpoint may carry `channel`; no output state uses it yet | Phase 1 should normalize channel 1..16 with default 1. |

### 4.1 Important timing caveat

The scheduler currently calculates `eventTimeSec` as `now + ev.beatOffset * secPerBeat`, where `ev.beatOffset` is relative to the rendered window's start beat. Because each tick's `windowStartBeatAbs` is based on `now`, this is suitable for the current lookahead behavior. MIDI Out should preserve the current scheduler semantics and convert the already produced `timeSec` into the timestamp mechanism expected by Web MIDI, rather than recalculating musical timing elsewhere.

## 5. Cleanest boundary for MIDI Out

### 5.1 Boundary options evaluated

#### Option A — Scheduler output hook

Add a small observer/callback to the scheduler that receives a context object when a generated event is scheduled:

```ts
type ScheduledGridiEvent = {
  sourceModuleId: string;
  targetModuleId: string;
  targetType: "drum" | "tonal";
  eventBeat: number;
  eventTimeSec: number;
  event: GridiTriggerEvent;
};
```

Pros:

- Sees generated events at the exact point they are sent to WebAudio.
- Has source trigger, target voice, timing, velocity, note offsets, and lane information.
- Does not require changing audio engine semantics.
- Easy to unit test with mock callbacks.
- Compatible with both typed event routes and legacy `triggerSource`.

Cons:

- Requires a small scheduler API addition.
- Care is needed to avoid changing de-duplication behavior or event ordering.

Recommendation: **Use this as the Phase 1 runtime boundary.**

#### Option B — Routing graph sink only

Represent MIDI Out as a graph sink and compile it in `routingGraph.ts`.

Pros:

- Aligns with routing v0.4 language.
- Makes module-to-external route visible in the routing overview.

Cons:

- The routing graph currently normalizes and validates, but it does not dispatch runtime events by itself.
- A sink alone does not solve timing, gate scheduling, device access, or message formatting.

Recommendation: **Use typed MIDI routes as declarative state, but not as the only runtime implementation.**

#### Option C — New MIDI output module

Add a visible `MIDI OUT` module that receives GEN routes and emits to an external port.

Pros:

- Musically understandable in a modular workspace.
- Avoids DAW-like global routing matrices.
- Scales to multiple outputs later.

Cons:

- Requires patch schema/module taxonomy changes.
- Needs new module UI, factory handling, selection behavior, route validation, and migration decisions.
- Larger than Phase 1.

Recommendation: **Good long-term direction, but defer for Phase 2+.** Document only.

#### Option D — Global MIDI bridge

A global setting sends selected/generated events to the chosen output.

Pros:

- Fastest path to useful hardware/DAW workflows.
- Minimal schema and UI surface.
- Reuses existing scheduler context.

Cons:

- Less modular than a visible module.
- Can feel hidden if not represented in routing overview.

Recommendation: **Accept as a Phase 1 implementation detail only if mirrored by a typed MIDI route and surfaced in the routing panel.**

#### Option E — Voice modules mirror events to MIDI Out

Let each sound module mirror its incoming events to MIDI.

Pros:

- Uses target voice identity and synth/drum context.
- Keeps the generated event exactly aligned with local sound.

Cons:

- Couples MIDI Out to WebAudio voices.
- Makes `GEN -> MIDI only` awkward unless a local voice remains in the path.
- Could imply audio module settings define external MIDI behavior.

Recommendation: **Defer.** It may be useful as a later “mirror this voice to MIDI” feature, but not as the first architecture.

### 5.2 Recommended boundary

Use a **scheduler event observer** backed by **typed MIDI route state**:

- the UI stores/updates one enabled MIDI Out route such as `trigger module -> external midi`;
- the scheduler compiles routing as it does today and emits an observer event for each generated dispatch;
- a MIDI Out bridge filters observer events against the selected source route;
- the bridge maps tonal `notes` to MIDI note numbers and schedules note-on/note-off to the selected output;
- if no route/output/access is enabled, the observer is a no-op.

This keeps the event timing boundary small, avoids WebAudio engine changes, and remains compatible with routing v0.4.

## 6. Recommended Phase 1 architecture

### 6.1 Components

1. `src/ui/midiOutput.ts` or `src/midi/output.ts`
   - Requests Web MIDI access with `sysex: false`.
   - Lists `midiAccess.outputs`.
   - Tracks selected output id and selected output availability.
   - Exposes `send(data, time?)` for a selected output.
   - Has no knowledge of GRIDI patch internals.

2. `src/midi/messages.ts` or `src/ui/midiMessages.ts`
   - Pure helpers:
     - `formatNoteOn(channel, note, velocity)`;
     - `formatNoteOff(channel, note, releaseVelocity?)`;
     - `normalizeMidiChannel(value)`;
     - `normalizeMidiNote(value)`;
     - `normalizeMidiVelocity(value)`.

3. `src/midi/gridiEventMapping.ts`
   - Pure helpers:
     - map normalized velocity to MIDI velocity;
     - map tonal note offset(s) to MIDI note number(s);
     - derive note-off time from gate length;
     - ignore unsupported event kinds by default.

4. Scheduler observer API
   - Add an optional `onScheduledEvent` callback or setter to `createScheduler(...)`.
   - Callback receives source module id, target module id, event beat/time, and `GridiTriggerEvent`.
   - Existing `engine.triggerVoice(...)` call remains unchanged.

5. UI bridge in `src/ui/app.ts`
   - Owns MIDI Out manager lifecycle next to MIDI Input.
   - Resolves the active MIDI Out route and selected output state.
   - Connects scheduler observer to MIDI Out mapping/sending.

### 6.2 Suggested first runtime route shape

Do not change `Patch.version` in Phase 1 unless the team explicitly chooses to persist MIDI Out settings. The existing optional `Patch.routes` shape can represent a minimal MIDI Out route:

```ts
{
  id: `midi-out:${sourceModuleId}:${outputId ?? "auto"}`,
  domain: "midi",
  source: { kind: "module", moduleId: sourceModuleId, port: "events-out" },
  target: { kind: "external", externalType: "midi", portId: outputId ?? undefined, channel: 1 },
  enabled: true,
  metadata: { createdFrom: "ui", lane: "midi-out" }
}
```

Because `domain: "midi"` validation is currently permissive, Phase 1 should add tests for this route shape before tightening validation. If persistence is considered too early, keep equivalent UI state in session-only app state and document the future route shape; however, representing it in `Patch.routes` is more consistent with routing v0.4 and the existing MIDI Input route.

### 6.3 Minimal user workflow

1. User opens Routing Overview or a compact header MIDI popover.
2. User clicks **Enable MIDI Out**.
3. Browser requests MIDI permission.
4. User selects one output from available MIDI outputs.
5. User selects one GEN/TRIGGER source.
6. GRIDI emits note-on/note-off from that source while transport runs.
7. Local WebAudio behavior remains unchanged unless the user mutes/disables local voices manually.

Recommended defaults:

- MIDI channel: 1.
- Base MIDI note: 60 (C4 by common MIDI naming; labels vary by DAW/vendor).
- Note mapping: `round(baseNote + noteOffset)` clamped to 0..127.
- Velocity: `max(1, round(clamp01(velocity) * 127))` for note-on.
- Gate length: fixed 100 ms or a simple musical default such as 0.45 step at current BPM.
- Chords/poly offsets: emit up to 4 notes, matching the current poly cap used by tonal reception.
- Drum events: ignored in Phase 1 with a clear UI note.

### 6.4 Proposed UI surface

Keep the UI small and instrument-like:

- Add a **MIDI Out** section in the existing Routing Overview MIDI domain.
- Fields:
  - status: unsupported / permission needed / denied / connected / no outputs;
  - output selector: Auto or explicit output name;
  - source selector: one GEN/TRIGGER module;
  - channel selector: 1–16, default 1;
  - simple note mapping label: `C4 + GEN pitch` or `Base note 60 + offset`;
  - gate label/control: fixed initially, editable later.
- Display the active route in the MIDI route list as `GEN name → MIDI Out: output name ch. N`.
- Avoid a full matrix and avoid per-step editing.

A future visible `MIDI OUT` module can be introduced once route validation, module shell behavior, and multi-output workflows are clearer.

## 7. Proposed patch/state shape

### 7.1 Minimal persisted route-first option

Use `Patch.routes` for the connection and keep detailed mapping in UI defaults for Phase 1:

```ts
type MidiOutRoute = PatchRoute & {
  domain: "midi";
  source: { kind: "module"; moduleId: string; port: "events-out" };
  target: { kind: "external"; externalType: "midi"; portId?: string; channel?: number };
  metadata?: { createdFrom?: "ui"; lane?: "midi-out" };
};
```

Pros:

- No new top-level patch field.
- Reuses v0.4 route vocabulary.
- Routing Overview can show the connection.

Cons:

- Mapping/gate defaults are implicit unless extra metadata or state is added.

### 7.2 Minimal app/session state option

For browser/device-specific settings, maintain session-local UI state:

```ts
type MidiOutRuntimeState = {
  enabled: boolean;
  outputId: string | null;
  sourceModuleId: string | null;
  channel: number;
  baseNote: number;
  gateMs: number;
};
```

This is appropriate for device IDs and permission state because Web MIDI device IDs are browser/profile/OS dependent and may not be portable across machines.

### 7.3 Proposed future patch fields

If Phase 1 proves useful, add explicit mapping state later, either in a dedicated route metadata object or a future MIDI Out module:

```ts
type MidiOutMapping = {
  enabled: boolean;
  outputId?: string;
  channel: number;
  baseNote: number;
  noteMode: "offset-from-base" | "fixed" | "scale";
  velocityMode: "event" | "fixed";
  fixedVelocity?: number;
  gateMs: number;
};
```

Avoid adding all of these in Phase 1. At most, document them or keep them as non-persisted defaults.

## 8. Web MIDI browser constraints

- Web MIDI requires `navigator.requestMIDIAccess`; not all browsers support it.
- Access is permission-gated and may be denied by user choice, browser policy, insecure context, or platform limitation.
- Sysex should remain disabled (`sysex: false`) for this feature.
- Device IDs and names are not reliable long-term identifiers across OS/browser/profile changes.
- Output availability can change at runtime; `MIDIAccess.onstatechange` should refresh the selected output.
- Timestamps passed to `MIDIOutput.send(data, timestamp)` use the Web MIDI timestamp clock (`DOMHighResTimeStamp`, aligned with `performance.now()`), not `AudioContext.currentTime` seconds. A bridge must convert from audio-context seconds to performance milliseconds or use immediate sends if precise scheduling is not yet implemented.
- Permission persistence varies by browser. Phase 1 should handle unsupported/denied/no-output states gracefully and not assume persistence.

## 9. Ardour, Cardinal, and Linux virtual MIDI notes

A useful Linux workflow is:

`GRIDI in browser → Web MIDI output → virtual MIDI port → Ardour MIDI track → Cardinal/VCV-style instrument plugin or external synth`

Operational notes:

- Browsers expose MIDI outputs that the OS/MIDI stack exposes to them; users may need a virtual MIDI bridge or loopback port.
- On Linux, common setups include ALSA/JACK/PipeWire MIDI bridging or a virtual MIDI tool/port. Exact names vary by distro/session manager.
- Ardour can receive MIDI on a MIDI track from system/virtual ports, then route it to an instrument plugin such as Cardinal or to external hardware.
- Cardinal/VCV-style instruments generally expect note/gate or MIDI-to-CV conversion inside the plugin patch. Phase 1 note-on/note-off is enough for a first test.
- GRIDI should not attempt to become an Ardour transport controller in Phase 1. Let Ardour record incoming MIDI or monitor it while GRIDI remains the generative instrument.
- Latency will depend on browser scheduling, MIDI bridge, DAW buffer size, plugin processing, and audio interface configuration. Phase 1 should prioritize correctness and safety over tight DAW sync.

## 10. Risks

1. **Timing mismatch**
   - WebAudio uses seconds on `AudioContext.currentTime`; Web MIDI output timestamps use `performance.now()`-style milliseconds.
   - Mitigation: isolate timestamp conversion in one helper and test it with mock clocks.

2. **Stuck notes**
   - Crashes, output changes, route changes, or transport stop could leave notes on.
   - Mitigation: track active outbound notes and send note-off/all-notes-off on stop, output change, route disable, and dispose.

3. **Hidden global behavior**
   - A global bridge can be hard to understand.
   - Mitigation: show active MIDI Out state in Routing Overview and status/header UI.

4. **Patch portability**
   - Persisted hardware output IDs may not exist on another machine.
   - Mitigation: treat output IDs as preferences, fall back to Auto/None, and surface unavailable output warnings.

5. **Routing ambiguity**
   - Existing `domain: "midi"` validation is permissive and currently used for MIDI Input.
   - Mitigation: document accepted route shapes and add tests before tightening validation.

6. **Accidental large DAW-like scope**
   - Feature pressure may push toward clocks, transport, matrices, CC automation, and per-track settings.
   - Mitigation: keep Phase 1 explicitly one-output/one-source/note-only.

## 11. Deferred work

Defer all of the following beyond Phase 1:

- MIDI clock output.
- MIDI clock input.
- MIDI input expansion beyond the existing note input foundation.
- External DAW transport sync/start/stop/song-position handling.
- CC modulation and automation.
- Pitch bend, aftertouch, program change, and bank select.
- MPE.
- Per-lane drum note maps.
- Per-module/per-route MIDI matrices.
- Multiple simultaneous MIDI outputs.
- Browser permission persistence strategy.
- Dedicated visible MIDI Out module family.
- Scale/key quantization UI.
- Recording/exporting MIDI files.

## 12. Recommended Phase 1 implementation plan

### Step 1 — Pure MIDI helpers

Add tests first for pure helpers:

- `formatNoteOn(1, 60, 100) -> [0x90, 60, 100]`;
- `formatNoteOff(1, 60, 0) -> [0x80, 60, 0]`;
- channel clamps to 1..16 and formats as status low nibble 0..15;
- notes clamp to 0..127;
- normalized event velocity maps to 1..127 for note-on.

### Step 2 — Event-to-MIDI mapping helpers

Add tests for:

- tonal `GridiTriggerEvent` with `notes: [0]` maps to base note 60;
- offsets are rounded and clamped;
- poly events emit a bounded note list;
- drum events return no messages in Phase 1;
- gate length produces deterministic note-off timing.

### Step 3 — MIDI Output manager

Add a manager parallel to `createMidiInputManager(...)`:

- request MIDI access with `sysex: false`;
- enumerate `midiAccess.outputs`;
- choose explicit output if present, otherwise Auto if allowed;
- expose connected/unsupported/denied/idle status;
- clear selected output on dispose;
- send all-notes-off / tracked note-offs on disable if active note tracking is included.

### Step 4 — Scheduler observer

Add a narrow scheduler observer without changing existing engine behavior:

```ts
createScheduler(engine, {
  onScheduledEvent(event) {
    midiOutBridge.handleScheduledEvent(event);
  }
});
```

or add a setter if constructor signature churn is undesirable.

Tests should verify:

- existing `engine.triggerVoice(...)` calls remain unchanged;
- observer receives the same event timing/velocity/note data;
- disabled/no-op observer does not affect scheduling;
- de-duplication still prevents repeat observer calls across lookahead windows.

### Step 5 — Minimal UI and route state

Add a compact Routing Overview MIDI Out editor:

- enable toggle;
- output selector;
- source GEN selector;
- channel selector;
- status/warning text;
- fixed mapping description.

Write/update tests around route visibility/model normalization if route persistence is added.

## 13. Answer summary for audit questions

1. **Where do GEN events currently become sound events?**
   - In `src/engine/scheduler.ts`, after pattern window rendering and before `engine.triggerVoice(...)`. The audio engine then turns that event into WebAudio nodes/envelopes.

2. **What event data exists at dispatch time?**
   - Available: source trigger id, target sound id/module, scheduled time, event beat, velocity, tonal note offsets, drum lane, drum channel context, target voice.
   - Not available as stable explicit fields: step index, accent boolean, persisted gate length.

3. **What is the cleanest boundary for MIDI Out?**
   - A scheduler output observer/hook with typed MIDI route filtering. Do not put Phase 1 inside the audio engine.

4. **How should MIDI Out relate to routing?**
   - Phase 1 should represent the selected source/output as a `domain: "midi"` route from module to external MIDI output, but execute via a small MIDI bridge fed by the scheduler observer.
   - A dedicated MIDI module family is a good later design once the first bridge is proven.

5. **What minimal patch fields would Phase 1 need?**
   - Prefer no new top-level fields. Use existing `Patch.routes` with `domain: "midi"`, module source, external MIDI target, optional `portId`, optional `channel`, and `metadata.lane: "midi-out"`.
   - Keep output selection/runtime permission details session-local or treat persisted output IDs as best-effort preferences.

6. **What should be deferred?**
   - MIDI clock, MIDI input expansion, CC, MPE, per-lane drum maps, DAW transport sync, permission persistence, full MIDI routing matrix, multiple outputs, and a visible MIDI module family.
