# Routing Architecture Audit — GRIDI v0.4 Planning

## 1. Executive summary

This audit is the opening, audit-only pass for the GRIDI `v0.4` Routing phase. No runtime implementation, refactor, patch-schema change, UI behavior change, example change, or dependency change is proposed as part of this document.

Current routing is best described as a **hybrid compatibility model**:

- **Legacy module-owned fields remain behavior-critical**:
  - sound modules (`drum`, `tonal`) own `triggerSource` for event input;
  - trigger/sound modules own `modulations` maps for control assignment;
  - `Patch.connections` owns legacy audio links.
- **Patch-owned typed routes exist as an optional normalized overlay** in `Patch.routes`, with domains for `event`, `modulation`, `audio`, and `midi`.
- **`compileRoutingGraph()` is the main cross-domain normalizer**, but runtime authority is split:
  - scheduler event source resolution uses the compiled graph first, then falls back to `triggerSource`;
  - audio routing compiles typed audio routes into legacy `Connection`-shaped records, then validates them through the older audio connection validator;
  - modulation routing is visible through the compiled graph, but runtime modulation still samples module-owned `modulations` maps in several places.
- **VISUAL routing is not explicit signal routing today**. Visual modules observe the master/analyzer stream and display a synthetic “Master mix” input with sound-module contributors.
- **Buses are serialized but not runtime-supported for audio output**. Bus targets are normalized in schema-level structures, but audio validation warns that bus routing is not currently supported at runtime.
- **Factory examples rely primarily on legacy event fields**, especially `triggerSource` and `drumChannel`, not explicit route records.

The main v0.4 challenge is therefore not “build a graph editor.” It is to consolidate routing ownership, language, validation, and UI visibility while preserving the current instrument identity: a modular generative instrument with fixed module shells and routing as patching/instrument flow, not a DAW mixer or timeline.

Recommended direction: keep v0.4 staged and compatibility-first. Start by documenting and testing the current hybrid contract, then make small improvements to route visibility, warnings, DRUM lane/channel explanation, and typed-route parity before considering any schema migration.

## 2. Sources reviewed

### Required docs reviewed

- `README.md`
- `ROADMAP.md`
- `docs/status.md`
- `docs/releases.md`
- `docs/gen-mode-design-principles.md`
- `docs/ui-principles.md`
- `docs/ui-faceplate-grammar.md`
- `docs/audits/post-0.33.0-gen-ui-regression-qa-2026-05-06.md`
- `docs/audits/gen-mode-semantics-controls-display-audit-2026-04.md`
- `docs/audits/version-milestone-audit-2026-05.md`

### Routing-relevant source reviewed

- `src/patch.ts`
- `src/routingGraph.ts`
- `src/engine/scheduler.ts`
- `src/engine/events.ts`
- `src/engine/audio.ts`
- `src/engine/routing.ts`
- `src/ui/triggerModule.ts`
- `src/ui/voiceModule.ts` (`drum` and `tonal`/SYNTH surfaces; requested `drumModule.ts` and `synthModule.ts` are represented here in the current tree)
- `src/ui/controlModule.ts`
- `src/ui/visualModule.ts`
- `src/ui/routingVisibility.ts`
- `src/ui/routingLabels.ts`
- `src/ui/app.ts`
- `src/ui/render/moduleGrid.ts`
- `src/ui/header/routingOverviewPanel.ts`
- `src/ui/controlTargetCatalog.ts`
- `src/ui/targetModulationAssign.ts`
- `src/ui/persistence/presetStore.ts`

### Routing-relevant tests reviewed

- `tests/routingGraphHybrid.test.mjs`
- `tests/schedulerPatternSource.test.mjs`
- `tests/patchMigrationRouting.test.mjs`
- `tests/routingVisibilityModel.test.mjs`
- `tests/eventSemanticsFoundation.test.mjs`
- `tests/eventWindowAndDedupe.test.mjs`
- `tests/presetStore.test.mjs`
- `tests/soundModules.test.mjs`

### Factory/example session data reviewed

There is no separate top-level `examples/` directory in the current tree. Factory/example session data is generated in `src/ui/persistence/presetStore.ts` by `factoryExamplePatches()` / `factoryExamplePresets()`. These examples serialize routing mainly through `triggerSource`, `drumChannel`, and normalized patch shells with empty `connections`.

## 3. Current routing architecture

Current GRIDI routing has five overlapping systems:

### 3.1 Event routing

Event routing connects GEN/TRIGGER modules to sound modules (`drum` and `tonal`). It exists in two representations:

