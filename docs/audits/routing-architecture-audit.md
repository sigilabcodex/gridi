# Routing Architecture Audit (Deep Technical Review)

Date: 2026-04-17  
Scope: Repository-wide audit of current routing / patching / signal-flow state (no routing implementation changes)

---

## 1) Executive overview

### What is true today (canonical reality)

1. **Trigger-to-sound event routing is voice-owned in persisted patch state**, via `triggerSource` on each `drum`/`tonal` module. Trigger modules do not own persistent `targets[]`.  
2. **UI already exposes trigger-side routing controls** (GEN `ROUT` chip + Routing tab), but those controls are currently **editing voice-owned `triggerSource` fields**, not trigger-owned route state.  
3. **Control modulation routing is also patch-owned but sparse/typed only by convention**: `modulations?: Record<string,string>` exists on sound and trigger modules, but parameter keys are open-ended strings and current engine/runtime only consumes a narrow subset.  
4. **Audio routing (`connections[]`, `buses[]`) is present in the patch schema and validated, but runtime support is intentionally partial**: bus targets are dropped at runtime with warnings; only module→module (effect) and module→master links are active.  
5. **Scheduler event flow is decoupled from `connections[]`** and still resolves trigger linkage by scanning `sound.triggerSource`. This creates two routing worlds: event routing (trigger linkage) and audio routing (connection graph).

### Strategic conclusion

GRIDI already has enough primitives to stage a robust routing architecture **without restarting from scratch**, but it currently lacks a unified, typed routing layer that can express:
- role/lane-aware trigger delivery (GEN→DRUM roles),
- mono/poly and note-stream semantics (GEN→SYNTH),
- coherent editing at both module and global levels,
- future MIDI/audio/interoperability routing,
- style-profile policies that bias generation/routing behavior.

A **hybrid migration** (introduce canonical typed route records while temporarily mirroring existing `triggerSource`/`modulations`) is the safest path.

---

## 2) Repo / architecture reading summary

The audit included the required docs and code paths, plus adjacent files that define practical routing behavior.

### Documentation reviewed

- Project framing, maturity, roadmap, and status: `README.md`, `ROADMAP.md`, `docs/status.md`.
- Core architecture docs: `docs/architecture.md`, `docs/architecture/overview.md`, `docs/architecture/sound-modules.md`, `docs/architecture/trigger-modes.md`.
- UI constraints and shell grammar: `docs/ui-principles.md`, `docs/faceplate-architecture-v1.md`, `docs/module-shell-stability-and-tab-policy.md`, `docs/module-family-surfaces.md`, `docs/module-types.md`.
- Routing-specific diagnosis/spec context: `docs/routing-ownership-diagnosis.md`, `docs/rfcs/routing-foundations.md`, plus roadmap notes in `docs/roadmap-instrument-state.md`.

### Implementation reviewed

- Patch model and migration: `src/patch.ts`.
- Runtime scheduling and event delivery: `src/engine/scheduler.ts`, `src/engine/pattern/module.ts`, `src/engine/control.ts`.
- Runtime audio graph and routing: `src/engine/audio.ts`, `src/engine/routing.ts`, `src/engine/audioModule.ts`, `src/engine/effects.ts`.
- UI orchestration and topology sync boundaries: `src/ui/app.ts`.
- UI routing surfaces and projections: `src/ui/routingVisibility.ts`, `src/ui/triggerModule.ts`, `src/ui/voiceModule.ts`, `src/ui/controlModule.ts`, `src/ui/visualModule.ts`, `src/ui/render/moduleGrid.ts`, `src/ui/header/transportHeader.ts`.
- Versioning sources: `src/version.ts`, `package.json`, `vite.config.ts`, plus docs references.
- Validation tests touching routing/migration/scheduler: `tests/patchMigrationRouting.test.mjs`, `tests/schedulerPatternSource.test.mjs`, `tests/triggerModesBehavior.test.mjs`, `tests/helpers.mjs`.

---

## 3) Current routing / patching reality

## 3.1 Patch schema: what is persisted

`Patch` currently persists three routing-relevant structures:

1. **Event trigger linkage (voice-owned)**
   - On each sound module: `triggerSource: string | null`.
   - This is normalized/migrated and treated as canonical for trigger→voice assignment.

