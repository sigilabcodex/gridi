# Testing in GRIDI

## Strategy decision: lightweight Node tests (structured)

We evaluated moving to Vitest, but for the current architecture the least disruptive path is to keep a **Node-native** test stack using the built-in `node:test` runner, with `tsx` providing a lightweight TypeScript loader for tests that import source `.ts` files directly.

Why this direction now:
- minimal test harness tooling (`tsx`) instead of a larger test-framework migration
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

## Browser smoke/regression tests

GRIDI also has a small browser-level smoke harness for DOM/focus/menu interactions that unit tests cannot reliably cover. The harness launches a local Vite dev server and drives a Chromium-compatible browser through the Chrome DevTools Protocol, so it does not require external services or audio hardware.

Install a Chromium-compatible browser before running the browser smoke suite:

- Linux: install `chromium` or `google-chrome-stable` with your OS package manager.
- macOS/Windows: install Chrome or Chromium.
- CI/custom paths: set `GRIDI_E2E_BROWSER=/absolute/path/to/chrome-or-chromium` when the browser is not in a common location.

Run the headless browser smoke suite:

```bash
npm run test:e2e
```

Run in headed mode when debugging focus/menu failures locally:

```bash
npm run test:e2e:headed
```

The e2e suite starts from a clean temporary browser profile and seeds localStorage with test-safe settings before each test. It intentionally remains small and covers only high-risk interactive smoke paths:

- module selection and Actions menu enablement
- multi-select duplicate/delete with confirmation
- shortcut suppression while typing in menu search
- Add Module quick search for LFO/control and Scope/visual IA
- Session Manager protected factory examples and local-session batch delete confirmation

Unit/model tests remain the default fast regression suite:

```bash
npm test
```

## Contributor notes

- Keep tests deterministic (fixed seeds, fixed windows, explicit expected beats).
- Prefer unit-level scheduler/pattern tests over browser-heavy e2e.
- When adding a sequencing mode or source behavior, add:
  - one determinism test
  - one overlap-dedupe parity test
  - one migration/fallback test (if data model changed)


## Baseline validation

Run these before opening a PR:

```bash
npm run typecheck
npm test
npm run build
```