1. **Legacy, module-owned event routing**
   - Sound modules store `triggerSource: string | null`.
   - This is still actively edited by per-module Routing tabs and factory examples.
   - Scheduler uses it as fallback when the compiled graph has no typed event source for a sound module.

2. **Typed, patch-owned event routing**
   - `Patch.routes` may include `domain: "event"` records.
   - Valid event routes must be module-to-module routes from a `trigger` source to a `drum` or `tonal` target.
   - When at least one valid typed event route exists, typed event routes become canonical for the event domain inside the routing graph.

Runtime event scheduling is therefore **hybrid**: typed route first, legacy field fallback.

### 3.2 Audio routing

Audio routing has three layers:

1. **Default direct-to-master voice output**
   - If a voice has no valid audio route, `resolveVoiceDestinations()` sends it to master.

2. **Legacy `Patch.connections`**
   - Connections use `fromModuleId`, `fromPort`, `to`, `gain`, and `enabled`.
   - The runtime validator currently accepts audio sources from `drum`, `tonal`, and `effect` modules.
   - Valid module targets must be effects.
   - Master targets are supported.
   - Bus targets are rejected at runtime with warnings.

3. **Typed audio routes**
   - `Patch.routes` can contain `domain: "audio"` routes.
   - `compileRoutingGraph()` converts these to `Connection`-shaped records for the existing audio runtime.
   - Typed audio routes are equivalent to legacy connections once compiled, but bus semantics remain limited by the older validator/runtime.

### 3.3 Control/modulation routing

Control modules are modulation sources. The current model is also hybrid:

- Legacy assignment is stored on the target module as `modulations?: Partial<Record<string, string>>`, mapping `parameterKey -> controlModuleId`.
- Typed modulation routes can exist in `Patch.routes` with `domain: "modulation"`, control-module source, module target, and `metadata.parameter`.
- The compiled graph exposes incoming modulation by target and enforces one controller per target parameter in graph compilation.
- Runtime modulation is not fully graph-authoritative yet:
  - scheduler trigger-density modulation reads `trigger.modulations?.density` directly;
  - DRUM pitch modulation reads compiled snapshot sources for UI/runtime display but also falls back to `d.modulations?.basePitch`;
  - SYNTH cutoff modulation similarly uses compiled incoming map with legacy fallback;
  - audio engine parameter modulation uses module-owned modulation maps via its `modulate()` path.

This means modulation is **represented in the graph but still executed mainly through target-owned maps**.

### 3.4 Analyzer/VISUAL routing

VISUAL modules currently observe global analyzer state, not explicit patch routes.

- The engine creates analyzers from the master path.
- Visual modes read data through engine APIs such as scope, spectrum, stereo scope, and master activity.
- UI routing snapshots describe visual input as `Master mix` and list sound modules as contributors.
- There is no explicit `visualSource`, per-visual bus input, or event/control target route for VISUAL in the current runtime.

### 3.5 MIDI routing

MIDI appears in the typed route domain and global routing UI. It is partially first-class in visibility and selection UX:

- `RouteDomain` includes `midi`.
- Route endpoints can be `external` with `externalType: "midi"`.
- The global Routing UI includes MIDI input routing and MIDI route listing.
- This audit focuses on performance routing consolidation for event/audio/control/visual, but MIDI is a routing-domain precedent that v0.4 must not break.

### 3.6 Implicit routing not represented as explicit patch connections

Important implicit routing includes:

- sound modules defaulting to master output when no audio route exists;
- VISUAL modules observing master/analyzer state;
- DRUM auto lane filtering based on generated event lane and, when multiple drums share a trigger, preferred lane from `basePitch`;
- SYNTH note offsets derived from trigger pattern events and reception mode;
- module deletion cleanup removing `triggerSource` / `modulations` references but not necessarily providing a full typed-route migration story;
- factory examples encoding GEN→voice flow by `triggerSource` rather than explicit event routes.

## 4. Patch schema and serialized routing

### 4.1 Active patch version

Patch schema remains `version: "0.3"`.

No schema change is proposed in this audit.

### 4.2 Serialized routing fields

The patch type includes:

- `modules: Module[]`
- `buses: Bus[]`
- `connections: Connection[]`
- optional `routes?: PatchRoute[]`

Routing-relevant module-owned fields include:

- `SoundBase.triggerSource: string | null`
- `SoundBase.modulations?: ModulationMap`
- `TriggerModule.modulations?: ModulationMap`
- `DrumSynthModule.drumChannel`
- `TonalSynthModule.reception`

### 4.3 `Patch.connections`

`Connection` represents legacy audio links:

- `id`
- `fromModuleId`
- `fromPort`
- `to: { type: "module" | "bus" | "master"; id?; port? }`
- `gain`
- `enabled`

Runtime support is narrower than the type suggests:

- source must exist and be `drum`, `tonal`, or `effect`;
- source port must be `main`;
- module target must be an `effect`;
- master target is valid;
- bus target currently warns and is not runtime-supported.

### 4.4 `Patch.routes`

`Patch.routes` is the newer typed route model. It supports domains:

- `event`
- `modulation`
- `audio`
- `midi`

Route endpoints can be:

- module endpoint: `{ kind: "module"; moduleId; port }`
- bus endpoint: `{ kind: "bus"; busId; port? }`
- master endpoint: `{ kind: "master"; port? }`
- external MIDI endpoint: `{ kind: "external"; externalType: "midi"; portId?; channel? }`

Route metadata can include:

- `createdFrom`
- `parameter`
- `lane`

`metadata.parameter` is required for modulation route validity.

### 4.5 Buses

Buses are serialized as:

- `id`
- `name`
- `gain`
- `mute`

However, bus routing is not currently supported at runtime in the audio validator. This creates a schema/runtime mismatch: bus structures are available in the patch contract but not operational as actual audio buses.

### 4.6 Backward compatibility concerns

Backward compatibility depends on several bridges:

- legacy `voice` modules migrate to separate trigger + sound modules;
- legacy `patternSource` is mapped to `triggerSource`;
- typed event routes can repopulate missing `triggerSource` if exactly one event route targets a sound module;
- invalid `triggerSource` references are nulled;
- malformed connections are normalized or dropped;
- `routes` are normalized through `normalizePatchRoutes()`.

The risk is that future work could accidentally make typed routes authoritative in UI or scheduler without preserving the legacy fields that existing patches and examples still depend on.

## 5. Compiled routing graph behavior

`compileRoutingGraph()` builds a normalized, domain-aware view of patch routing. Its output includes:

- `routes`
- `warnings`
- `eventSourceBySoundId`
- `triggerTargets`
- `modulationIncomingByTarget`
- `audioConnections`

### 5.1 Where it is built/used

The compiled graph is used in several places:

- scheduler `setPatch()` compiles the patch for event source resolution;
- audio `syncRouting()` compiles typed audio routes into legacy connection records;
- routing visibility builds snapshots from compiled routes;
- migration uses normalized routes to bridge typed event routes back into `triggerSource` when needed.

### 5.2 What it includes

The graph includes:

- valid typed routes from `Patch.routes`;
- legacy event routes generated from sound `triggerSource` when there are no typed event routes;
- legacy modulation routes generated from module `modulations` maps when there are no typed modulation routes;
- legacy audio routes generated from `Patch.connections` when there are no typed audio routes.

This is a **per-domain precedence model**: if typed routes exist for one domain, legacy backfill is suppressed for that domain only.

### 5.3 What it omits

The graph does not fully model:

- VISUAL analyzer input as real route ownership;
- default voice-to-master output unless represented by explicit audio connection/route;
- DRUM auto-lane/pitch-preference logic as route metadata;
- SYNTH pitch/note transformation details as route metadata;
- runtime-valid bus audio behavior;
- smoothing/amount/depth semantics for modulation routes;
- all MIDI runtime dispatch semantics.

### 5.4 Invalid/missing modules

Typed routes are normalized and validated. Invalid typed route records are ignored with warnings. Missing source/target modules, missing buses, wrong domain endpoint types, wrong source/target module types, duplicate route IDs, modulation self-routing, and missing modulation parameters are rejected.

Legacy backfill is quieter: for example, if a sound module references a missing trigger, no legacy event route is generated.

### 5.5 Authoritative or advisory?

The compiled graph is **authoritative for route visibility and partly authoritative for scheduler event source resolution and audio sync**, but it is **not yet the single runtime authority**.

- Scheduler: graph first, legacy `triggerSource` fallback.
- Audio: graph compiles audio routes to connection records, then the older audio validator decides what can run.
- Modulation: graph is used by routing visibility and some UI source maps; runtime modulation still relies significantly on module-owned maps.
- Visual: graph does not own actual analyzer input.

## 6. Scheduler and event-source resolution

The scheduler stores `compiledRouting` and updates it in `setPatch()`.

For each sound module:

1. `resolveTrigger()` checks `compiledRouting.eventSourceBySoundId.get(sound.id)`.
2. If no compiled event source exists, it falls back to `sound.triggerSource`.
3. It looks up the corresponding trigger module.
4. If no valid/enabled trigger exists, no event is scheduled for that sound.

