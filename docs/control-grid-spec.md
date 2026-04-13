# Control Grid Specification

This document defines the canonical control-placement grammar for module faces.

## 1) Primary control grid (Main)

- Grid width: **6 columns**.
- Capacity: **up to 6 controls per row**.
- Row count: **max 2 rows** on Main.
- Knob geometry: shared size and spacing tokens.
- Alignment: controls should align horizontally with stable slots.

```text
Main row example
[1][2][3][4][5][6]

Optional second row
[7][8][9][10][11][12]
```

### Main-grid rationale

- Preserves readable rhythm across module families.
- Improves muscle memory and controller mapping predictability.
- Avoids “column drift” and ad hoc per-module spacing.

## 2) Advanced control grid

- Grid width: **6 columns**.
- Height: **up to 4 rows**.
- Pattern: dense matrix layout (analog-face style).
- Grouping rule: no bordered boxes/cards around subgroups.
- Sectioning rule: inline text headers above column regions.

```text
Advanced matrix example
      COMP      DRIVE   STEREO BEHAV
R1: [ ][ ][ ][ ][ ][ ]
R2: [ ][ ][ ][ ][ ][ ]
R3: [ ][ ][ ][ ][ ][ ]
R4: [ ][ ][ ][ ][ ][ ]
```

## 3) Zone semantics for controls

- **Main controls:** performative, high-frequency interaction.
- **Routing controls:** signal/source-target relations.
- **Advanced controls:** internals, deeper shaping, engineering-level parameters.

## 4) Display relationship to control grids

Display is a semantic layer tied to control changes:

- Controls drive behavior.
- Display communicates resulting behavior.
- Grid + display must feel like one instrument surface.

## 5) Future module requirements

All future modules must:

1. Use 6-column control grids.
2. Match shared knob sizing.
3. Keep Main to max two rows.
4. Include semantic display feedback.
5. Avoid vertical stack-only control layouts.
6. Keep Routing and Advanced semantics separated.