2. **Modulation linkage (parameter→control source id)**
   - On trigger and sound modules: `modulations?: Partial<Record<string,string>>`.
   - Semantically a sparse parameter map, but key-space is not strongly typed per module family.

3. **Audio graph scaffolding**
   - `connections[]` directed links (`fromModuleId`, `fromPort`, `to`, `gain`, `enabled`).
   - `buses[]` metadata (`id`, `name`, `gain`, `mute`).

`migratePatch` and normalization logic clean malformed data and legacy shapes; importantly, legacy `voice.patternSource` is migrated into the new voice-owned `triggerSource` form.

## 3.2 Canonical vs transitional vs legacy

### Canonical (in behavior today)
- `sound.triggerSource` as event-route source-of-truth.
- `module.modulations` maps as modulation-route source-of-truth.
- `connections[]` for partial audio-route source-of-truth (within currently supported targets).

### Transitional / duplicated
- Trigger-side routing UI (ROUT chip, trigger routing panel) appears trigger-owned but writes voice-owned fields.
- Routing snapshot projections (`triggerTargets`, `voiceIncoming`, `controlTargets`, etc.) are rebuilt from patch modules every rerender and are read-model only.

### Legacy remnants
- Legacy `type: "voice"` migration path still present and tested.
- Legacy short mode aliases (`step`, `euclid`, `ca`) are still relevant through migrations/tests, while normalized trigger modes are long-form names.

## 3.3 Ownership boundaries (UI vs patch vs runtime)

- **Patch-owned canonical relationship data**: `triggerSource`, `modulations`, `connections`, `buses`.
- **UI-owned derived relationship views**: `RoutingSnapshot` maps and visual chips/tables.
- **Runtime-owned executable graph state**:
  - scheduler uses `triggerSource` + pattern generation to schedule events,
  - audio engine caches validated `connections` as `activeConnections`, instantiates effect module nodes, and resolves per-trigger voice output destinations.

---

## 4) Current UI affordances and existing hooks

Existing affordances are substantial and should be leveraged.

## 4.1 Trigger-side affordances

- **ROUT chip on trigger MAIN face** with floating selection panel listing target sound modules.
- **Trigger Routing tab** with “Voice out” sink chips and density modulation source picker.
- **Trigger-side route edits currently mutate target voice `triggerSource`**, so user mental model already accepts editing routes from source modules.

## 4.2 Voice-side affordances

- **Voice Routing tab** with trigger source dropdown (`Trig in`) and modulation section.
- Drum/synth faces also include compact trigger-route indicators/readouts.
- Voice routing controls allow direct source selection (`triggerSource`) and limited modulation assignment.

## 4.3 Control module affordances

- Control Routing tab lists current targets from derived routing snapshot.
- Works as a routing status surface but not a comprehensive route editor.

## 4.4 Visual module affordances

- Visual routing summaries exist, but current source model is effectively “master mix + all sound contributors” in snapshot logic, not explicit patch-level visual input routes.

## 4.5 Global/workspace affordances

- `moduleGrid` supports connection-aware highlighting (`routingInspect`, `routingLinked`) via `getConnectedModuleIds`.
- Transport/header has utility density and floating-panel mechanics that could host a compact global routing launcher, but no global route map/editor exists yet.

---

## 5) Current engine/runtime signal-flow observations

## 5.1 Event signal flow (scheduler domain)

1. Scheduler iterates sound modules.
2. For each sound module, it resolves trigger by `sound.triggerSource`.
3. Pattern module renders event window for `(trigger, voiceId)`.
4. Scheduler dedupes by last scheduled beat and calls `engine.triggerVoice(sound.id, ...)`.

Implications:
- Event routing is strictly one trigger source per sound module (0..1 inbound trigger).
- No typed lane-role delivery at scheduler boundary yet, although pattern events already include `targetLane` metadata.
- Tonal event values are reduced to a single normalized scalar (`incomingValue`) per event.

## 5.2 Pattern event richness vs runtime consumption

Pattern layer already emits:
- `value` (normalized event intensity/value),
- optional `targetLane` (0..3 style lane index from mode logic).

Runtime currently consumes:
- For drums: effectively trigger timing (+ optional modulation on basePitch).
- For synth: one mapped scalar influencing pitch offset per event.

