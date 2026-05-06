# Post-0.33.0 GEN/UI regression QA — 2026-05-06

## Scope

Final regression QA pass after the `0.33.0` GEN/UI stabilization baseline and before the Routing phase.

Required-read sources reviewed:

- `README.md`
- `ROADMAP.md`
- `docs/status.md`
- `docs/releases.md`
- `docs/gen-mode-design-principles.md`
- `docs/ui-principles.md`
- `docs/audits/gen-mode-semantics-controls-display-audit-2026-04.md`
- `docs/audits/version-milestone-audit-2026-05.md`
- `src/patch.ts`
- `src/engine/pattern/genModeRegistry.ts`
- `src/ui/triggerModule.ts`
- `src/ui/triggerDisplaySurface.ts`
- `src/ui/app.ts`
- `src/ui/render/moduleGrid.ts`
- `src/version.ts`

## Summary

Status: **pass after one release-metadata correction**.

This pass found one regression in release metadata: `package-lock.json` still reported `0.32.4` while `package.json` had already been bumped to `0.33.0`. The lockfile root version metadata was updated to `0.33.0`. No patch/schema version changes were made.

## A. Release/version

- `package.json` version is `0.33.0`.
- `package-lock.json` root package metadata now also reports `0.33.0`.
- Runtime/UI version remains sourced from the Vite-injected npm package version via `src/version.ts`.
- `README.md`, `docs/status.md`, and `docs/releases.md` include the `0.33.0` release baseline where appropriate.
- Patch schema remains `0.3`.
- Settings schema remains `1`.
- Preset/session release notes continue to reference `0.33` without a schema bump.
- `ROADMAP.md` still points the next major work toward `v0.4` Performance routing.

## B. GEN modes

Static source audit verified all current GEN modes are registered, appear in the mode picker through `GEN_MODES`, have mode-control registry entries, and dispatch to display views:

| Mode | Picker label | Main controls | Fine-tune grouping | Display dispatch | Notes |
| --- | --- | --- | --- | --- | --- |
| `step-sequencer` | Step Sequencer | Present | Global shaping + stability/bias | Present | Existing known weak label: `Var`/`Swing` remain acceptable for baseline follow-up. |
| `euclidean` | Euclidean | Present | Global shaping + stability/bias + phase/topology | Present | Controls remain mode-appropriate. |
| `cellular-automata` | Cellular Automata | Present | Global shaping + stability/bias + CA internals | Present | Relevant CA internals only. |
| `hybrid` | Hybrid | Present | Global shaping + stability/bias + CA internals | Present | Known display-strength follow-up remains non-blocking. |
| `gear` | GEAR | Present | Global shaping + stability/bias + phase/topology | Present | Ring/mesh semantics remain distinct. |
| `radar` | RADAR | Present | Global shaping + stability/bias | Present | Implemented rotating scan mode remains RADAR. |
| `fractal` | Fractal | Present | Global shaping + stability/bias + phase/topology | Present | Known display-strength follow-up remains non-blocking. |
| `non-euclidean` | Non-Euclidean | Present | Global shaping + stability/bias + phase/topology | Present | Display dispatch present. |
| `markov-chains` | Markov Chains | Present | Global shaping + stability/bias | Present | Memory/bias labels present. |
| `l-systems` | L-Systems | Present | Global shaping + stability/bias | Present | Known display-strength follow-up remains non-blocking. |
| `xronomorph` | XronoMorph | Present | Global shaping + stability/bias + phase/topology + CA internals | Present | Morph/phase semantics present. |
| `genetic-algorithms` | Genetic Algorithms | Present | Global shaping + stability/bias | Present | Known display-strength follow-up remains non-blocking. |
| `one-over-f-noise` | 1/f Noise | Present | Global shaping + stability/bias | Present | Noise display dispatch present. |

Tab grammar remains `Main | Fine-tune | Routing` for trigger modules, with Routing last.

Automated unit coverage includes accent/velocity tests that confirm accent reshapes velocity without changing hit placement for the currently covered fractal and L-Systems cases, plus deterministic bounded-output coverage for all trigger modes.

## C. RADAR / SONAR

- Implemented rotating scan mode is named `RADAR` in the GEN registry and active trigger mode UI.
- No active GEN registry or trigger UI `SONAR` label remains.
- Legacy `sonar` patches normalize to `radar`.
- Future SONAR references remain documentation/roadmap-only and describe pulse/echo/terrain semantics distinct from RADAR's rotating scan.

## D. Shell/UI

- Trigger tab order is `Main | Fine-tune | Routing`.
- Drum/tonal/control surfaces continue to receive their tab state through shared module-grid wiring, preserving cross-family tab consistency.
- `Fine-tune` is used as the user-facing secondary tab label for GEN.
- Routing remains last in the trigger tab shell.
- Module selection state is isolated from drag-handle and move-overlay interactions and prunes deleted module IDs.
- Document title updates after active session load, new session creation, save-as/new copy, rename, duplicate, delete, and import flows.

## E. Checks run

- `npm install --package-lock-only --ignore-scripts` — used to align lockfile release metadata with `package.json`.
- Static QA script — verified version metadata, GEN registry entries, trigger control entries, display dispatch, tab labels, RADAR naming, and legacy `sonar` normalization.
- `npm run typecheck`
- `npm run build`
- `npm test`

## Limitations

No browser integration/e2e harness is currently present in the repository, so interactive browser-only assertions such as normal-size overflow and console errors were audited by source review plus production build/tests rather than by an automated browser run. This matches the existing known limitation that there is no browser integration/e2e test harness yet.
