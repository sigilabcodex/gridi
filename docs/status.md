# GRIDI Status

## Current version

- App version: `0.32.4` (`src/version.ts`)
- Patch model: `0.3`

## Development phase

`v0.32.x` stabilization: tighten reliability and contributor clarity before expanding features.

## Completed milestones

- Dynamic modular grid and add-slot workflow.
- Patch-based architecture with migration and persistence.
- Look-ahead scheduler with deterministic window rendering tests.
- Foundational routing model (`modules`, `buses`, `connections`).
- Basic visual modules (scope/spectrum) and transport/header controls.

## Current priorities

1. Preserve deterministic scheduler + pattern behavior.
2. Reduce hidden coupling between UI handlers and patch mutation paths.
3. Improve architecture/security documentation for new contributors.
4. Keep dependency tree lean and reproducible.

## Known limitations

- UI and mutation orchestration are still centralized in `src/ui/app.ts`.
- No browser integration/e2e test harness yet.
- Runtime state is browser-local (localStorage), no multi-user/session sync.
- Security posture is primarily static review plus disciplined DOM usage.

## Next planned features

- Better routing UX and validation visibility.
- Clock/transport abstraction hardening for external sync.
- Additional pattern engines once scheduler boundaries are fully stabilized.
