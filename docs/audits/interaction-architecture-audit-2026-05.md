# GRIDI interaction-architecture audit (2026-05)

Date: 2026-05-04  
Scope: architecture and UX-state alignment audit only (no runtime/audio behavior changes in this PR).

## Files inspected

- `src/patch.ts`
- `src/ui/app.ts`
- `src/ui/triggerModule.ts`
- `src/ui/voiceModule.ts`
- `src/ui/AddModuleSlot.ts`
- `src/ui/render/moduleGrid.ts`
- `src/ui/header/transportHeader.ts`
- `src/ui/persistence/presetStore.ts`
- `src/ui/persistence/modulePresetStore.ts`
- `src/routingGraph.ts`
- `src/engine/scheduler.ts`
- `tests/routingGraphHybrid.test.mjs`
- `tests/schedulerPatternSource.test.mjs`
- `tests/presetStore.test.mjs`
- `docs/audits/routing-architecture-audit.md` (prior architecture baseline)

---

## 1) Routing

### Current model (triggerSource / voice-owned)

Current event-trigger routing remains voice-owned:

- Sound modules (`drum` / `tonal`) persist `triggerSource: string | null`.
- Trigger modules do not persist a `targets[]` list.
- Scheduler event dispatch resolves trigger relationships from sound module `triggerSource` (with canonical route compatibility/migration behavior around `routes`), preserving existing patch compatibility.
- Trigger ROUTING UI acts as a source-side editor that mutates destination voice `triggerSource` fields.

This is coherent with existing architecture and tests, but introduces a potential cognitive split:

- Source-side controls imply trigger-owned routes.
- Persisted state remains target-owned.

### GEN selector pills for sound voices

Current voice surfaces expose compact source selectors and route labels (`SRC …`) while trigger surfaces expose routing controls by source module context. This is workable, but not fully explicit to users that both views edit the same target-owned field.

### Possible mismatch: displayed selected GEN vs stored patch vs behavior

Risk is not in core scheduler correctness (tests are strong), but in **UI-state interpretation**:

- A sound module may visually show a selected source.
- A trigger routing tab may show selected followers.
- If either surface is stale before re-render/update, users can perceive mismatch even when patch state is correct.

No hard data-loss bug was identified in this pass, but this area remains the most sensitive for user trust because two UI entry points edit one field.

### Recommended small follow-up fixes

1. Add a shared helper (`getResolvedTriggerSourceLabel(moduleId)`) used by both Trigger ROUTING and Voice SRC displays to guarantee identical label derivation.
2. Add a tiny “ownership hint” copy in trigger routing UI (e.g., “Writes to target SRC”).
3. Add one focused integration test: mutate routing from Trigger panel, assert Voice SRC field and route chip reflect same state after re-render.
4. Keep current persisted shape (`triggerSource`) unchanged in this phase to preserve compatibility.

---

## 2) Session management

### New session behavior

“New Session” currently creates a new preset/session record from `defaultPatch()`.

### Is new session empty?

It is **not empty**. It is initialized from the default patch template, which includes pre-seeded modules/layout behavior rather than a blank workspace.

This is valid for onboarding/demo flow, but semantics of “New Session” can mislead users expecting an empty canvas.

### Recommendation

Split intent explicitly:

- **New Empty Session** → deterministic empty patch template (`modules: []`, baseline master/transport defaults).
- **New Example Session** (formerly “New from Starter”) → curated factory example behavior, starting with `Example 01 · Basic Pulse`.

Maintain both options so first-run friendliness is preserved while advanced users get predictable blank-state behavior.

---

## 3) Presets

### Factory preset structure and naming

Factory module presets are well-structured technically:

- Family/subtype compatibility checks exist.
- Source metadata (`factory`/`user`) and linkage metadata are tracked.
- Apply behavior preserves module identity context while updating preset identity.

Naming is currently descriptive (e.g., “Sparse Euclid”, “Deep Kick”, “Rubber Bass”). This is musically friendly but can be semantically ambiguous when users interpret names as engine/role guarantees.

### Current issue

Names like “Sparse Euclid” read like strict algorithm contracts, while in practice they are curated parameter states over an engine+mode system.

### Recommendation

Adopt dual-layer naming:

- Primary stable code: `GEN001`, `DRUM001`, `SYNTH001`, etc.
- Optional subtitle/metadata: “Sparse Euclid”, “Deep Kick”, etc.

Display style example:

