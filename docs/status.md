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
- Basic visual modules (scope/spectrum).
- Compact transport/header control strip and preset/session utility grouping.
- Preset-first module identity shell in fixed-size module cards.

## Current priorities

1. Preserve deterministic scheduler + pattern behavior.
2. Reduce hidden coupling between UI handlers and patch mutation paths.
3. Keep module main faces compact/playable while secondary concerns stay in tabs.
4. Improve architecture/security documentation for new contributors.
5. Keep dependency tree lean and reproducible.
## Versioning recommendation

- Source-of-truth version is maintained in both `package.json` (`version`) and `src/version.ts` (`APP_VERSION`).
- For pre-1.0 GRIDI, use **minor bumps** for architecture milestones that constrain future implementation behavior, and **patch bumps** for narrow fixes/clarifications.
- This PR is documentation-first and does not require an immediate version bump unless released as a standalone architecture milestone.


## Known limitations

- UI and mutation orchestration are still centralized in `src/ui/app.ts`.
- No browser integration/e2e test harness yet.
- Runtime state is browser-local (localStorage), no multi-user/session sync.
- Security posture is primarily static review plus disciplined DOM usage.

## Next planned features

- Better routing UX and validation visibility.
- Clock/transport abstraction hardening for external sync.
- Additional pattern engines once scheduler boundaries are fully stabilized.

See also: [`docs/ui-principles.md`](ui-principles.md), [`docs/architecture.md`](architecture.md), [`docs/module-types.md`](module-types.md).
