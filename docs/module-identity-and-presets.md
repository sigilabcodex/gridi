# Module identity, modes, presets, and sessions

This document defines the practical terminology boundary GRIDI now uses.

## Why this matters

As GRIDI becomes a real playable instrument, it needs strict vocabulary so runtime behavior, module UI, preset UX, and persistence all remain coherent.

## Core terms (practical definitions)

## 1) Module kind

**Module kind** is the broad family/category of a module instance.

Examples in current implementation:
- `trigger` (GEN behavior engines)
- `drum`
- `tonal` (SYNTH family)
- `control`
- `visual`

A module kind answers: **“What class of module is this?”**

## 2) Module mode / subtype

**Mode/subtype** is the behavior family *inside* a module kind.

Examples:
- Trigger mode: `step-sequencer`, `euclidean`, `cellular-automata`, `fractal`, `hybrid`, etc.
- Control subtype/kind: `lfo`, `drift`, `stepped`
- Visual subtype/kind: `scope`, `spectrum`, `pattern`

A mode/subtype answers: **“What behavior variant is this module currently running?”**

## 3) Module preset

**Module preset** is local to one module instance/family and captures the module’s own control state and closely related local configuration.

Examples:
- Drum preset stores drum shaping values (pitch/decay/noise/tone/etc.)
- Synth preset stores synth timbre/envelope/filter values
- Trigger preset stores generator parameters and seed/mode configuration
- Control/Visual presets store their local operating values

A module preset answers: **“What local instrument state should this module recall?”**

## 4) Session (whole instrument state)

**Session preset/session state** stores the broader whole-patch instrument configuration.

Session-level state includes:
- all module instances,
- module placement,
- routing relationships,
- transport/global patch state,
- each module’s current local state at save time.

A session answers: **“What full instrument configuration should load?”**

---

## Relationship between these layers

- **Kind** selects module family.
- **Mode/subtype** selects behavior variant inside that family.
- **Module preset** recalls local voice/generator/control/display setup for one module instance.
- **Session** recalls the full instrument graph and workspace state.

This is the canonical separation GRIDI should maintain.

## General design principle (all module families)

GRIDI is not treating this as GEN-only behavior. Any module family may and should support:

1. **module kind** (family identity),
2. **mode/subtype inside that kind** (behavior family),
3. **module-instance presets** (local recallable states).

This applies to current families and future families.

## Preset banks are instrument experience, not just storage

Starter module presets already exist, but the direction is curated, musical preset banks per family.

Priority curation targets:
- **Drum**: kicks, hats, cymbals, rattles, percussion families.
- **Synth**: basses, leads, pads, unstable/strange tone families.
- **GEN**: meaningful generator examples with distinct musical outcomes.

Preset banks are part of how players learn and perform GRIDI, not just serialization.

## Current constraints

- Module preset compatibility is family/subtype-checked.
- Session persistence is local-first (browser storage).
- Not all modules have equally mature curated default banks yet.

See also: [`docs/architecture/bank-system.md`](architecture/bank-system.md), [`docs/module-types.md`](module-types.md), [`docs/roadmap-instrument-state.md`](roadmap-instrument-state.md).
