# GEN regression QA pass (2026-05)

## Summary

This audit pass reviewed GEN mode identity, controls, tab grammar, display coverage, RADAR/SONAR naming+migration behavior, and automated regression status after recent GEN/UI work.

Overall result: **pass with minor follow-up notes**.

- All 13 GEN modes are present in the canonical mode union and registry with expected user-facing labels.
- Trigger face tabs are ordered and labeled as `Main | Fine-tune | Routing`.
- Mode-aware Main control labels and Fine-tune relevance filtering/grouping are implemented.
- Display factory has explicit views for all 13 GEN modes; no missing-mode fallback path is exercised for known modes.
- RADAR is the implemented field-scan mode; legacy `sonar` patch values normalize to `radar`; SONAR remains roadmap/docs-only as future distinct pulse/echo mode.
- Naming tests are aligned with readable defaults (no stale `Trigger 1/2` expectation remains).
- Automated checks (`typecheck`, `build`, `test`) pass cleanly.

No code changes were required.

---

## Scope and method

### Required-reading files reviewed
- `docs/status.md`
- `ROADMAP.md`
- `docs/ui-principles.md`
- `docs/audits/gen-mode-semantics-controls-display-audit-2026-04.md`
- `docs/audits/gen-display-truthfulness-2026-04-23.md`
- `src/patch.ts`
- `src/engine/pattern/genModeRegistry.ts`
- `src/engine/pattern/module.ts`
- `src/ui/triggerModule.ts`
- `src/ui/triggerDisplaySurface.ts`
- `src/ui/style.css`

### QA approach
- Static contract audit of mode registries/types, tab shell, control registries, display view dispatch, and migration maps.
- Repo-wide spot checks for stale SONAR naming and stale trigger-default naming expectations.
- Full automated regression suite run.

---

## Per-mode QA table

Legend:
- Picker/Main/Fine-tune/Display/Accent: ✅ pass, ⚠ follow-up note
- Routing/Tab order: shared Trigger-shell checks applied to all modes

| Mode | Picker label present | Main labels mode-appropriate | Fine-tune relevance | Display view present | Accent semantics (no hit move) | Notes |
|---|---|---|---|---|---|---|
| Step Sequencer | ✅ | ✅ | ✅ | ✅ | ✅ | Baseline structural mode wired through registry+controls+view. |
| Euclidean | ✅ | ✅ | ✅ | ✅ | ✅ | Main exposes Pulse/Steps/Rotate etc.; phase control also in Fine-tune sectioning. |
| Cellular Automata | ✅ | ✅ | ✅ | ✅ | ✅ | CA internals section (`Rule`, `Seed Fill`) is mode-gated. |
| Hybrid | ✅ | ✅ | ✅ | ✅ | ✅ | Dense mode remains compact via sectioned Fine-tune.
| GEAR | ✅ | ✅ | ✅ | ✅ | ✅ | Determinism/gravity relabeled Mesh/Weight in Fine-tune.
| RADAR | ✅ | ✅ | ✅ | ✅ | ✅ | Implemented field mode; no user-facing SONAR label for this mode.
| Fractal | ✅ | ✅ | ✅ | ✅ | ✅ | Conceptual mode with explicit display view and specific Main labels.
| Non-Euclidean | ✅ | ✅ | ✅ | ✅ | ✅ | Dedicated model+display path exists.
| Markov Chains | ✅ | ✅ | ✅ | ✅ | ✅ | Dedicated Markov model+display path exists.
| L-Systems | ✅ | ✅ | ✅ | ✅ | ✅ | Accent invariance covered by dedicated test.
| XronoMorph | ✅ | ✅ | ✅ | ✅ | ✅ | Dense mode has dedicated model+display and Fine-tune grouping.
| Genetic Algorithms | ✅ | ✅ | ✅ | ✅ | ✅ | Dedicated display and generator model path exists.
| 1/f Noise | ✅ | ✅ | ✅ | ✅ | ✅ | Field-family label and display mapping present. |

Shared checks (all modes):
- `Routing` tab remains available as third tab.
- Tab order is `Main | Fine-tune | Routing`.
- No missing display fallback for known GEN modes.

---

## Specific regression checks

### RADAR / SONAR
- Implemented mode in patch/model space is `radar` (in `Mode` union and mode registry).
- Legacy `sonar` is normalized through migration map to `radar`.
- Current docs distinguish RADAR (implemented rotating scan) vs SONAR (future pulse/echo).
- Repo still includes `sonar` token in at least one test loop as a compatibility/stability alias input case; behavior is safe because migration/normalization absorbs it.

### Naming
- Default patch naming test asserts readable names rather than old `Trigger 1/2` style placeholders.
- No stale `Trigger 1/2` expectation was found in tests reviewed during this pass.

### Fine-tune layout/readability
- Trigger Fine-tune is sectioned (`Global shaping`, `Stability / Bias`, optional `Phase / Topology`, optional `CA internals`).
- Dense conceptual/structural modes are filtered to relevant controls rather than showing the old generic full matrix.
- Non-GEN (voice) surfaces also use `Main | Fine-tune | Routing` tab labeling.

### Displays
- All 13 GEN modes have explicit display-view constructors in `createViewForMode`.
- No silent display hole detected for current modes.
- Prior audits’ weaker-display caveats remain documented in audit docs (not hidden).

---

## Test results

All requested commands pass:

- `npm run typecheck` ✅
- `npm run build` ✅
- `npm test` ✅ (85 tests passed)

No failing tests to classify in this run.

---

## Bugs found/fixed

- **Found:** none.
- **Fixed:** none (no code changes made in this QA-only pass).

---

## Remaining known issues / follow-up notes

1. Some conceptual-mode displays are still intentionally “acceptable/weak” per previous truthfulness audits; this remains a quality follow-up area, not a regression.
2. A compatibility-oriented test loop still includes `'sonar'` as an input mode token. This is not user-facing regression, but a brief inline test comment could clarify intent (legacy alias normalization coverage).

---

## Recommended next action

1. Keep current GEN contracts stable and schedule a targeted **display-strengthening pass** for weaker conceptual modes (GA / Fractal / L-Systems / Hybrid readability).
2. Add a short note/comment near remaining `'sonar'` test usage to explicitly mark it as **legacy normalization coverage** and avoid future confusion.
3. If desired for stricter QA depth, run an interactive browser/manual sweep checklist pass (visual overlap/overflow at multiple viewport sizes) and capture screenshots per dense mode.