GEN/TRIGGER modules emit events indirectly: the scheduler creates a pattern module from the effective trigger and calls `renderWindow()` for the scheduling window. Pattern events are transformed into GRIDI trigger events:

- DRUM receives `{ kind: "drum", timeSec, velocity, lane }`.
- SYNTH receives `{ kind: "note", timeSec, velocity, notes }`.

### 6.1 Explicit, implicit, or hybrid?

Event routing is hybrid:

- explicit if valid typed event routes exist;
- legacy-explicit if `triggerSource` is set;
- implicit in the sense that DRUM/SYNTH event interpretation is not encoded in route records, and DRUM auto-lane filtering can determine whether a generated event actually reaches a drum hit.

### 6.2 Missing or ambiguous connections

- Missing trigger source: sound does not play from scheduler events.
- Missing typed event source module: route is ignored and warning emitted by graph normalization.
- Multiple typed event routes to one sound: `eventSourceBySoundId` stores the first source for scheduler resolution, while `triggerTargets` can list outgoing targets. This should be treated as fragile because multi-event-input semantics are not clearly defined for one sound module.
- Typed route precedence can suppress legacy event fields for the whole event domain. A patch with one typed event route may stop backfilling legacy event routes for other sound modules unless equivalent typed routes exist.

## 7. GEN → DRUM/SYNTH routing

### 7.1 Current behavior

A GEN/TRIGGER module routes to DRUM/SYNTH through event routes or `triggerSource`. The scheduler renders the trigger pattern separately per sound stream and calls `engine.triggerVoice(sound.id, patch, eventTimeSec, voiceEvent)`.

### 7.2 DRUM handling

DRUM events use:

- event velocity from pattern event value;
- lane derived from `targetLane` by `laneRoleFromPatternEvent()`;
- optional explicit channel filtering through `drumChannel`;
- optional auto lane filtering when multiple drums share a trigger.

If a DRUM has an explicit channel (`01`–`08`), scheduler uses a stream ID based on trigger + channel and filters events by the lane implied by that channel. If no explicit channel is set and multiple drums share a trigger, the scheduler can filter by a preferred lane derived from `basePitch`.

### 7.3 SYNTH handling

SYNTH events use:

- pattern value and target lane to compute tonal value;
- mode-biased tonal mapping for some modes;
- lane-aware note offset sets;
- synth reception mode (`mono` or `poly`) to choose one or up to four semantic notes.

SYNTH routing currently does not expose pitch lanes as explicit route metadata. Pitch behavior is a scheduler/event interpretation of the GEN pattern event.

### 7.4 What works reliably

- Simple GEN→DRUM and GEN→SYNTH patches work via `triggerSource`.
- Typed event routes can drive sounds when `triggerSource` is absent.
- Factory examples demonstrate simple routing with stable module IDs and `triggerSource` assignments.
- Explicit DRUM channels make shared-trigger drum splitting more predictable.
- SYNTH mono/poly reception is normalized and tested.

### 7.5 What is confusing or fragile

- `triggerSource` is still the user-facing edit path, while `Patch.routes` can override it by domain.
- DRUM lane/channel mapping is behaviorally important but not represented as route metadata.
- Multiple typed event routes to the same sound are not clearly defined as mix, priority, merge, or invalid.
- SYNTH pitch routing is implicit and may be hard to understand from the Routing tab.
- Event domain typed-route precedence can accidentally silence legacy `triggerSource` routes if partial typed routes are introduced.

## 8. DRUM lane/channel semantics

### 8.1 Lane identity

The event lane roles are:

- `low`
- `mid`
- `high`
- `accent`

`DEFAULT_DRUM_LANE` is `mid`.

`laneRoleFromPatternEvent()` maps `targetLane` modulo 4:

- `0 -> low`
- `1 -> mid`
- `2 -> high`
- `3 -> accent`

### 8.2 Channel meaning

`drumChannel` supports:

- `auto`
- `01` through `08`

Explicit channel-to-lane mapping is:

- `01` and `05` -> `low`
- `02` and `06` -> `mid`
- `03` and `07` -> `high`
- `04` and `08` -> `accent`

Thus channels are not currently eight unique lanes. They are eight channel labels folded onto four lane roles.

### 8.3 Auto mapping

When multiple drums share one trigger and no explicit channel is selected, scheduler uses `preferredLaneForDrumModule()` to infer a lane from `basePitch`:

- lower pitch tends toward `low`;
- middle pitch tends toward `mid` or `high`;
- high pitch tends toward `accent`.