So there is latent capacity for GEN-as-drummer lane semantics, but it is not wired into typed routing contracts.

## 5.3 Audio signal flow (engine routing domain)

- `syncRouting(patch)` creates/disposes effect module instances and validates `connections`.
- Valid active links currently support:
  - audio source modules (`drum`, `tonal`, `effect`) as sources,
  - `effect` modules as module targets,
  - `master` as terminal target.
- `bus` targets are explicitly warned and not executed.
- Voice audio destinations are resolved per trigger call from `activeConnections`; fallback is direct-to-master.

## 5.4 Topology change detection and sync boundaries

UI app uses topology signatures to decide when to call `engine.syncRouting` during patch mutations.

Detected as topology changes:
- connection identity/enabled/src/dst/ports,
- effect module id/type/kind,
- overall module id/type set.

Not treated as topology changes:
- connection gain changes,
- effect bypass/gain parameter changes.

This is acceptable for pure topology but creates an update gap for some route-relevant parameter edits unless triggered elsewhere.

---

## 6) Gaps and contradictions (docs vs implementation)

## 6.1 Docs say “patch is source of truth for routing” — true, but split into two separate systems

- Event routing (`triggerSource`) and audio routing (`connections`) are both patch-owned but not unified by a single typed routing model.
- Result: contributors can misread “routing” as one subsystem while behavior is currently split.

## 6.2 Trigger ownership language can mislead

- Multiple docs/UI affordances present trigger-side editing strongly.
- Actual ownership remains voice-side, as explicitly diagnosed in `docs/routing-ownership-diagnosis.md` and confirmed by code.

## 6.3 Tab naming and architecture language mismatch still partially present

- Architecture prefers Main/Routing/Advanced, while implementation internals still include `SETTINGS` ids and mixed naming in places.

## 6.4 Sound module docs imply tonal extensibility, but runtime is still single-event monophonic

- Current tonal trigger path creates a fresh ephemeral voice per event; there is no explicit configurable mono/poly mode or voice-allocation policy abstraction.
- This will matter for GEN→SYNTH multi-note goals.

## 6.5 Audio routing docs mention foundations with buses, but runtime bus path is not yet executable

- Patch and validation accept buses structurally, but runtime intentionally does not process bus targets.

---

## 7) Feasibility of future routing goals

## 7.1 GEN → DRUM (single-lane/role receivers): **High feasibility with staged typing**

Why feasible now:
- Pattern events already include `targetLane`.
- Existing one-source-per-voice model aligns with “drum module as focused receiver.”
- UI has source-side and target-side route editing affordances.

What is missing:
- Typed lane/role route contracts (e.g., `lane=low|mid|high|accent`).
- Receiver-side filtering/mapping policy in scheduler/voice trigger logic.
- Patch-level route entries that can represent lane constraints without overloading `triggerSource`.

## 7.2 GEN → SYNTH mono/poly and multi-note reception: **Moderate feasibility, requires runtime policy layer**

Why partially feasible:
- Scheduler can emit frequent events and currently passes a scalar value.
- Synth runtime already instantiates per-event oscillators (so poly-like overlap can happen accidentally), but no explicit voice management model exists.

Needed additions:
- Typed melodic event payload (pitch class/interval/note list, gate/velocity semantics).
- Synth module policy (`mono`, `poly`, `maxVoices`, `stealPolicy`, `chordHandling`).
- Route typing so GEN can signal whether it is sending per-lane notes vs shared stream.

## 7.3 Global routing overview and editing: **High feasibility if scope is constrained**

Existing building blocks:
- Routing snapshot already computes connected relationships.
- Workspace inspect highlighting exists.
- Header/floating panel infra can host global entry point.

Need:
- Canonical route index structure (not only ad-hoc derived maps).
- Read-only global map first, then edit actions with strong constraints.

## 7.4 Trigger, modulation, future audio routing, external MIDI, Ardour/Linux integration: **Feasible but must be layered**

Critical prerequisite:
- Unified typed route model spanning event/control/audio domains.

Without that, adding MIDI/audio interop risks exploding one-off adapters and DAW-like complexity.

## 7.5 Style profile layer (Musical / Experimental): **Best introduced as policy context, not route type**

