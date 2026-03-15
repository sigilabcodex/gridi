# Testing in GRIDI

## Strategy decision: lightweight Node tests (structured)

We evaluated moving to Vitest, but for the current architecture the least disruptive path is to keep a **Node-native** test stack and formalize it with the built-in `node:test` runner.

Why this direction now:
- no extra runtime tooling required
- deterministic and fast for sequencing/pattern logic
- easy CI command (`npm test`)
- future-compatible: tests can migrate to Vitest later with minimal rewrite if browser/component tests become important

## What is covered

Current suite focuses on architecture-critical behavior:

1. **Deterministic pattern generation** across engines
2. **Event-window rendering** bounds/order and deterministic output
3. **Look-ahead overlap dedupe** parity with single-pass rendering
4. **Pattern source resolution** (self, external module, missing source fallback)
5. **Legacy patch migration** normalization/default behavior
6. **Routing invariants** for valid/invalid connections

## Commands

- Run all tests once:

```bash
npm test
```

- Watch mode during development:

```bash
npm run test:watch
```

- Run only step/event-window focused tests:

```bash
npm run test:step
```

## Contributor notes

- Keep tests deterministic (fixed seeds, fixed windows, explicit expected beats).
- Prefer unit-level scheduler/pattern tests over browser-heavy e2e.
- When adding a sequencing mode or source behavior, add:
  - one determinism test
  - one overlap-dedupe parity test
  - one migration/fallback test (if data model changed)
