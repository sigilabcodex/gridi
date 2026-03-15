# UI Shell Structure RFC

## Summary

`src/ui/app.ts` has been split into smaller modules so contributors can work by concern instead of navigating one large orchestration file.

This refactor preserves the existing DOM-driven architecture and keeps UI behavior/appearance unchanged.

## New boundaries

- `src/ui/app.ts`
  - App bootstrap and composition root.
  - Wires engine, scheduler, persistence, modal flows, history, and render loop.
- `src/ui/persistence/bankState.ts`
  - LocalStorage bank/patch persistence and validation helpers.
- `src/ui/history/undoRedo.ts`
  - Undo/redo stack management independent from DOM concerns.
- `src/ui/header/transportHeader.ts`
  - Header/transport DOM creation and control UI update helpers.
- `src/ui/modals/modal.ts`
  - Shared modal and lightweight DOM helper.
- `src/ui/modals/settingsModal.ts`
  - Settings UI, import/export JSON, patch/bank import flows.
- `src/ui/modals/welcomeModal.ts`
  - Welcome modal and first-run “hide again” behavior.
- `src/ui/state/voiceTabs.ts`
  - Per-voice tab UI state storage.
- `src/ui/render/moduleGrid.ts`
  - Module grid render orchestration for voice + visual modules and add-slot.

## Why this shape

- **Discoverability:** each file maps to a single operational concern.
- **Safer edits:** patch persistence, history, and modal logic are no longer interleaved.
- **Future work readiness:** SEQ/routing work can target `render/` and `state/` without touching transport or persistence glue.

## Notes for future contributors

- Keep framework-free DOM patterns used throughout current UI modules.
- Prefer adding behavior to the relevant concern module before changing `app.ts`.
- Treat `app.ts` as the integration shell, not a new feature dumping ground.