This is musically useful but hidden. It makes DRUM routing feel smart, but also makes some missing-hit behavior hard to diagnose.

### 8.4 UI exposure

DRUM main surface exposes compact `Trg` and `Chan` controls in the feature side area. The shared voice Routing tab exposes `Trig in` and `Mod in`, but it does not fully explain the channel-to-lane fold or auto lane behavior.

### 8.5 v0.4 implication

v0.4 should make DRUM lane/channel behavior more legible before changing semantics. A small explanatory UI/documentation pass is safer than introducing new lane schema or multi-output graph behavior immediately.

## 9. CONTROL modulation routing

### 9.1 Current model

CONTROL modules generate 0–1 modulation values through `sampleControl01()` and related runtime sampling helpers. They can target parameters on:

- triggers;
- drums;
- tonal/synth modules.

The target parameter catalog is currently UI-defined for `trigger`, `drum`, and `tonal` families.

### 9.2 Source/target representation

Legacy representation:

```ts
module.modulations = {
  [parameterKey]: controlModuleId,
};
```

Typed representation:

```ts
{
  domain: "modulation",
  source: { kind: "module", moduleId: controlId, port: "cv-out" },
  target: { kind: "module", moduleId: targetId, port: "cv-in" },
  metadata: { parameter: parameterKey }
}
```

### 9.3 Runtime resolution

The compiled graph builds `modulationIncomingByTarget`, but runtime paths still depend on target-owned maps:

- scheduler density modulation reads `trigger.modulations?.density`;
- DRUM pitch modulation uses incoming compiled UI state but falls back to `d.modulations?.basePitch`;
- SYNTH cutoff modulation uses incoming compiled UI state but falls back to `t.modulations?.cutoff`;
- CONTROL Routing tab edits target modules' `modulations` maps directly.

### 9.4 Timing and smoothing

Control values are sampled against current time. Modulation is active only when the transport/audio context is active in the relevant runtime/UI sampling paths. Parameter-specific application is centered around the base value for currently implemented runtime destinations.

There is no patch-level representation for modulation depth, bipolar/unipolar mode, smoothing time, curve, or destination scaling per route.

### 9.5 Missing or unclear

- Typed modulation routes are not the sole runtime authority.
- Only some parameters have runtime modulation effects today; many catalog entries are assignable but may not audibly affect runtime yet.
- There is no visible distinction between “assigned in UI” and “currently runtime-applied.”
- Route amount/depth is not represented per target parameter.
- Control-to-control and control-to-visual are accepted by typed route validation, but the current UI catalog/runtimes focus on trigger/drum/tonal targets.

## 10. VISUAL/analyzer routing

### 10.1 Analyzer expectations

The audio engine connects master output into analyzer nodes. Visual modules use engine-provided analyzer data:

- time-domain scope;
- spectrum;
- stereo scope;
- master activity.

### 10.2 Explicit or global?

VISUAL routing is global/observational today. A VISUAL module does not own an explicit input route. UI labels represent its input as `Master mix` and list sound modules as mix contributors.

### 10.3 Dependencies

VISUAL modules depend on:

- master audio signal;
- analyzer buffers;
- transport/activity state;
- visual mode (`kind`) and `fftSize`.

They do not currently consume explicit event routes or modulation routes in runtime behavior.

### 10.4 v0.4 or defer?

For v0.4, VISUAL routing should probably stay limited to truthful labeling and routing overview clarity. Explicit per-visual audio inputs, visual buses, event-driven visuals, or large visual routing systems should be deferred unless required by a narrow bug fix.

## 11. Current Routing tab behavior by module type

### 11.1 GEN / TRIGGER

Trigger Routing tab exposes:

- `Voice out` card showing outgoing voice sinks;
- a chip indicating it “Writes to voice SRC”;
- target voice chips;
- `Mod in` card for incoming control modulation;
- target modulation assignment UI for trigger parameters.

Trigger main surface also includes a routing chip that can open a floating selector to connect/disconnect sound targets by writing the target sound module's `triggerSource`.

### 11.2 DRUM

DRUM uses the shared voice Routing tab:

- `Trig in` card with trigger source selector;
- small route map (`← source` or no feed);
- `Mod in` card listing incoming modulation lanes;
- modulation selectors for controllable drum parameters.

DRUM main feature side also shows compact `Trg` and `Chan` controls, with `Chan` controlling `drumChannel`.

### 11.3 SYNTH / TONAL

SYNTH uses the same shared voice Routing tab as DRUM:

- `Trig in` source selector;
- `Mod in` list and modulation assignment selectors.

SYNTH main feature side also has:

