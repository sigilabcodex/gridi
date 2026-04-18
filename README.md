# GRIDI

GRIDI is **a modular generative music instrument built around a grid-based workspace**.

It runs in the browser (Vite + TypeScript + WebAudio) and focuses on deterministic timing with controlled indeterminism in pattern generation.

Current app version: `0.32.4`.

## 1) Project description

GRIDI is a patch-based instrument where you place modules in a fixed workspace grid, connect event and modulation sources, and shape rhythm/tonality through compact module surfaces.

It is not just a sequencer timeline. The core interaction is assembling and performing a small modular system.

## 2) Core concepts

### Module types

- **Trigger**: generates musical events (step/pattern timing).
- **Drum**: percussive sound voices, typically driven by Trigger modules.
- **Synth**: tonal sound voices (`tonal` module type with `synth` engine).
- **Visual**: display/analysis modules (scope/spectrum/pattern views).
- **Control**: modulation sources (LFO/drift/stepped). Present in the data model and UI, still evolving.

See also: [`docs/module-types.md`](docs/module-types.md).

### Engine vs preset vs instance

Each module has three identities (in strict hierarchy):

- **Engine identity** (`engine`): stable runtime family (`trigger`, `drum`, `synth`, `visual`, `control`).
- **Preset identity** (`presetName`, optional `presetMeta`): reusable sound/pattern identity layered on top of the engine.
- **Instance identity** (`name`): local label for one placed module in the current workspace.

Use this order when reasoning about behavior: engine defines runtime semantics, preset defines reusable flavor, instance defines local context.

## 3) Workspace model

- The workspace is a **grid of fixed-size cells**.
- Modules occupy one cell each with a consistent footprint.
- Empty cells act as local add-slots.
- Modules can be added, removed, and repositioned through grid interactions.
- The design intent is spatial patch composition rather than scrolling forms.

More detail: [`docs/ui-principles.md`](docs/ui-principles.md), [`docs/architecture.md`](docs/architecture.md).

## 4) UI philosophy

- **Transport/header minimalism**: the top header is a compact control strip for play/stop, tempo/master, output status, preset session actions, and utilities.
- **Main face first**: each module exposes a compact primary surface for performance-critical controls.
- **Tabbed secondary faces**: routing/settings/debug-adjacent controls move to tabs.
- **Minimal primary surface**: keep the top-level view focused and playable.
- **Stable module shell**: tabs and identity metadata operate inside a fixed shell; switching tabs should not change card size or introduce internal scrolling.
- **No internal scroll panels** in module surfaces.
- **Instrument-like interaction** over form-heavy UI.

Reference: [`docs/ui-principles.md`](docs/ui-principles.md).

## 5) Current state

### Working now

- Patch model with module/bus/connection data and migration support.
- Deterministic look-ahead scheduler + pattern window rendering.
- Trigger, drum, synth, visual, and control module families in the workspace.
- Grid-based module composition with add/remove flows.
- Tabbed module surfaces with per-family content.

### Partial / in-progress

- Control/modulation routing depth and UX are still being refined.
- Preset identity exists, but full preset management (browser/save/load workflows) is not complete.
- Some advanced tabs remain intentionally lean while shell boundaries and routing ergonomics stabilize.

### Experimental

- Wider routing ergonomics and visibility patterns.
- Additional pattern/control engines beyond the current baseline set.

Status reference: [`docs/status.md`](docs/status.md).

## 6) Short roadmap

Near-term direction:

1. **Control/modulation system**: clearer mapping, stronger feedback, safer defaults.
2. **Preset system**: explicit preset workflows on top of existing preset identity.
3. **Routing improvements**: better UX and validation visibility.
4. **Visual analysis expansion**: grow the Visual module family with additional analyzer modes (including a planned time-sensitive spectrogram direction).
5. **Generation-mode exploration**: develop image-driven, conceptual (quantum-inspired), and dataset-driven generation families as instrument workflows.
6. **Stabilization discipline**: reduce hidden UI↔engine coupling and preserve deterministic behavior while refining shell ergonomics.

## Development

### Prerequisites

- Node.js `>=20.19.0`
- npm (lockfile-based install expected)

### Setup

```bash
git clone <repo-url>
cd gridi
npm ci
```

### Run

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

### Tests

```bash
npm test
```

## Documentation map

- Architecture: [`docs/architecture.md`](docs/architecture.md)
- Module families: [`docs/module-types.md`](docs/module-types.md)
- UI principles: [`docs/ui-principles.md`](docs/ui-principles.md)
- Status: [`docs/status.md`](docs/status.md)
- Existing deep dives: [`docs/`](docs)
