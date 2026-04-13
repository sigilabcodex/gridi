# Routing ownership diagnosis (GEN chip vs voice-owned state)

Date: 2026-04-13
Scope: investigation only (no routing redesign)

## Pre-change summary

1. **Where routing relationships are stored in patch state**
   - Trigger-to-voice relationships are persisted on sound modules (`drum`/`tonal`) as `triggerSource: string | null`.
   - This field is part of the normalized module schema and is validated/migrated in `patch.ts`.

2. **Ownership model (trigger target list vs voice source pointer)**
   - Current persisted ownership is **voice-owned**: each target voice points to one trigger via `triggerSource`.
   - There is no persisted `trigger.targets[]` list on trigger modules.

3. **How `routing.triggerTargets` is derived**
   - UI routing snapshots are built by scanning all modules.
   - For each sound module, snapshot code resolves `module.triggerSource` and appends the voice into `triggerTargets.get(trigger.id)`.
   - Therefore `triggerTargets` is derived/read-only projection, not canonical storage.

4. **Why GEN routing chip updates when Drum source dropdown changes**
   - Both UIs mutate the same canonical field (`targetModule.triggerSource`).
   - On rerender, `buildRoutingSnapshot()` recomputes `triggerTargets` from that field, so both surfaces stay in sync.

5. **Whether GEN routing chip edits true GEN-owned state**
   - The chip does not edit any trigger-owned list.
   - It toggles each selected voice’s `triggerSource` to this trigger id (or null), so it is a bridge/editor over voice-owned state.

## Question-by-question answers

1. **Is the current routing source of truth voice-owned?**
   - **Yes.**

2. **Is `targetModule.triggerSource` still the canonical persisted relationship?**
   - **Yes.**

3. **Is `routing.triggerTargets` only a derived/read model?**
   - **Yes.**

4. **Does GEN currently have any true owned routing state of its own?**
   - **No** (for trigger-to-voice routing).

5. **If GEN routing chip is only a bridge, what prevents fully native GEN-owned routing behavior today?**
   - Patch schema does not define a persisted trigger-owned target list.
   - Scheduler resolves routing by reading each voice’s `triggerSource`, not by consulting trigger-owned targets.
   - Migration/normalization logic enforces/repairs `triggerSource` references; no equivalent trigger-target canonical path exists.
   - UI snapshot (`triggerTargets`) is rebuilt from voice pointers each render, so it cannot become authoritative.

6. **Safest path forward (A/B/C)?**
   - **C) Hybrid model** as the lowest-risk migration path:
     1) Introduce trigger-owned targets in schema behind normalization/compat layer.
     2) Keep emitting/accepting `triggerSource` during transition for backward compatibility.
     3) Move scheduler/runtime reads to a single normalized routing resolver.
     4) Flip canonical ownership once persistence and migration are proven stable.
   - If no migration budget exists, **A** (voice-owned + better bridge UX) is safest short-term.
   - Direct jump to **B** is higher risk due to migration + scheduler + UI coupling changes in one step.

## Exact files/functions inspected

- `src/patch.ts`
  - `SoundBase.triggerSource`
  - `makeSound(..., triggerSource)`
  - `normalizeDrumModule` / `normalizeTonalModule`
  - `migratePatch` legacy resolution (`patternSource -> triggerSource`) and trigger id validity cleanup
- `src/ui/routingVisibility.ts`
  - `buildRoutingSnapshot()` derivation of `triggerTargets` from voice `triggerSource`
- `src/ui/triggerModule.ts`
  - GEN routing chip target toggles setting `targetModule.triggerSource`
- `src/ui/voiceModule.ts`
  - voice routing dropdown writes `m.triggerSource = value`
- `src/engine/scheduler.ts`
  - `resolveTrigger(sound, allModules)` reads `sound.triggerSource`
- `src/ui/render/moduleGrid.ts`
  - rebuilds routing snapshot on rerender
  - removing a trigger clears `m.triggerSource` on affected voices

## Recommendation

- Treat current behavior as **intentionally voice-owned with a trigger-side convenience editor**.
- For eventual GEN-native ownership, stage as hybrid migration rather than a hard cutover.
