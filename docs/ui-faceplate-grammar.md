# UI Faceplate Grammar (GEN + DRUM era)

This document formalizes the current canonical faceplate grammar as implemented in `triggerModule.ts` (GEN) and `voiceModule.ts` (DRUM), with shared shell primitives from `moduleShell.ts`, `faceplateSections.ts`, and shared CSS tokens/layout rules in `style.css`.

## 1) Canonical module anatomy

All modules should follow this vertical structure:

1. **Header**: `[module type] [preset] [on/off + actions]`
2. **Display surface**: dominant semantic visual area
3. **Primary controls**: performance controls, 6-column grammar
4. **Tabs**: `Main / Routing / Advanced`
5. **Footer**: thin status token strip

```text
┌─────────────────────────────────────┐
│ HEADER: [TYPE] [PRESET] [ON/OFF]   │
├─────────────────────────────────────┤
│ DISPLAY SURFACE (semantic behavior) │
├─────────────────────────────────────┤
│ MAIN CONTROLS (6 columns)           │
│ [○][○][○][○][○][○]                  │
├─────────────────────────────────────┤
│ TABS: Main | Routing | Advanced     │
├─────────────────────────────────────┤
│ FOOTER TOKENS: ID · STATE · META    │
└─────────────────────────────────────┘
```

## 2) Control grid standard

### Primary control area (Main)

- Use **up to 6 controls per row**.
- Use **uniform knob size** and shared spacing rhythm.
- Controls are horizontally aligned in a stable row grammar.
- Main should avoid vertical stacks and avoid more than **2 rows**.

### Advanced panel

- Use a **6-column matrix**.
- Allow up to **4 rows** where needed.
- Use dense, analog-style placement.
- **No boxed grouping blocks** in the matrix itself.
- Use **inline section headers** (text labels over column regions), not card containers.

Why this standard exists:

- **Visual consistency** across families.
- **Hardware-like density** without dashboard sprawl.
- **Predictable scaling** as parameter counts increase.
- **Cross-module coherence** so muscle memory transfers.

## 3) Display surface role (non-decorative)

Display surfaces are not generic ornamentation. They are semantic behavior surfaces.

### Not

- Decorative filler.
- A generic oscilloscope slapped onto every module.

### Required role

- Module-specific behavior visualization.
- Parameter-feedback layer that reacts to meaningful edits.
- Immediate explanation of “what this module is doing now.”

Examples:

- **DRUM**: envelope contour, compressor behavior, noise layer, tone tilt/tint, pan spatial indicator.
- **GEN**: algorithm/mode state display, sequencer matrix, fractal contour, Euclidean circle.

## 4) Shared faceplate rules

### Header

Canonical identity row: `[module type] [preset] [on/off]` with optional actions (e.g., remove).

### Display

Dominant area in Main; should remain the visual anchor when module semantics support it.

### Primary controls

6-column grammar, stable positions, consistent knob geometry.

### Tabs

Canonical responsibilities:

- **Main** = performance controls.
- **Routing** = signal/source-target editing.
- **Advanced** = deeper internal synthesis/algorithm parameters.

### Footer

Status tokens in a thin strip (module id, enabled/bypass state, mode or transport/meta state).

## 5) Control semantics by zone

- **Main**: performative and frequently touched controls.
- **Routing**: connection semantics only.
- **Advanced**: internals and less-frequent shaping.
- **Display**: visual semantic feedback; no hidden runtime authority.

## 6) Future module requirements

All new modules must:

1. Follow a **6-column control grid**.
2. Provide a **semantic display surface** tied to module behavior.
3. Use shared knob sizing conventions.
4. Use the shared footer token pattern.
5. Avoid vertical control-stack layouts on Main.
6. Keep Main to at most **2 control rows**.

## 7) Design philosophy summary

- GRIDI modules should read like compact instrument faceplates, not micro-app forms.
- DRUM and GEN now establish the grammar baseline for density, semantic display, and tab responsibility.
- The objective is expressive depth with stable learnability.
