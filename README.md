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

Each module has three identities:

- **Engine identity** (`engine`): stable runtime family (`trigger`, `drum`, `synth`, `visual`, `control`).
- **Preset identity** (`presetName`, optional `presetMeta`): sound/pattern label + metadata.
- **Instance identity** (`name`): how that specific module is labeled in the current workspace.

This separation keeps runtime behavior stable while allowing user-facing variation.

## 3) Workspace model

- The workspace is a **grid of fixed-size cells**.
- Modules occupy one cell each with a consistent footprint.
- Empty cells act as local add-slots.
- Modules can be added, removed, and repositioned through grid interactions.
- The design intent is spatial patch composition rather than scrolling forms.

More detail: [`docs/ui-principles.md`](docs/ui-principles.md), [`docs/architecture.md`](docs/architecture.md).

## 4) UI philosophy

- **Main face first**: each module exposes a compact primary surface for performance-critical controls.
- **Tabbed secondary faces**: routing/settings/debug-adjacent controls move to tabs.
- **Minimal primary surface**: keep the top-level view focused and playable.
- **No internal scroll panels** in module surfaces.
- **Instrument-like interaction** over form-heavy UI.

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
- Some advanced tabs remain intentionally lean while the shell model stabilizes.

### Experimental

- Wider routing ergonomics and visibility patterns.
- Additional pattern/control engines beyond the current baseline set.

Status reference: [`docs/status.md`](docs/status.md).

## 6) Short roadmap

Near-term direction:

1. **Control/modulation system**: clearer mapping, stronger feedback, safer defaults.
2. **Preset system**: explicit preset workflows on top of existing preset identity.
3. **Routing improvements**: better UX and validation visibility.
4. **UI refinement**: continue simplifying module faces and tab behavior while preserving fixed-grid stability.

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