Best fit location:
- Patch-level or session-level profile config that biases defaults/ranges/randomization and optional route suggestion heuristics.

Should not be:
- Another routing graph type,
- Separate UI product mode,
- Hard fork of module surfaces.

---

## 8) Recommendations for architecture direction

## 8.1 Introduce a unified typed route model (additive first)

Add a canonical `routes[]` model (or equivalent) with explicit domain typing:

- `domain: "event" | "modulation" | "audio" | "midi"` (midi can be placeholder now)
- `source: { moduleId, port, lane? }`
- `target: { moduleId|bus|master|external, port, laneRole?, parameter?, notePolicy? }`
- `policy` fields per domain (gain, transform, filter, quantize, etc.)

Do not immediately remove `triggerSource`/`modulations`.

## 8.2 Build a routing resolver layer used by both UI and runtime

Create a central resolver that:
- normalizes legacy and hybrid inputs,
- provides fast indexed views for scheduler and engine,
- becomes the only place that interprets route typing.

Then:
- scheduler consumes resolved event routes (instead of direct `triggerSource` lookups),
- modulation sampler consumes resolved modulation routes,
- audio engine consumes resolved audio routes.

## 8.3 Preserve instrument-first constraints in routing UX

- Keep module MAIN tabs playable and uncluttered.
- Keep route editing secondary (Routing tab, chips, compact panels).
- Add global route overview as a utility surface, not full DAW patchbay by default.
- Favor constrained templates/role assignments over free-form cable spaghetti.

## 8.4 Stage GEN lane-role semantics explicitly

For event routes from trigger to drum/synth targets, introduce typed role metadata:
- `laneRole: low|mid|high|accent|all` (initial set),
- optional transforms (density gate, min velocity, lane mask).

This lets one GEN drive many drum voices without introducing multi-lane drum complexity.

## 8.5 Add synth reception policy object before expanding GEN note semantics

Per synth module:
- `reception.mode: mono|poly`,
- `reception.maxVoices`, `reception.steal`, `reception.chordMode` (future).

Then let event routes target these semantics safely.

## 8.6 Style profile integration point

Add session-level profile config (e.g., `profile: "musical"|"experimental"`) that affects:
- default module params,
- randomization ranges in header actions,
- route suggestion defaults (e.g., conservative vs exploratory lane mappings),
- modulation depth caps.

Keep this as policy overlay, not route ownership mechanism.

---

## 9) Phased implementation roadmap

## Phase 0 — Audit alignment / no behavior break

- Consolidate docs language around current dual routing systems.
- Add explicit “event routing is voice-owned today” note in architecture docs.
- Add route-domain terminology glossary.

## Phase 1 — Resolver and typed model scaffolding (hybrid)

- Add new typed route schema (behind migration).
- Keep writing/reading `triggerSource` + `modulations` for compatibility.
- Build resolver that emits indexed views for existing code paths.
- Add tests for resolver parity with current behavior.

## Phase 2 — Runtime adoption (internal, behavior-preserving)

- Scheduler switches to resolver-provided event route index.
- Modulation reads switch to resolver index.
- Audio routing reads switch to resolver index (still limited supported targets).
- Keep legacy fields mirrored until confidence threshold reached.

## Phase 3 — UI migration (still constrained)

- Update routing snapshot generation to use resolver output.
- Add global routing overview (read-first) accessible from header utility.
- Keep module-level ROUT chip and Routing tab workflows.

## Phase 4 — Domain expansion

- Implement bus runtime path.
- Add typed lane-role mappings for GEN→DRUM.
- Add synth mono/poly reception policy.
- Start external MIDI route domain integration.

## Phase 5 — Legacy cleanup

- Deprecate direct `triggerSource` canonical usage once migration stable.
- Remove duplicated route derivation logic and stale adapters.

---

## 10) Risks / anti-patterns / what NOT to do

## 10.1 High-risk migration mistakes

1. **Hard-cut from voice-owned to trigger-owned without hybrid period** → likely breakage across scheduler, UI chips, migration tests.
2. **Mixing event/mod/audio migration in one large PR** → hard-to-debug regressions and subtle timing faults.
3. **Treating routing snapshot as canonical** → recreates current ambiguity at a larger scale.

