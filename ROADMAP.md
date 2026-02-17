# GRIDI — Complete Roadmap

## + Architectural Pillars

*(Checkpoint: v0.32-dev)*

---

# 🧭 North Star (Identity)

**GRIDI = a generative rhythmic instrument**  
(controlled indeterminacy + non-musical mathematics + human interaction)

Everything else (synthesis, visuals, FX) serves rhythm.

This is not a drum machine.  
It is an instrument.

---

# 📍 Current State (Already Implemented)

## Engine / Patch

- Per-voice look-ahead scheduler ✅

- Modes: hybrid / step / euclid / CA / fractal (proto) ✅

- Seed separated from pitch in percussive voices ✅

- Core generative parameters  
  (determinism / density / gravity / drop / weird / rot / ca...) ✅

- Patch v0.3 using dynamic `modules[]` architecture ✅

- Dynamic voice creation + visual modules (add-slot ghost tile) ✅

- Master gain / mute integrated (engine + UI) ✅

- Bank persistence (import/export JSON) ✅

---

## UI / UX

- Fully dynamic modular grid (no fixed 8 voices) ✅

- Add-slot ghost tile working ✅

- Undo / Redo system ✅

- Visual modules (Scope / Spectrum) functional ✅

- Stabilized CSS + coherent aesthetic ✅

- Sticky glass header with global controls ✅

- Settings + Welcome modal functional ✅

- Unified control system (`ctlFloat`) ✅

- Responsive controls (desktop knobs / mobile sliders) ✅

- Centered pan control (0 at 12 o’clock) ✅

- Per-voice seed regeneration button (↻) ✅

- UI tab separation: MAIN / SEQ / MIDI ✅

---

# 🧠 Strategic Position

We are currently transitioning from:

**v0.31 → v0.32 (Structural Evolution)**

The conceptual separation between:

- Timbre (MAIN)

- Sequencing / Generation (SEQ)

- Connectivity (MIDI)

is now active at the UI level.

This is an architectural milestone.

---

# 🏗 The 3 Architectural Pillars

These are not features.  
They are design rules that prevent future architectural collapse.

---

## Pillar 1 — Module Anatomy (Pluggable Contract)

Rule:

> A module is a connectable unit.

Inspired by audio modules or "guitar pedals".

Proposed TypeScript interface:

`interface GridiAudioModule {  input?: AudioNode;  output?: AudioNode;  connect(dst: GridiAudioModule | AudioNode): void;  disconnect(): void;  dispose(): void; }`

Separation principle:

- `GridiAudioModule` → lives inside AudioContext

- `GridiControlModule` → UI / Pattern / Terminal / Visual logic

Status:

- Dynamic `modules[]` implemented ✅

- Conceptual separation underway

- Complex routing not yet introduced

---

## Pillar 2 — Precise Clock (Look-Ahead Scheduling)

Rule:

> Never trigger sound directly from UI timing.

Model:

- Fast loop (~25ms)

- Schedule ~100ms ahead

- Use `AudioContext.currentTime`

- Program with `start(exactTime)` + ramps

Status:

- Per-voice scheduler working ✅

- Dedicated `Clock + Transport` abstraction pending

Future unlocks:

- MIDI clock in/out

- Polyrhythmic structures

- External clock follow

---

## Pillar 3 — Instrumental Envelopes

Rule:

> No the usual drumbox sounds.

- Gain envelope (ADSR or ADR)

- Pitch envelope for kicks

- Native WebAudio ramps

- Centralized envelope helpers (`env.ts`) ✅

Status:

- Utility layer created

- Expansion planned for tonal synthesis

---

# 🚀 Version Roadmap

---

## v0.30 — Modular Awakening ✅

- Stable modular UI

- Reproducible patch system

- Settings + Welcome

- Undo / Redo

- Bank management

- Sticky glass header

- Visual modules

Foundation complete.

---

## v0.31 — Core Reinforcement (in progress)

Goal: reinforce internal structure.

### Architecture

- Module lifecycle management

- GenericParam system

- Dedicated Clock service

- Formalized look-ahead scheduler

- Envelope utility class

- MIDI Manager v0

### UI Refinement

- Keyboard shortcuts

- Settings restructuring

- Responsibility cleanup

---

## v0.32 — Structural Evolution (Current Phase)

Goal: Separate sequencing from timbre.

### Implemented

- MAIN / SEQ / MIDI tab structure ✅

- Per-voice seed regeneration ✅

- Responsive control system ✅

- Reduced visual density per module ✅

### In Progress

- Formal PatternModule

- `patternSource: "self" | moduleId`

- Visualizers linked to SEQ logic

- Future drag & drop extraction of SEQ

Embracing digital over simulated controls rule:

> No patch cables yet. Only source selection.

---

## v0.4 — Performance & Routing

- Explicit `connections[]` in patch

- Voice → FX → Bus → Master routing

- Send architecture

- FX modules (drive / delay / filter / bitcrush)

- MIDI OUT

- Clock OUT

- Performance visuals

---

## v0.5 — Generative Ecosystem

- True Markov engine

- Patch morphing A → B

- Mutation / breeding

- Self-evolving sessions

- Advanced live terminal

- Community preset exchange

- Algorave mode

---

# 📌 Key Decision

## Separation of SEQ from Voice

Phase 1 (now):

- Visual separation in UI

- Voice consumes its own generator internally

Phase 2 (v0.32 formalization):

- Independent PatternModule

- `patternSourceId`

- Drag & drop extraction possible

Benefits:

- Cleaner voices

- More space for synthesis

- Meaningful visualizations

- Future scalability without immediate routing complexity

---

# 📦 Backlog

- OSC (Node/WebSocket bridge)

- Performance terminal

- Educational visualizations

- Themes

- Localization

- Reactive background toggle

- Data export

- Licensing

- Dedicated README

- Formal dedication section

- Settings redesign
