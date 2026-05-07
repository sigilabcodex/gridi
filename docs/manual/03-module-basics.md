# 03. Module Basics

GRIDI is built from modules. Each module has a family, an optional behavior mode or subtype, a local state/preset, and a name in the current session.

## Module families

### GEN

GEN modules generate timed events. They are the main pattern and rhythm sources in GRIDI. A GEN does not make sound by itself; it needs to be routed to a Drum or Synth module.

### Drum

Drum modules make percussive sounds. They usually respond to GEN events and are shaped with controls such as pitch/body, decay, tone/noise, level, and pan.

### Synth

Synth modules make tonal sounds. They can be triggered by GEN modules and, in current MIDI-capable browsers, can also receive live MIDI input through GRIDI's MIDI input routing.

### Visual

Visual modules show or analyze runtime behavior. In this version, Visual is usable for core monitoring such as scope/spectrum/pattern-style views, but the family is still expected to grow.

### Control

Control modules create modulation movement, such as LFO, drift, or stepped-style sources. They can move parameters on other modules. Control is functional and usable, but deeper modulation workflows and clearer surfaces are still being refined.

## Family/kind

The family or kind answers: **what class of module is this?**

Examples:

- GEN
- Drum
- Synth
- Visual
- Control

This is the broadest identity layer.

## Mode/subtype

A mode or subtype answers: **what behavior variant is this module running?**

Examples:

- a GEN mode such as Step Sequencer, Euclidean, Cellular Automata, or RADAR;
- a Control subtype such as LFO, drift, or stepped;
- a Visual subtype such as scope, spectrum, or pattern.

GEN has the most visible mode system right now, but the same idea can apply across module families.

## Preset

A module preset answers: **what local setup should this module recall?**

A Drum preset might store drum tone and envelope settings. A Synth preset might store oscillator, filter, and envelope settings. A GEN preset might store a generator mode, seed, and shaping controls.

Preset banks currently exist as part of the instrument experience, but not every family has equally mature curated banks yet. Expanded banks are a planned direction.

## Local instance name

A local instance name answers: **which specific module is this in the current session?**

For example, you might have two Drum modules using similar settings but name one `Kick` and another `Hat`. The name helps you understand the current patch; it does not change the underlying module family.

## Session

A session is the full instrument state. It stores modules, placement, routing, global/transport state, and each module's current local state at save time.

Use sessions when you want to come back to a whole patch. Use module presets when you want to recall one module's local sound or generator setup.

## How expansion fits the same system

Future GRIDI growth is expected to extend this same model rather than replace it. Expansion mainly means:

- more module families or stronger versions of current families;
- more modes/subtypes inside families;
- more curated presets;
- richer routing and modulation workflows;
- deeper display and performance refinements.
