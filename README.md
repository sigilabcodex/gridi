# GRIDI

GRIDI is a browser-based generative rhythmic instrument implemented with Vite, TypeScript, and WebAudio. It focuses on deterministic scheduling plus controlled indeterminism in pattern generation.

Current app version: `0.32.4`.

## UI overview

- Dynamic module grid with voice, visual, and effect modules.
- Transport/header controls for play, audio context state, bank navigation, reseed/randomize, and master controls.
- Voice tabs split into `MAIN`, `SEQ`, and `MIDI` sections.

> Screenshot placeholder: capture from local `npm run dev` session when sharing UX changes.

## Architecture summary

Core runtime layers:

- **Patch model (`src/patch.ts`)**: canonical typed document for modules, buses, and connections.
- **Audio engine (`src/engine/audio.ts`)**: WebAudio graph management, voice triggering, routing validation.
- **Scheduler (`src/engine/scheduler.ts`)**: look-ahead transport that renders pattern windows and schedules exact audio times.
- **Pattern modules (`src/engine/pattern/*`)**: deterministic event generation and window rendering.
- **UI layer (`src/ui/*`)**: DOM controls, module rendering, persistence, and modal flows.

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

Detailed testing notes: [`docs/testing/testing.md`](docs/testing/testing.md).

## Documentation map

- Project status: [`docs/status.md`](docs/status.md)
- Security review: [`docs/security-review.md`](docs/security-review.md)
- Testing guide: [`docs/testing/testing.md`](docs/testing/testing.md)
- Roadmap: [`ROADMAP.md`](ROADMAP.md)
- RFCs: [`docs/rfcs/`](docs/rfcs)

## Roadmap snapshot

- `v0.32.x`: sequencing/module architecture stabilization (current).
- `v0.4`: richer routing and performance controls.
- `v0.5`: expanded generative ecosystem and external sync.
