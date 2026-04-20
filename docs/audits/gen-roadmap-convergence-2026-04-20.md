# GEN roadmap convergence audit (2026-04-20)

## Scope reviewed

- `ROADMAP.md`
- `docs/status.md`
- `docs/architecture.md`
- `docs/architecture/gen-family-staging-2026-04.md`
- `docs/module-types.md`
- `src/patch.ts`
- `src/ui/triggerModule.ts`
- `src/ui/triggerDisplaySurface.ts`
- `src/engine/pattern/module.ts`
- `src/engine/pattern/gear.ts`
- related roadmap/support docs (`docs/roadmap-instrument-state.md`, `docs/ui-faceplate-grammar.md`)

## A) Current GEN mode audit/classification

### 1) Mature enough for public/demo use

- `step-sequencer`
- `euclidean`
- `cellular-automata`
- `hybrid`

Why: each has dedicated pattern generation logic in `src/engine/pattern/module.ts`, dedicated mode control semantics in `src/ui/triggerModule.ts`, and dedicated display renderers in `src/ui/triggerDisplaySurface.ts`.

### 2) Behaviorally interesting but visually weaker (vs algorithm complexity)

- `markov-chains`
- `l-systems`
- `genetic-algorithms`
- `one-over-f-noise`

Why: generation kernels are meaningful and parameterized in `src/engine/pattern/module.ts`, but displays lean toward simplified/abstract previews rather than clearly exposing algorithm state transitions.

### 3) Visually interesting but musically weaker / still “feel tuning” heavy

- `sonar`

Why: SONAR has one of the richest animated displays (moving target models, trails, sweep reaction), while musical credibility still depends on threshold/target tuning and lock/drift balancing in `genSonarPattern` and event-value/lane mapping.

### 4) Structurally present but still prototype-grade

- `fractal`
- `non-euclidean`
- `xronomorph`
- `gear` (strong direction, still stabilization-grade rather than fully settled)

Why: all are implemented end-to-end, but still shaped as compact prototypes relative to the “full graphical representation + stable instrument personality” bar.

### 5) Deprioritized for now (implemented as roadmap intent, not mode code)

- image-driven modes
- quantum/Schrödinger family
- dataset/spreadsheet-driven family

Why: explicitly roadmap/staging-level directions in docs with guardrails/spec language, not active Trigger `mode` values in `src/patch.ts`.

## B) Recommended next GEN sequence (3 steps)

### Step 1 — stabilize family metadata + staging contracts (stabilization)

- Why now: roadmap and staging docs already call for mode-family structure while preserving flat patch `mode` values.
- Why first: this is low risk and prevents new mode work from further increasing switch/copy duplication.
- Expected areas: Trigger mode metadata shared by UI/pattern/display; docs alignment.
- Risk: low.

### Step 2 — SONAR musical semantics pass (stabilization)

- Why now: SONAR is visibly strong but still not consistently convincing as a musical generator.
- Why after step 1: mode-family metadata gives clearer placement and avoids another SONAR-only local patch.
- Expected areas: `genSonarPattern`, velocity/lane mapping for SONAR in event conversion, and SONAR-specific display semantic cues.
- Risk: medium (timing feel regressions if thresholds over-shift).

### Step 3 — prototype-grade conceptual-mode uplift to one demo-grade target (expansion)

- Why now: keeps GEN progress broader than SONAR/GEAR and advances v0.5 groundwork.
- Why after step 2: first recover confidence in existing weak mode feel; then elevate one conceptual mode (recommended: `markov-chains` or `l-systems`) into clear demo personality.
- Expected areas: mode kernel, display semantics for state visibility, curated preset examples.
- Risk: medium.

## C) One implementation performed in this pass

Implemented: **shared GEN family metadata/staging registry** (`src/engine/pattern/genModeRegistry.ts`) and wired it into Trigger UI + display labeling.

What changed:

1. Added central metadata registry mapping existing mode IDs to:
   - full/short labels,
   - family (`structural`, `field`, `conceptual`, `asset`),
   - stage (`demo`, `refine`, `prototype`, `defer`).
2. Updated Trigger mode selector/label usage to consume registry metadata.
3. Updated display fallback title labeling to consume same metadata.

Why this improvement now:

- It directly follows architecture staging guidance,
- keeps patch compatibility untouched (flat mode IDs unchanged),
- reduces duplication and creates a clean anchor for upcoming SONAR/GEAR and v0.5 family work.
