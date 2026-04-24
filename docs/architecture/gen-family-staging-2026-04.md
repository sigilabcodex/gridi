# GEN family staging note (2026-04)

## Scope

This note captures a **staging architecture** for future GEN families without implementing those modes in this pass.

Near-term in code remains:
- GEAR stabilization,
- RADAR behavioral refinement (including moving targets),
- GEN event/energy safety hardening.

## Recommended mode-family structure

Use a two-level registry in Trigger pattern code:

1. **Family** (`structural`, `field`, `conceptual`, `asset`)
2. **Mode** (existing concrete mode IDs)

Short-term implementation recommendation:
- Keep current flat `mode` enum for patch compatibility.
- Add an internal family metadata table (`mode -> family`) in pattern/UI code.
- Move mode-specific control descriptors to per-family tables that can share semantics.

This keeps compatibility while avoiding a giant Trigger switchyard.

## Quantum direction: one family, two required submodes

Recommendation:
- Implement as **one `quantum` family** with at least two concrete modes:
  1. `quantum-superposition` (Schrödinger-inspired)
  2. `quantum-interference` (double-slit / uncertainty-inspired)

Reasoning:
- Shared conceptual language (observation/collapse/probability fields).
- Shared visualization grammar (state cloud + collapse traces).
- Different generation kernels under one family-level UI language.

## Minimal parameter sets for future modes

### 1) Schrödinger-inspired (`quantum-superposition`)
- `stateCount` (2..8): number of latent rhythmic states.
- `coherence` (0..1): persistence before collapse.
- `observation` (0..1): collapse probability per step/window.
- `entangle` (0..1): cross-lane coupling strength.
- `collapseBias` (0..1): directional bias toward anchors.

### 2) Double-slit / uncertainty-inspired (`quantum-interference`)
- `sourceSpacing` (0..1): slit spacing proxy.
- `wavelength` (0..1): interference lobe width.
- `detectorFocus` (0..1): observation sharpness.
- `uncertainty` (0..1): phase and position diffusion.
- `drift` (0..1): temporal movement of interference field.

### 3) Mesoamerican calendar mode
- `cycleA` (integer): short ritual cycle length.
- `cycleB` (integer): long civil cycle length.
- `alignmentOffset` (integer): phase shift between cycles.
- `epochDrift` (0..1): controlled slippage from strict lock.
- `ceremonyWeight` (0..1): emphasis at key coincidence points.

### 4) Image-driven mode
- `scanAxis` (enum): x / y / diagonal / radial.
- `scanPhase` (0..1): traversal offset.
- `threshold` (0..1): event gating threshold.
- `contrast` (0..1): transfer curve shaping.
- `tileResolution` (enum): reduced internal grid (e.g. 16, 24, 32).

### 5) RADAR moving-target refinement
- `targetCount` (mapped from density).
- `sweepRate` (mapped from subdiv).
- `targetDrift` (mapped from weird).
- `lockTightness` (mapped from determinism).
- `rangeBias` (mapped from gravity).

## Image ingestion guardrails (required before implementation)

- Accept only browser-decoded raster formats via safe file input.
- Hard cap source pixel count (e.g. <= 8 MP).
- Downsample immediately to bounded internal tiles (<= 32x32 for live mode).
- Strip metadata, ignore EXIF orientation after normalization.
- No network fetch-by-URL inside mode logic.
- Keep all processing synchronous-budget aware; no long UI-blocking scans.

## Module-family placement guidance

- Keep **RADAR, GEAR, quantum, calendar** in Trigger/GEN first.
- Treat **image-driven** as Trigger/GEN initially only if ingestion stays tightly bounded.
- If image/data ingestion expands beyond lightweight in-module assets, branch that work into a neighboring module family to protect Trigger clarity.

## Staging order recommendation

1. RADAR moving-target refinement (near-term)
2. GEAR stabilization (now)
3. Quantum family spec + contracts (now), implementation later
4. Calendar spec + contracts (now), implementation later
5. Image mode spec + guardrails now, implementation only after ingestion limits are enforced
