# GEN mode design principles

This document centralizes the active design contract for GEN modes.

## Core principles

- Every GEN mode must have distinct behavior, not just renamed controls.
- Shared patch keys may use mode-specific labels when that improves semantic clarity.
- Maintain patch compatibility and flat mode IDs as long-term stability constraints.
- GRIDI is an instrument, not a DAW.

## Tab responsibility contract

- **Main** tab holds identity-defining controls that express the mode's core behavior.
- **Fine-tune** tab holds secondary shaping and expert parameters.
- **Routing** tab is for connectivity/routing concerns.
- Fine-tune organization may be mode-aware, but should preserve stable underlying patch keys.

## Display truthfulness contract

- Displays are behavior surfaces, not decoration.
- Every moving element should map to pattern phase, scheduler time, generated events, or mode state.
- Beauty should emerge from structure.
- If a mode cannot be truthfully visualized yet, prefer a simpler honest readout over fake complexity.

## Interaction and rollout guidance

- Future interactive GEN editing should start with **Step Sequencer** and **Hybrid**, not every mode at once.
- Expand rich interaction only where runtime semantics are already clear and testable.