- `Trg` source selector;
- `Recv` selector for `mono` / `poly` reception.

### 11.4 CONTROL

CONTROL Routing tab exposes:

- target module selector;
- target parameter group selector;
- checkbox list for parameters;
- target list showing current controlled destinations.

CONTROL currently has only `Main` and `Routing` tabs, not the full `Main | Fine-tune | Routing` sequence used by GEN/DRUM/SYNTH. This should be reviewed against the current global tab grammar before v0.4 implementation work, but not changed in this audit.

### 11.5 VISUAL

VISUAL Routing tab exposes:

- `Input` card labeled with `Master mix`;
- summary chips for input and mix contributors;
- contributor chips for sound modules.

VISUAL currently has only `Main` and `Routing` tabs. Its source selection on the main surface is also limited to master mix.

### 11.6 Other module types

`effect`, `terminal`, and other legacy/placeholder module types are present in the patch type surface, but effect modules are not a primary faceplate family in the current audited UI. Audio routing validation supports `effect` as an audio-processing target and as an audio source, but v0.4 should avoid expanding effect/mixer concepts into DAW-like behavior.

## 12. What already works

- Patch schema can serialize modules, buses, legacy connections, and optional typed routes.
- Migration protects old voice/pattern-source patches and normalizes modern sound/trigger/control/visual modules.
- `compileRoutingGraph()` provides a unified route snapshot with warnings and domain precedence.
- Scheduler can resolve typed event routes even when `triggerSource` is absent.
- Legacy `triggerSource` remains reliable for common GEN→DRUM/SYNTH usage.
- DRUM explicit channels and auto lane preference produce musical splitting behavior for shared triggers.
- SYNTH mono/poly reception has clear runtime behavior.
- Routing visibility can show event/modulation/audio/MIDI domains in the global overview.
- Per-module Routing tabs expose useful compact routing controls without a large graph editor.
- Factory examples are small and rely on stable IDs and simple GEN→voice routing.

## 13. Missing, confusing, or fragile areas

### 13.1 Architecture issues

- Routing authority is split between module fields, `Patch.connections`, optional `Patch.routes`, graph compilation, scheduler logic, and audio validation.
- Typed routes are canonical per domain only when valid typed routes exist, which can create partial-domain surprises.
- The compiled graph is not uniformly authoritative across event/audio/modulation/visual.
- Default voice-to-master output is runtime behavior but not explicit in route overview.
- Bus types exist but runtime support is absent.
- MIDI appears as a typed routing domain but is not deeply integrated into this audit's event/audio/control model.

### 13.2 Patch schema issues

- `Patch.routes` is optional and can coexist with legacy fields.
- `triggerSource` remains required for backward-compatible UI behavior.
- `modulations` maps remain target-owned while typed modulation routes also exist.
- Route metadata has `lane`, but DRUM channel/lane behavior is not actually encoded as route metadata.
- There is no schema-level migration plan for making typed routes authoritative.
- Buses are serialized without runtime support.

### 13.3 Scheduler/event issues

- Multiple event sources for one sound are not clearly defined.
- Partial typed event route adoption can suppress legacy event backfill for the entire event domain.
- DRUM auto lane filtering is hidden and can look like missed triggers.
- SYNTH note mapping is implicit and not visible as routing semantics.
- Trigger-density modulation is implemented directly from legacy `trigger.modulations?.density`, not from graph-resolved modulation.

### 13.4 UI/faceplate issues

- CONTROL and VISUAL do not currently show the full `Main | Fine-tune | Routing` tab sequence.
- Several Routing tab bodies use `routingTabScrollBody`, which conflicts with the current “no internal scrolling to modules” constraint and should be reviewed carefully in v0.4 layout planning.
- DRUM channel labels (`01`–`08`) do not explain that they map onto four lane roles.
- Global routing overview is useful but route rows do not explain typed-vs-legacy source or runtime limitations.
- VISUAL Routing tab presents “Master mix” truthfully, but there is no explicit statement that this is observational rather than patchable input routing.

### 13.5 Documentation issues

- There is no single routing architecture document before this audit.
- The hybrid contract between `triggerSource`, `modulations`, `connections`, and `routes` is not documented as a contributor-facing rule.
- DRUM lane/channel semantics need a clear reference.
- CONTROL modulation runtime coverage versus assignment coverage needs a clear reference.
- Bus runtime limitations should be called out wherever routing schema is described.

### 13.6 Testing gaps

