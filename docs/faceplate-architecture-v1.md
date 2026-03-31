# GRIDI Faceplate Architecture v1

## Purpose

This document defines the canonical module-face architecture for GRIDI.

GRIDI is a **digital instrument**. It is not a DAW timeline, not hardware emulation, and not a generic software panel. The faceplate model must preserve:

- hardware-like clarity,
- digital flexibility,
- learnability,
- future MIDI controllability/mappability.

---

## Scope and authority levels

### Canonical now (must not regress)

1. Fixed shell footprint and fixed vertical module card budget.
2. Thin, fixed, canonical module header row.
3. Canonical vertical order inside each module:
   - Header
   - Visual / Feature Zone
   - Control Panel
   - Tabs
   - Status / Info Bar
4. Main tab is performance-first and playable without opening setup-heavy tabs.
5. No internal scrollbars inside module faces.

### Recommended next (should be adopted in upcoming module work)

1. Standardize tab naming to **Main / Routing / Advanced** in docs and future implementation work.
2. Define stable control-index ordering for MIDI-readiness.
3. Add structured status/info semantics across all module families.
4. Reduce placeholder/empty secondary content.

### Planned later / not yet canonical

1. Visual patch-cable/routing canvas.
2. Full per-control MIDI learn UI and assignment overlays.
3. Dedicated accessibility personalization profiles (contrast packs, larger control geometry modes).
4. External hardware/controller templates and import/export of mappings.

---

## Faceplate zones (v1 grammar)

Each module face follows this anatomy (top to bottom):

1. **Header (fixed thin row)**
   - module type chip (family identity),
   - preset chip,
   - activity indicators (LEDs/meters as applicable),
   - On/Off,
   - delete with safety behavior.

2. **Visual / Feature Zone (dominant when meaningful)**
   - sequencer rail, waveform/scope, envelope shape, mode machine readout, etc.
   - reflects key parameter changes when possible.
   - doubles as didactic cue (“what this module is doing now”).

3. **Control Panel (performance controls only)**
   - high-priority controls for live use and immediate shaping.

4. **Tabs (secondary concerns)**
   - Main / Routing / Advanced responsibilities defined below.

5. **Status / Info Bar (thin bottom strip)**
   - module short ID,
   - state summary,
   - warnings,
   - last interaction,
   - future MIDI activity/debug indicators.

---

## Control density and priority rules

### Density limits

1. **Main panel target: ~8 key controls.**
2. Hard upper bound on Main: **10 controls**, only with explicit justification.
3. Controls beyond Main limits move to Advanced.
4. Do not use Main as a parameter dump.

### Priority ordering (Main)

Order controls by:

1. **Performance criticality** (what users touch during play),
2. **Frequency of use** (what users adjust most often),
3. **Audible/visible impact immediacy** (what changes are obvious quickly),
4. **MIDI mapping stability** (what must keep stable placement/index).

### Visual hierarchy rules

1. Feature zone should usually be largest visual block.
2. Primary control group should be visually contiguous.
3. Secondary controls must be visually subordinate and moved to Advanced when in doubt.
4. Routing summaries on Main must stay compact and non-edit-heavy.

---

## Interaction rules

1. Header actions are always available and do not move by tab.
2. Tab changes never resize outer module shell.
3. Main interaction paths require minimal clicks (instrument-first behavior).
4. Destructive action (delete) requires safety confirmation pattern.
5. Routing editing controls belong in Routing tab, not Main.
6. Advanced tab may hold less-frequent controls, diagnostics, and engineering-level options.

---

## MIDI-readiness and control stability rules

1. Main controls must keep stable order and semantic meaning across versions.
2. Avoid replacing Main controls with unrelated parameters during incremental changes.
3. If Main control set changes, document migration impact explicitly.
4. Prefer consistent control grouping patterns per family so mapping mental models transfer.
5. Reserve stable control identifiers/slots in implementation planning for future MIDI learn.

---

## Accessibility rules (including daltonic-friendly differentiation)

1. Do not encode meaning with color alone.
2. Use combined cues:
   - shape,
   - position,
   - labeling,
   - grouping,
   - iconography/pattern.
