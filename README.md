# Resonance Breach Prototype

A minimal browser simulation about **harmonic order slipping into rhythmic instability**.

The experience is intentionally slow, readable, and continuous: the field begins calm, introduces subtle distortions, lets breach entities emerge gradually, and then builds pressure until instability dominates.

## What changed in this pass

This pass focuses on clarity, pacing, and differentiation rather than adding heavy systemic complexity.

- Added **five continuous progression phases** driven by elapsed time and system pressure.
- Split the field into three readable roles: **harmonic nodes**, **anomalies**, and **breach entities**.
- Slowed the simulation so the player has time to observe local interactions and wider trends.
- Added **camera controls** for panning and zooming.
- Added **time controls** for contemplation and tension management.
- Improved anomaly emergence so distortions appear first before they become full breach entities.
- Added a subtle **rhythmic audio pulse** that intensifies as breach pressure rises.

## Simulation phases

Phase transitions are gradual and overlapping. There are no hard switches.

### 1. Calm

- Slow harmonic drift.
- Stable node relations dominate the field.
- Audio remains mostly ambient.

### 2. Anomaly

- Rare distortions begin to appear.
- These read as unstable traces and warped forms rather than complete entities.
- The system is still mostly stable.

### 3. Emergence

- Some anomalies condense into the first breach entities.
- Breach entities become visually and behaviorally distinct from the ambient field.
- Pressure is noticeable, but still sparse and legible.

### 4. Pressure

- Reproduction and propagation increase.
- Rhythmic pulsing becomes more audible.
- The field starts feeling coordinated under stress.

### 5. Breach

- Instability dominates.
- Breach rhythm tightens and visual stress peaks.
- Harmonic order is still present, but under heavy pressure.

## Entity roles

### Harmonic nodes

- Calm, stable anchors in the field.
- Rendered as restrained glowing circular forms with linking lines.
- Move gently and establish the baseline atmosphere.

### Anomalies

- Transitional distortions rather than complete bodies.
- Rendered as warped traces, ellipses, and unstable flickers.
- They foreshadow breach activity before full emergence.

### Breach entities

- Distinct spiked geometric structures with stronger glow and pulse.
- Move more deliberately toward harmonic structure.
- Drive rhythmic pressure and reproduction.

## Controls

- **Mouse wheel**: zoom in / out.
- **Click + drag**: pan camera.
- **W / A / S / D**: pan camera.
- **Hold Shift**: 0.5× slow motion.
- **Hold Space**: 2× fast forward.

## Design direction

- Minimal geometric rendering.
- Dark presentation with restrained color accents.
- No hard mode switches.
- No clutter or cartoon styling.

## Development

### Setup

```bash
npm ci
```

### Run locally

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Type-check

```bash
npm run typecheck
```