- Good unit tests exist for graph hybrid behavior, scheduler event source resolution, patch migration, routing visibility, and factory examples.
- Missing or under-specified test areas include:
  - partial typed route domain adoption with mixed typed/legacy event routes;
  - multiple event routes into one sound;
  - typed modulation route runtime equivalence for each actually modulated parameter;
  - bus route warnings from typed audio routes;
  - visual routing truthfulness/observational behavior;
  - no browser/e2e harness for Routing tab interactions and fixed-shell overflow.

## 14. Risks before implementation

### 14.1 Breaking existing patches

Existing user patches likely rely on `triggerSource`, target-owned `modulations`, and default master output. Treating typed routes as sole authority without migration could break them.

### 14.2 Breaking factory examples

Factory examples currently use simple `triggerSource` assignments and `drumChannel` values. A route-only implementation could break the released onboarding baseline.

### 14.3 Changing event semantics

GEN→DRUM/SYNTH behavior depends on scheduler transforms, lane filtering, and note mapping. Changing route representation without preserving these semantics could change musical output.

### 14.4 Confusing GEN → DRUM/SYNTH behavior

DRUM channels, auto lanes, and SYNTH pitch derivation are already dense concepts. A v0.4 UI that adds graph language without explaining lane/pitch behavior could make routing less understandable.

### 14.5 Overbuilding DAW-like routing UI

A large mixer/graph/timeline would conflict with GRIDI's identity. Routing should feel like instrument patching in fixed shells, not a DAW mixer or arrangement view.

### 14.6 Schema migration risk

Changing patch schema requires a migration plan, fixtures, release notes, and compatibility tests. v0.4 should avoid schema changes unless a narrow, justified migration is unavoidable.

### 14.7 Test coverage gaps

No browser/e2e harness exists, so UI routing regressions are mostly tested indirectly. This raises risk for fixed-shell layout, mobile overflow, and interactive routing changes.

### 14.8 Mobile/fixed-shell constraints

Routing UI can easily become form-heavy. Adding rows, graphs, or inspectors could violate fixed module shells, tab grammar, and no-internal-scroll constraints.

## 15. Recommended v0.4 Routing consolidation scope

A practical v0.4 scope should include:

1. **Document and stabilize the current hybrid contract**
   - Treat legacy fields as compatibility-critical.
   - Document typed route precedence per domain.

2. **Improve validation visibility without changing behavior**
   - Surface graph/audio warnings consistently.
   - Make bus limitations explicit.

3. **Clarify event/audio/control routing distinctions**
   - Use consistent labels in docs and UI copy.
   - Avoid introducing mixer/timeline metaphors.

4. **Clarify DRUM channel/lane behavior**
   - Explain `auto`, channels `01`–`08`, and lane roles.
   - Preserve current behavior while improving visibility.

5. **Clarify CONTROL modulation authority**
   - Distinguish assignment visibility from runtime-applied modulation.
   - Add tests for current runtime-applied parameters before changing representation.

6. **Keep global routing overview compact**
   - A graph overlay may be explored later, but v0.4 should start with chips, summaries, warnings, and narrow per-module improvements.

7. **Protect factory examples and patch compatibility**
   - Add fixtures/tests before changing route writes.

## 16. Explicit deferrals

Defer the following out of the initial v0.4 routing consolidation work:

- full graph editor;
- DAW-style mixer, timeline, arrangement, piano-roll, or automation-lane UI;
- major patch schema redesign;
- route-only migration that removes or stops maintaining `triggerSource` / `modulations` compatibility;
- advanced bus/mixer concepts;
- full external audio/MIDI interop beyond the current MIDI input routing foundation;
- per-visual arbitrary input routing or large visual routing systems;
- multi-output module semantics requiring schema changes;
- effect-rack/mixer expansion unless it stays narrowly instrument-like and compatibility-preserving.

## 17. Next 5 small implementation passes

Each pass should be a separate, reviewable PR.

### Pass 1 — Routing contract documentation and fixtures

- **Goal:** Turn this audit into contributor-facing routing contract documentation and add fixture coverage for the released baseline.
- **Files likely involved:** `docs/architecture.md` or a new `docs/routing.md`; `tests/*routing*.test.mjs`; possibly test fixtures under `tests/fixtures/` if introduced.
- **Expected behavior change:** None.
- **Tests to add/update:** Snapshot/fixture tests for default patch and factory examples proving `triggerSource`, `drumChannel`, `routes`, `connections`, and migration outputs remain stable.
- **Risks:** Over-documenting future behavior as current behavior.
- **What not to touch:** Runtime source, schema shape, UI components.

### Pass 2 — Routing warnings visibility audit/cleanup