- `GEN001 · Sparse Euclid`
- `DRUM004 · Deep Kick`

This improves provenance, sorting, compatibility communication, and future bank curation/versioning.

### Provenance/compatibility/application checks

Current implementation already has the right hooks:

- compatibility filtering by family/subtype,
- metadata linkback to preset IDs,
- round-trip tests for import/export and relationship preservation.

Follow-up should focus on naming and presentation, not on data model rewrite.


### Module preset bank expansion audit (2026-05-06)

This pass keeps the current flat factory list and stable code display intact while defining bank intent for future curation. Current DRUM and SYNTH factory presets are grouped as follows:

| Family | Basic / foundational | Musical / production-ready | Experimental / sound-design |
| --- | --- | --- | --- |
| DRUM | `DRUM001 · Deep Kick`, `DRUM002 · Soft Kick`, `DRUM003 · Punch Kick`, `DRUM004 · Click Kick`, `DRUM005 · Sub Kick`, `DRUM013 · Tight Snare`, `DRUM014 · Closed Hat` | `DRUM007 · Tom Like`, `DRUM008 · Snare Like`, `DRUM009 · Hat Like`, `DRUM011 · Pop Perc`, `DRUM015 · Low Conga` | `DRUM006 · Noisy Kick`, `DRUM010 · Metallic Tick`, `DRUM012 · Distorted Perc`, `DRUM016 · Dust Rim` |
| SYNTH | `SYNTH001 · Rubber Bass`, `SYNTH002 · Soft Bass`, `SYNTH003 · Bright Pluck`, `SYNTH004 · Muted Pluck`, `SYNTH005 · Lead`, `SYNTH013 · Sub Sine Bass`, `SYNTH014 · Square Lead` | `SYNTH006 · Hollow Lead`, `SYNTH008 · Airy Pad`, `SYNTH012 · Wide Stereo Tone`, `SYNTH015 · Warm Pad` | `SYNTH007 · Drone`, `SYNTH009 · Glass Tone`, `SYNTH010 · Noisy Tone`, `SYNTH011 · FM-like Tone`, `SYNTH016 · Noise Sweep` |

Small additions made in this pass:

- DRUM: `DRUM013 · Tight Snare`, `DRUM014 · Closed Hat`, `DRUM015 · Low Conga`, `DRUM016 · Dust Rim`.
- SYNTH: `SYNTH013 · Sub Sine Bass`, `SYNTH014 · Square Lead`, `SYNTH015 · Warm Pad`, `SYNTH016 · Noise Sweep`.

Remaining gaps before larger bank expansion:

- DRUM: open hat, clap, rim/cross-stick alternatives, ride/cymbal-like noise, additional tuned tom/percussion notes, and more subtle acoustic/electro production variants.
- SYNTH: acid/rez bass, mono stab, chord/key pad, bell/mallet, short noise burst, riser/fall FX, evolving texture variants, and clearer keyboard-range role coverage.
- Cross-bank metadata: bank slug, bank title, curator/artist/composer/engineer credit, license/attribution, tags, role/category, compatibility/version, and optional notes/audio-preview metadata are not yet represented in the module preset record.

Future bank model recommendation:

1. Keep a compact **Core Factory** bank as the default, stable, beginner-safe palette with strict code continuity (`DRUM###`, `SYNTH###`, etc.).
2. Split more extreme sounds into a first-party **Experimental / Sound Design** bank so adventurous material can grow without making the default list feel noisy.
3. Add **Guest-Curated** banks as immutable curated collections with visible curator identity, description, and bank-level versioning.
4. Support **artist/composer/engineer contributed banks** with contribution metadata, review status, source/license notes, and optional role tags such as `kick`, `snare`, `bass`, `lead`, `pad`, `texture`, or `fx`.
5. Prefer adding optional bank metadata around `ModulePresetRecord` rather than changing audio-engine state snapshots; keep preset application compatibility family/subtype-based.

---

## 4) Multi-select / batch actions

### Current selection model

Current module-grid interaction is primarily single-focus/inspect oriented (routing inspection, per-module interaction), without a dedicated multi-select state model.

### Recommended minimal state shape

Introduce only foundational selection state first:

```ts
selectedModuleIds: string[]
selectionAnchorId: string | null
selectionMode: "replace" | "add" | "range"
```

No batch behavior implementation yet; just canonical selection ownership + keyboard semantics.

### Future actions enabled by this state

