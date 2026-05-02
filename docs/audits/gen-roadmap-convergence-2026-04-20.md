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

- `radar`

Why: RADAR has one of the richest animated displays (moving target models, trails, sweep reaction), while musical credibility still depends on threshold/target tuning and lock/drift balancing in `genRadarPattern` and event-value/lane mapping.

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

### Step 2 — RADAR musical semantics pass (stabilization)

- Why now: RADAR is visibly strong but still not consistently convincing as a musical generator.
- Why after step 1: mode-family metadata gives clearer placement and avoids another RADAR-only local patch.
- Expected areas: `genRadarPattern`, velocity/lane mapping for RADAR in event conversion, and RADAR-specific display semantic cues.
- Risk: medium (timing feel regressions if thresholds over-shift).

### Step 3 — prototype-grade conceptual-mode uplift to one demo-grade target (expansion)

- Why now: keeps GEN progress broader than RADAR/GEAR and advances v0.5 groundwork.
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
- reduces duplication and creates a clean anchor for upcoming RADAR/GEAR and v0.5 family work.

## E) Upcoming GEN mode direction — SONAR (planned, not implemented)

- SONAR is reserved as a distinct future mode and should not reuse RADAR sweep logic.
- Core concept: pulse-based terrain interaction system (radial wave propagation, not directional rotation).
- Role in GEN roadmap: complements implemented RADAR with distance-based event logic and echo/resonance-style detection.
- Exploration vector: terrain/field simulation hooks (attenuation, reflection, absorption, deformation) tied to musical event generation.
- Suggested parameter surface for future SONAR mode:
  - pulse frequency,
  - propagation speed,
  - attenuation,
  - terrain/field interaction,
  - echo/resonance detection.

## D) Velocity editing staging note (added in stabilization follow-up)

- Full editable per-step velocity should primarily target `step-sequencer` (and secondarily `hybrid`) because those modes are the clearest fit for explicit grid-style authoring.
- That work is deferred in `v0.32.x` stabilization to avoid over-expanding Trigger into a DAW-like editor while core GEN semantics and layout readability are still being tightened.
- Near-future direction:
  - optional interactive GEN displays (mode-by-mode),
  - per-step on/off editing where musically justified,
  - per-step velocity editing (focused first on `step-sequencer`),
  - pointer-gesture and mouse-wheel refinements for fast live editing,
  - possible popup/lightbox editor for denser velocity work without overloading the compact faceplate.
- UI naming/tab note: current `Advanced` placement is pragmatic; it may evolve into `Fine-tune`, and tab logic may need further crowding control as GEN controls expand.
