# Contributing to GRIDI

## Workflow

1. Fork/branch from `main`.
2. Keep changes focused (stability, maintainability, or bounded feature increments).
3. Run checks locally before opening a PR.
4. Document behavior-impacting changes in README/ROADMAP/docs as needed.

## Local setup

```bash
npm ci
npm run dev
```

## Required checks

```bash
npm run typecheck
npm test
npm run build
```

## Coding guidelines

- Prefer explicit TypeScript types over `any`.
- Avoid behavior changes in cleanup-only refactors.
- Keep scheduler/pattern behavior deterministic.
- When modifying persistence or patch schema, add migration-safe defaults and tests.
- Keep WebAudio graph operations predictable: connect/disconnect/cleanup should be symmetrical.

## Testing expectations

When adding or changing sequencing behavior, include deterministic tests for:

- pattern generation,
- event window bounds/order,
- overlap-dedupe parity,
- migration/fallback behavior if schema changes.

See [`docs/testing/testing.md`](docs/testing/testing.md).

## Documentation expectations

Update these when relevant:

- `README.md` for runtime/setup changes,
- `ROADMAP.md` for milestone shifts,
- `docs/status.md` for current project state,
- `docs/security-review.md` when introducing new risk surfaces.
