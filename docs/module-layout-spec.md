# Module Layout Specification

This spec captures the current layout language after GEN + DRUM refinements and defines canonical structure for future modules.

## Canonical shell layout

```text
[Header]
  type chip | preset chip | on/off (+ actions)

[Main tab body]
  (optional meta row)
  semantic display surface
  primary controls (6-col row grammar)

[Tabs]
  Main | Routing | Advanced

[Footer]
  status tokens
```

## Zone responsibilities

## 1) Header

- Fixed thin row.
- Identity + preset-first operation.
- Immediate power state access.

## 2) Display surface

- Dominant visual region.
- Must visualize behavior semantics, not generic decoration.
- Must track parameter changes in ways users can interpret.

## 3) Primary controls (Main)

- Up to 6 controls per row.
- At most 2 rows.
- Performance-first parameter selection.

## 4) Routing tab

- Connection editing and source/target semantics.
- Route summaries and routing chips/cards.
- No unrelated synthesis internals.

## 5) Advanced tab

- Internal synthesis/algorithm controls.
- Dense 6-column matrix, up to 4 rows.
- Inline headers only; no boxed subgroup cards.

## 6) Footer

- Tokenized compact status line.
- Typical tokens: module id, active/bypass, mode/meta summary.

## DRUM module language

### Main

- 2 rows × 6 controls (12 controls total).
- Performance-oriented shaping set.
- Behavior display at top of Main.

### Advanced

- Synthesis internals grouped by inline headers.
- Compressor / drive / stereo / behavior-oriented parameters.
- 6×4 matrix grammar.

### Display semantics

- Envelope and transient contour
- Compression contour interaction
- Noise texture layer
- Tone tilt indicator
- Pan/spatial marker

**Philosophy:** Drum is a **full synthesizer voice**, not a fixed drum macro.

## GEN module language

### Main

- Display-first layout.
- 6 controls under display.
- Mode-dependent control mapping.
- Short mode labels (`SSEQ`, `EUC`, `CA`, `FRACT`, etc.).
- Inline routing chip in the meta lane.

### Routing + Advanced

- Routing tab handles output and modulation relationships.
- Advanced tab carries deeper generator internals.

**Philosophy:** Generator is a **behavior engine**, not only a sequencer.

## New module acceptance checklist

A new module layout is compliant only if it:

- Uses canonical header + tabs + footer composition.
- Uses a semantic display surface.
- Uses 6-column control grammar in Main and Advanced.
- Keeps Main performative and compact (≤2 rows).
- Uses Routing for connections and Advanced for internals.
