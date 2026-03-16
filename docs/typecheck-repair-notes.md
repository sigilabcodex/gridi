# Typecheck repair notes

## 1) Files that were out of sync

- `src/engine/patternTypes.ts` re-exported `PatternSourceRef`, but that type no longer exists in `src/engine/pattern/module.ts`.
- `src/engine/pattern/stepEventWindow.ts` still used an older pattern-module API (`createStepPatternModule`, `voice`, and `source`) that no longer matches the current `PatternRenderRequest` shape.

## 2) Imports/exports corrected

- Removed stale `PatternSourceRef` re-export from `src/engine/patternTypes.ts`.
- Updated `src/engine/pattern/stepEventWindow.ts` to import and use `createPatternModuleForTrigger`.
- Updated `StepWindowRenderParams` to pass a `trigger: TriggerModule` and call `renderWindow` with `{ voiceId, trigger, startBeat, endBeat }`.

## 3) Legacy type assumptions found

- The old step-window path still assumed a legacy voice-centric render contract (`voice` + `source`) instead of the current trigger-driven pattern module contract (`trigger`).
- This is a legacy module-model leftover from the pre-refactor pattern interface.

## 4) Follow-up cleanup recommendation

- Recommended: either remove `stepEventWindow.ts` if unused, or add a narrow test for its current trigger-based render signature to prevent future API drift.
- No broader refactor was included here; this change is intentionally minimal for CI typecheck recovery.