3. State indicators (active/armed/warning) must have non-color affordances (text/state icon/border pattern).
4. Maintain keyboard navigation for tabs and focus-visible affordances.
5. Keep label clarity short and explicit; avoid cryptic abbreviations without nearby context.

---

## Canonical tab responsibilities

### Main

- performance-relevant controls,
- dominant feature visual,
- compact state readouts.

### Routing

- source/target assignment and signal relationships,
- modulation source selection,
- route summaries and route diagnostics.

### Advanced

- secondary/non-performance controls,
- deeper algorithm/engineering parameters,
- optional diagnostics and debug state.

> Note: current implementation uses `Settings` in code. In v1 architecture docs, `Advanced` is the recommended semantic target for future alignment.

---

## Module-family application matrix

## 1) Trigger

- **Dominant visual/feature:** pattern rail/step activity + generator/seed machine readouts.
- **Main priorities:** density, length, immediate rhythm shape controls.
- **Routing:** trigger outputs and modulation-source assignment.
- **Advanced:** subdiv/drop/determinism/weird/algorithm-specific controls.
- **Family distinction:** event-generation first, not timbre shaping.

## 2) Drum

- **Dominant visual/feature:** compact percussive shaping context (transient/body/performance emphasis).
- **Main priorities:** pitch/decay/tone + performance level/pan set.
- **Routing:** trigger input and modulation assignments.
- **Advanced:** snap/noise and less-frequent timbre offsets.
- **Family distinction:** immediate percussive articulation in minimum controls.

## 3) Synth

- **Dominant visual/feature:** timbre/envelope shaping context.
- **Main priorities:** waveform/cutoff/resonance + envelope/performance core.
- **Routing:** trigger input and modulation assignments.
- **Advanced:** secondary envelope/tuning/pan/mod-depth style controls.
- **Family distinction:** continuous tonal shaping versus discrete percussive transients.

## 4) Control

- **Dominant visual/feature:** mode/shape identity + activity meter.
- **Main priorities:** speed/amount/rate (core modulation behavior).
- **Routing:** controlled targets and lane mappings.
- **Advanced:** phase/randomness and secondary controller behavior.
- **Family distinction:** relationship modulation, not direct sound generation.

## 5) Visual

- **Dominant visual/feature:** display canvas (scope/spectrum/pattern) as first-class surface.
- **Main priorities:** view integrity/readability + immediate readout.
- **Routing:** input source and contributors.
- **Advanced:** FFT/mode/config tuning.
- **Family distinction:** monitoring/feedback role, not sound emission.

---

## Do / Don’t guidance

### Do

- Keep Main playable in one glance.
- Keep visual feature zone explanatory.
- Keep Routing focused on relationships.
- Keep Advanced for secondary depth.
- Preserve stable control placement for future MIDI mapping.

### Don’t

- Don’t add placeholder tabs with no meaningful content.
- Don’t overload Main with infrequent controls.
- Don’t move core controls unpredictably between releases.
- Don’t rely on hue-only encoding for critical states.
- Don’t reintroduce mixed layout authority that violates shell contract.

---

## Migration guidance for current modules

1. Keep current shell/header behavior unchanged.
2. Treat existing `Settings` tabs as **Advanced-equivalent** in documentation.
3. When editing a module family:
   - audit Main control count,
   - move overflow to Advanced,
   - ensure Routing contains all route-editing controls,
   - keep compact read-only routing summary in Main only if non-interactive and space-safe.
4. Remove semantically empty secondary panels when possible.
5. Document any control ordering changes due to MIDI-readiness constraints.

---

## Versioning note for this milestone

This document formalizes architectural constraints and interaction grammar. It is a **documentation/architecture milestone**.

Recommended strategy while still pre-1.0:

- Use **minor bumps** for architecture milestones that constrain future implementation behavior.
- Use **patch bumps** for fixes/clarifications with no architecture impact.

If released as a standalone milestone, this work is suitable for a pre-1.0 minor bump. If bundled with larger implementation work later, keep version unchanged now and bump with that release.
