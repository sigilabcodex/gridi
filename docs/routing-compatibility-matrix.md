# Routing compatibility matrix

This document records the current v0.4 typed/legacy routing compatibility contract as executable characterization, not as a migration plan.

Reference test suite: `tests/routingParityMatrix.test.mjs`.

## Scope

- `Patch.routes` remains an optional typed overlay.
- Legacy `triggerSource`, `modulations`, and `connections` remain supported.
- `compileRoutingGraph()` is a normalizer/read model. It is not the sole runtime authority.
- No patch schema version change is implied by this matrix.
- The confirmed stale-reference cleanup only removes references whose module or bus endpoint no longer exists. It does not migrate valid legacy routing into typed routes.

## Current matrix

| Case | Accepted patch representation | Compiled graph representation | Actual runtime authority | Precedence / merge behavior | Inspector-visible behavior | Known ambiguity or incompatibility |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Legacy event only | Sound module has `triggerSource` pointing to a trigger module. | Backfilled event route with `metadata.createdFrom: "legacy-triggerSource"`; `eventSourceBySoundId` maps sound to trigger. | Scheduler resolves compiled event source, with `triggerSource` fallback also available. | Legacy is used when there are no valid typed event routes. | Shows trigger-to-sound route. | None for simple GEN-to-sound patches. |
| 2. Typed event only | `Patch.routes[]` has an enabled `domain: "event"` trigger-module to sound-module route; sound may have `triggerSource: null`. | Typed event route appears directly; `eventSourceBySoundId` maps sound to route source. | Scheduler resolves the compiled typed route. | Typed route works without legacy `triggerSource`. | Shows typed trigger-to-sound route. | Patch migration may backfill `triggerSource` in some import paths for compatibility, but runtime does not require it here. |
| 3. Legacy and typed event on same sound | Sound has `triggerSource`; `Patch.routes[]` also has a valid typed event route for that sound. | Typed event route is compiled; legacy event backfill is suppressed for the event domain. | Scheduler uses compiled typed source first. | Typed source wins for that sound; no double-apply. | Shows typed source, not legacy source. | Compatibility depends on preserving scheduler fallback for patches without complete typed coverage. |
| 4. Partial typed adoption across domains | A patch may have a typed event route while legacy modulation and legacy audio still exist. | Typed event suppresses only legacy event backfill; legacy modulation/audio still backfill because their domains have no typed routes. | Scheduler still falls back to `triggerSource` per sound when a sound has no compiled event source; audio uses compiled audio connections; modulation runtime remains target-owned. | Precedence is per domain in the compiler, but scheduler event fallback is per sound. | Legacy-only event links can be invisible in the overview when any typed event route exists, even though scheduler fallback can still play them. | This is the clearest graph-vs-runtime divergence. Decide whether inspector should show scheduler-effective fallback or compiler-canonical routes only. |
| 5. Multiple typed event routes to one sound | Old patches may contain multiple enabled event routes targeting the same sound. Current routes without an explicit role are treated as implicit `primary` routes. | All event routes remain compiled for compatibility; `eventSourceBySoundId` still reflects existing compiler behavior for playback preservation. The new resolver reports this state as `ambiguous`. | Existing ambiguous patches preserve current playback behavior until explicit user assignment/repair. | New assignment operations replace all implicit-primary event routes for that voice with one primary assignment. No first-wins/last-wins policy is treated as the product rule. | Inspector/health can report ambiguous primary event inputs. After reassignment, inspector and scheduler agree on the new source. | Future role/lane event inputs remain planned but are not implemented. |
| 6. Multiple sources targeting same destination | Event routes may target one sound in old patches; modulation routes may target one target parameter. | Event ambiguity is now classified by `resolveVoiceEventRouting()` when multiple enabled implicit-primary typed routes target one voice. Modulation still stores first control per target parameter and warns for later conflicting sources. | Event runtime remains compatibility-preserving for old ambiguous patches; explicit reassignment normalizes that voice to one primary source. Modulation runtime still reads legacy `modulations` maps rather than typed graph. | Event assignment replacement is the product rule for new operations; modulation ownership remains separate. | Inspector follows the event resolver for ambiguous/newly assigned event input state and compiled graph for other domains. | Role-aware event inputs and modulation runtime parity remain separate future decisions. |
| 7. Legacy modulation only | Module has `modulations` map from parameter to control module ID. | Backfilled modulation route with `metadata.createdFrom: "legacy-modulations"`; incoming modulation index includes source/parameter. | Scheduler density and audio voice modulation read target module `modulations` maps. | Legacy is used when there are no valid typed modulation routes. | Shows control-to-parameter modulation. | Runtime only applies a subset of assignable parameters. |
| 8. Typed modulation only | `Patch.routes[]` has an enabled `domain: "modulation"` route with `metadata.parameter`. | Typed modulation route appears in `modulationIncomingByTarget`. | Current scheduler/audio runtime does not consume typed modulation graph for density/pitch/cutoff; it reads legacy target-owned `modulations`. | Typed route is visible but does not currently provide runtime parity for legacy modulation. | Shows typed modulation route. | Typed modulation parity is incomplete. Follow-up must decide whether to mirror typed routes into runtime resolver or keep typed modulation as visibility/interoperability only. |
| 9. Legacy and typed modulation on same parameter | Target module has legacy `modulations`; `Patch.routes[]` also has a valid typed modulation route. | Typed modulation domain suppresses all legacy modulation backfill; compiled graph shows typed source. | Runtime still reads target-owned legacy `modulations`, so legacy can drive behavior while inspector shows typed source. | Compiler typed precedence and runtime legacy authority can disagree. | Shows typed modulation source. | This is a high-priority ownership mismatch. Do not change without explicit policy because it can alter sound. |
| 10. Legacy audio only | `Patch.connections[]` contains enabled audio connection records. | Backfilled audio routes with `metadata.createdFrom: "legacy-connections"`; `audioConnections` mirrors connection-like records. | Audio engine compiles graph, then validates compiled `audioConnections` through legacy `validateConnections()`. | Legacy audio is used when there are no valid typed audio routes. | Shows audio route. | Runtime validation still constrains supported ports/targets. |
| 11. Typed audio only | `Patch.routes[]` has enabled `domain: "audio"` route to module/master/bus endpoint. | Typed audio route converts to connection-like `audioConnections` record. | Audio engine validates compiled audio connections through `validateConnections()`. | Typed route can run if legacy validator accepts the converted connection. | Shows typed audio route. | Graph acceptance and runtime acceptance can differ for buses or unsupported ports. |
| 12. Legacy and typed audio | `Patch.connections[]` and valid typed audio routes both exist. | Typed audio domain suppresses legacy audio backfill; `audioConnections` contains typed routes only. | Audio engine uses compiled typed audio connections after validation. | Typed audio wins for the entire audio domain. | Shows typed audio only. | Partial typed audio adoption can hide/disable legacy connections for the compiled/runtime audio graph. |
| 13. Missing or unsupported bus endpoints | Missing buses may be referenced by routes/connections; existing bus endpoints can also be referenced. | Missing bus typed routes are rejected with warnings and no compiled audio connection. Existing bus endpoints can compile. | Existing bus audio connections are rejected by `validateConnections()` because bus routing is not supported at runtime. | Missing endpoints are invalid; existing buses are serializable/visible but not runtime-active. | Missing endpoints appear through routing health; existing bus routes can appear as compiled audio routes. | Bus serialization exists ahead of runtime implementation. UI copy should not imply bus audio works yet. |
| 14. Compiler output vs runtime behavior | All hybrid forms above are accepted if validation permits their endpoints. | Compiler applies per-domain typed precedence and produces route indexes for visibility. | Scheduler uses compiled event source first, then `triggerSource`; modulation runtime reads legacy maps; audio runtime validates compiled audio through legacy validator. | There is no single runtime authority across all domains. | Inspector follows compiled graph, not every runtime fallback. | The next consolidation work should pick one domain at a time and preserve compatibility with explicit tests. |