- apply operation to selected generators,
- copy/paste compatible parameter subsets,
- duplicate selected modules,
- delete/move selected groups.

Do not wire these actions in this PR; stage selection model first.

---

## 5) Add-module menu

### Current add-slot flow

Current AddModuleSlot uses a single flat menu of mixed items (Generator/Drum/Synth/Control variants/Visual variants).

Strength: fast and compact.

Constraint: scales poorly as module families and preset banks grow.

### Recommendation: family-first navigation

Move to progressive selection:

1. Module family/type (GEN / DRUM / SYNTH / CTRL / VIS)
2. Subtype/engine (where relevant)
3. Preset

### Include search + insertion direction

- Add quick search across family/subtype/preset labels.
- Add insertion direction policy (e.g., “insert right then wrap” vs “insert below”) as an explicit setting or contextual behavior for predictable grid growth.

Keep this a UI-flow enhancement; avoid changing module runtime semantics.

---

## 6) Desktop transport bar

### Current strengths

- Rich control density: transport, audio state, session/preset operations, routing overview, status lines.
- Strong utility concentration for desktop workflows.

### Current clutter risks

- High icon/control density can reduce scan clarity.
- Session, transport, routing, and global actions compete visually in one band.

### Recommendation

Polish pass (non-breaking):

1. Rebalance zone hierarchy (primary transport > session > utilities).
2. Tighten icon/text redundancy where tooltip clarity already exists.
3. Keep mobile/global control parity unchanged (no regression of existing mobile toggle behavior).

---

## 7) Follow-up PR sequence (small, prioritized)

1. **PR-A: Session intent split**
   - Add “New Empty Session” + “New Example Session”.
   - Keep default behavior backward-compatible for existing stored sessions.

2. **PR-B: Routing label unification**
   - Shared trigger-source label resolver used by Trigger ROUTING + Voice SRC UI.
   - Add integration test for cross-surface consistency.

3. **PR-C: Preset naming schema foundation**
   - Introduce optional stable code field (`GEN###`, `DRUM###`, ...).
   - UI renders `code · subtitle` when present.

4. **PR-D: Selection state scaffold**
   - Introduce `selectedModuleIds` + keyboard-select plumbing only.
   - No batch commands yet.

5. **PR-E: Add-module IA phase 1**
   - Family-first menu with lightweight subtype step.
   - Keep presets optional until phase 2.

6. **PR-F: Desktop transport declutter pass**
   - Visual hierarchy and spacing polish; no feature removals.

7. **PR-G: Add-module IA phase 2**
   - Preset step + quick search + insertion direction preference.

---

## Any code/runtime changes made in this PR

- None.
- This PR intentionally adds only an audit document artifact.

- PR-B follow-up (implemented): shared routing label resolver now drives both Voice SRC readouts and Trigger ROUTING follower chips, with compact ownership hint in Trigger ROUTING card.

---

## 8) Selection scaffold status (2026-05-05)

Selection scaffold is now implemented as UI/session interaction state only:

- canonical selected-module ID list,
- selection anchor tracking,
- selection mode tracking (`replace` / `add` / `range`),
- visual selected-state affordance on module surfaces,
- safe clearing/pruning during empty-slot interaction and module removal.

No batch commands are wired yet in this phase.

Deferred follow-up actions remain:

- copy/paste compatible parameter subsets,
- duplicate selected modules,
- delete selected groups,
- generator operations applied only to selected modules,
- full shift-range semantics once canonical ordering rules are finalized.

---

## 9) Session manager cleanup/reset status (2026-05-06)

Factory example sessions are now treated as a recoverable local session baseline:

- `Example 01 · Basic Pulse`
- `Example 02 · Dual Generators`
- `Example 03 · Experimental Field`

Session Manager cleanup/reset behavior is intentionally explicit and data-safe:

- **Restore missing factory examples** appends any missing curated factory examples without deleting, renaming, or replacing existing local user sessions.
- **Reset to factory examples** restores exactly the curated factory example set and selects the first factory example, but only after this confirmation copy: “This will remove local saved sessions and restore the factory examples. Export anything you want to keep first.”
- Existing local sessions continue to load normally; no cleanup path deletes saved sessions on app load.
- Import/export payload shape remains unchanged so existing session and single-preset JSON files continue to round-trip through the same persistence helpers.

Follow-up recommendation: consider adding a non-destructive “Export all before reset” shortcut near the reset confirmation once session archives or backup affordances are designed.
