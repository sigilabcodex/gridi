# GRIDI User Manual

GRIDI is a browser-based modular generative music instrument. You build a playable patch by placing modules in a grid, choosing how they generate or shape musical events, routing those events into sound modules, and performing with compact controls.

This manual is written for players and users. It is intentionally separate from GRIDI's architecture, implementation, and developer documentation. If you want technical details, use the documentation map in the main [`README`](../../README.md); if you want to make sound and understand the instrument from the front panel, start here.

## GRIDI is evolving

GRIDI should be understood as a living modular instrument rather than a finished fixed appliance. In this version, the core model is already in place:

- modules live in a shared workspace;
- GEN modules create timed events;
- Drum and Synth modules turn events into sound;
- Visual and Control modules support monitoring and modulation;
- routing connects sources to destinations;
- sessions store whole instrument states;
- module presets store local module states.

Some areas are mature enough to play immediately. Other areas exist but are still being refined. Future work is planned around the same model: more module types, more modes/subtypes, richer presets, clearer routing workflows, stronger visual feedback, and better performance controls. Planned ideas are not described as available features unless they are already implemented.

## Suggested reading order

1. [`01-quick-start.md`](01-quick-start.md) — make a first sound quickly.
2. [`02-interface-overview.md`](02-interface-overview.md) — learn the main areas of the app.
3. [`03-module-basics.md`](03-module-basics.md) — understand module families, modes, presets, and names.
4. [`04-gen-modes.md`](04-gen-modes.md) — choose between current GEN behaviors.
5. [`11-future-directions.md`](11-future-directions.md) — see where GRIDI may go next.

## Manual chapters

- [Quick Start](01-quick-start.md)
- [Interface Overview](02-interface-overview.md)
- [Module Basics](03-module-basics.md)
- [GEN Modes](04-gen-modes.md)
- [Future Directions](11-future-directions.md)