## Current primary event routing rule

A voice currently has one effective event input role: `primary`. Typed event routes without an explicit role are treated as `primary`; no required role field or schema migration is introduced.

New assignment operations use replacement semantics:

- assigning GEN B to a voice previously assigned to GEN A updates legacy `triggerSource` to GEN B;
- existing implicit-primary typed event routes targeting that voice are removed;
- one typed primary event route is written for GEN B;
- disabled or stale previous primary routes do not block replacement;
- unrelated event routes to other voices are preserved.

Old patches with multiple enabled primary event routes to the same voice are detected as `ambiguous` by `resolveVoiceEventRouting()` and validation. They are not silently rewritten during load, inspection, or validation.

## Policy decisions still open

1. Should partial typed event adoption remain compiler-canonical while scheduler keeps per-sound legacy fallback, or should the inspector expose scheduler-effective fallback routes?
2. Which role/lane event inputs should be added after `primary`, and how should they interact with DRUM lanes, accents, fills, and resets?
3. Should typed modulation routes become runtime-authoritative, and if so should they mirror into legacy maps or feed a new resolver used by scheduler/audio?
4. Should typed audio routes suppress legacy audio for the whole domain, or only for destinations/sources they explicitly replace?
5. How should existing bus endpoints be presented while runtime bus routing remains unsupported?

## Recommended next step

The first safe ownership-consolidation step after this pass is to define the future event-role vocabulary in an RFC: keep `primary` as the current runtime input, then specify whether `accent`, `fill`, `reset`, or lane-specific inputs should be represented as optional route metadata, separate ports, or both. Typed modulation runtime parity remains the other high-priority consolidation path.