- **Goal:** Make existing graph/audio warnings easier to inspect in development without changing routing behavior.
- **Files likely involved:** `src/routingGraph.ts`, `src/engine/audio.ts`, `src/ui/header/routingOverviewPanel.ts`, tests for warning cases.
- **Expected behavior change:** At most clearer warning display/copy; no routing semantics change.
- **Tests to add/update:** Invalid typed route warnings, bus target warning, duplicate route ID warning.
- **Risks:** Warning surfacing could alarm users if copy is too technical.
- **What not to touch:** Route execution semantics, schema version, factory examples.

### Pass 3 — DRUM lane/channel clarity

- **Goal:** Explain existing DRUM lane/channel mapping in docs and small UI copy/chips.
- **Files likely involved:** `docs/module-types.md`, `docs/routing.md` if created, `src/ui/voiceModule.ts`, `tests/schedulerPatternSource.test.mjs`.
- **Expected behavior change:** Clearer labels/tooltips only; no event scheduling changes.
- **Tests to add/update:** Tests asserting current channel-to-lane mapping and auto-lane filtering remain stable.
- **Risks:** UI copy could exceed fixed-shell space.
- **What not to touch:** `drumChannel` schema, lane mapping behavior, audio engine.

### Pass 4 — CONTROL modulation runtime parity map

- **Goal:** Create a tested matrix of assignable parameters versus runtime-applied parameters, then fill only narrow gaps if explicitly approved.
- **Files likely involved:** `src/ui/controlTargetCatalog.ts`, `src/engine/audio.ts`, `src/engine/scheduler.ts`, docs/tests.
- **Expected behavior change:** First PR should be documentation/tests only; follow-up runtime changes should be one parameter at a time.
- **Tests to add/update:** Parameter assignment visibility tests and runtime modulation tests for density, drum pitch, synth cutoff, and any newly supported target.
- **Risks:** Making all catalog parameters runtime-active at once would be too broad.
- **What not to touch:** Patch schema, route domain model, large control redesign.

### Pass 5 — Typed route parity hardening

- **Goal:** Make typed routes and legacy fields safer to coexist, especially partial-domain cases.
- **Files likely involved:** `src/routingGraph.ts`, `src/patch.ts`, `tests/routingGraphHybrid.test.mjs`, `tests/patchMigrationRouting.test.mjs`, `tests/schedulerPatternSource.test.mjs`.
- **Expected behavior change:** Ideally none at first; add tests documenting current precedence, then consider small compatibility improvements if needed.
- **Tests to add/update:** Mixed typed/legacy event route cases, multiple routes to one sound, typed modulation route fallback behavior, typed audio bus warning behavior.
- **Risks:** Small precedence changes can alter playback.
- **What not to touch:** Schema version, global graph editor, factory examples unless adding tests.

## 18. Testing recommendations

Before implementation PRs:

- Keep running `npm test` for the full unit suite.
- Add routing fixture tests for factory examples.
- Add explicit tests for `compileRoutingGraph()` warnings and per-domain precedence.
- Add scheduler tests for:
  - missing trigger;
  - typed route with absent `triggerSource`;
  - partial typed route domain;
  - multiple event sources to one target;
  - DRUM channel/lane filtering.
- Add modulation tests for actual runtime-applied destinations, not only UI assignment.
- Add routing visibility tests for VISUAL “Master mix” observational behavior.
- Add browser/e2e coverage when available for:
  - Routing tab fixed-shell fit;
  - no internal module scrolling regressions;
  - global routing overview filtering and inspection;
  - mobile/short-height routing panels.

## 19. Open questions

1. Should typed `Patch.routes` eventually become the canonical saved routing model, or remain an overlay for visibility/interoperability?
2. If typed routes become canonical, what exact migration preserves `triggerSource` and `modulations` for older releases?
3. Should a sound module accept multiple event sources, or should multiple event inputs be invalid/first-wins/merge-explicit?
4. Should DRUM channels stay eight labels folded onto four lanes, or should future multi-output semantics introduce more distinct lane/channel identities?
5. Should route metadata eventually carry DRUM lane filters or SYNTH pitch mapping hints?
6. Should CONTROL modulation routes include per-route amount/depth/smoothing, and if so can that be added without a broad schema redesign?
7. Should VISUAL modules ever route from a selected bus/voice, or should v0.4 keep visuals as master-observing modules?
8. How should bus serialization be explained while runtime bus routing remains unsupported?
9. Can the Routing tabs satisfy the no-internal-scroll fixed-shell rule with current density, especially on mobile?
10. What is the smallest global routing overlay that feels like instrument patching rather than a DAW graph editor?