## 10.2 Performance and complexity risks

- Recomputing heavy route projections on every tiny UI mutation can become expensive as module count grows.
- Global graph UI with unconstrained free-cable editing invites DAW drift and interaction overload.
- Untyped modulation keys (`Record<string,string>`) can silently accumulate stale mappings.

## 10.3 UI/product identity risks (DAW drift)

Avoid:
- giant always-open routing matrix panel,
- mixer-first routing pages dominating instrument surfaces,
- unconstrained graph editing that bypasses module-family grammar.

Prefer:
- compact, task-scoped route editing,
- fixed-shell compatible overlays,
- role-based routes and defaults.

---

## 11) Versioning audit and recommendations

## 11.1 Where version is declared and displayed today

- **Primary declared app version**: `package.json` (`"version": "0.32.4"`).
- **Runtime injected app version/build metadata**: Vite `define` constants in `vite.config.ts` (`__APP_VERSION__`, `__APP_BUILD__`, `__APP_BRANCH__`, `__APP_DIRTY__`).
- **UI-facing version text source**: `src/version.ts` utility functions consumed by header tooltip (`getVersionTooltipText`).
- **Docs also manually reference versions** in `README.md`, `ROADMAP.md`, `docs/status.md` and can drift.

## 11.2 Current mismatch

- Code/package state appears active and architecture-rich, but roadmap/docs still frame phase names that can read stale relative to implementation maturity.
- Version references are duplicated across docs and not centrally generated, so they naturally diverge.
- There is no explicit milestone tagging policy connecting semantic version changes to architectural milestones vs minor UI changes.

## 11.3 Recommended versioning policy

1. **Single source of truth remains `package.json` semver**.
2. **Treat docs as derived narrative**, not authoritative version source; minimize hard-coded version literals in docs.
3. Adopt explicit pre-1.0 rules:
   - patch (`0.x.y`) for fixes/compat/no architecture contract changes,
   - minor (`0.y.0`) for architecture-contract or routing-model milestones.
4. Add a lightweight `docs/releases.md` (or changelog) mapping version → milestone intent.
5. Optionally inject current app version into key docs/status views during CI/doc generation to reduce manual drift.

---

## 12) Concrete next prompt recommendations for future coding agents

## Best next coding prompt (recommended)

> **Implement a non-breaking routing resolver layer and parity tests.**  
> Add `src/engine/routeResolver.ts` (or similar) that builds typed route indexes from current patch fields (`triggerSource`, `modulations`, `connections`).  
> Refactor scheduler and modulation consumers to use resolver outputs without changing behavior.  
> Add tests proving parity with existing routing behavior.

Why first:
- maximum architectural leverage,
- minimal UX churn,
- prepares all later routing work,
- lowest regression risk if done with parity tests.

## Safest first implementation slice

1. Add resolver that returns:
   - `eventRoutesByTargetVoice`,
   - `eventTargetsByTrigger`,
   - `modTargetsByControl`,
   - `audioRoutesBySource`.
2. Switch **scheduler trigger resolution only** to resolver output.
3. Keep UI unchanged.
4. Add tests for:
   - existing `triggerSource` behavior parity,
   - missing trigger no-op parity,
   - no duplicate schedule regressions.

This slice is safely incremental and unlocks staged route typing next.

---

## Appendix A — Key contradictions to keep in future prompts

1. **Do not claim trigger-owned routing is canonical today**; it is not.
2. **Do not claim buses are runtime-routable today**; they are not.
3. **Do not claim synth poly policy exists**; it does not (yet).
4. **Do not implement global routing UI before resolver/canonical model**; that would harden transitional assumptions.

---

## Appendix B — High-value files likely affected in routing implementation phase

- Patch/data model: `src/patch.ts`
- Resolver + runtime: `src/engine/scheduler.ts`, `src/engine/audio.ts`, `src/engine/routing.ts`, new resolver file(s)
- UI projections/editors: `src/ui/routingVisibility.ts`, `src/ui/triggerModule.ts`, `src/ui/voiceModule.ts`, `src/ui/controlModule.ts`, `src/ui/render/moduleGrid.ts`, optional `src/ui/header/transportHeader.ts`
- Migration/tests: routing + scheduler tests under `tests/`

