# Canonical module faceplate grammar

This document defines the current module design grammar used by Trigger, Drum, Synth, Control, and Visual modules.

## Shared shell contract (cross-family, stable)

All modules share the same shell structure. This shell is common; each module face layout inside it is module-specific.

1. **Header row**
   - module type chip,
   - preset chip,
   - right-side action area (action contents can vary by module and state; not fixed to one static button set).
2. **Top feature/meta row (optional)**
   - compact mode/readout metadata lane when needed.
3. **Main visualization area (module-specific)**
   - primary reactive visual surface.
4. **Control area (module-specific)**
   - performance controls and shaping controls.
5. **Tabs (temporary / optional future removal)**
   - currently used for secondary surfaces and organization.
6. **Bottom status/info strip**
   - stable bottom strip for module ID/state/status cues.

Shell dimensions and row heights are fixed by canonical shell tokens in `src/ui/style.css`.

## Shell vs face distinction (required interpretation)

- **Shared shell** = stable outer composition grammar and vertical order.
- **Module-specific face layout** = the inner arrangement of metadata, visualization, and controls.
- Do not treat one module's inner face as a universal template.
- Family identity is carried by face structure and behavior, not just labels.

## Faceplate section primitives

All families compose tab content with shared section primitives:

- `.faceplatePanel`: base panel wrapper
- `.faceplateMainPanel`: canonical Main tab panel
- `.faceplateStackPanel`: canonical Routing/Settings stack panel
- `.faceplateSection--io`: compact summary/IO strip
- `.faceplateSection--feature`: primary visual/generator/mode block
- `.faceplateSection--controls`: primary control grid/rows
- `.faceplateSection--secondary`: optional secondary control strip
- `.faceplateSection--bottom`: bottom strip anchored to remain visible

Spacing rhythm uses shared tokens only:

- `--faceplate-gap-xs: 4px`
- `--faceplate-gap-sm: 8px`
- `--faceplate-gap-md: 12px`

## Tab responsibilities

- **Main**: compact IO summary (optional), family primary feature block, playable controls, anchored bottom strip where applicable.
- **Routing**: source/target assignment and connectivity-specific editing only.
- **Advanced** (current code label: `Settings`): secondary controls only; avoid empty placeholders.

For the full canonical rule set (zones, density limits, accessibility, and module-family matrix), see [`docs/faceplate-architecture-v1.md`](faceplate-architecture-v1.md).

## Drum module (reference implementation, not universal)

Drum is the current **reference implementation** for compact family-specific face behavior:

- envelope visualization,
- right-side feature lane,
- compact `2x4` control grid,
- red family identity,
- compact performance-first layout.

Important: Drum is a reference for quality and compactness, **not** a universal face template for every family.

## Trigger module design brief

Trigger follows the shared shell while using a distinct face layout.

### Header

- type chip,
- preset chip,
- right-side actions.

### Meta row

- `GEN` mode pill,
- editable `SEED` field,
- separate randomize button,
- routing pill (designed for future multi-destination behavior).

### Large reactive display

Mode-dependent visualization that updates from generator state:

- `STEP` → step/grid pattern view,
- `CA` → game-of-life-style cellular field view,
- `FRACTAL` → vector/fractal contour view,
- `HYBRID` → mixed/composite mode view.

The display must react to:

- seed,
- mode,
- active generator parameters.

### Control row

- four carefully selected performance knobs (mode-dependent emphasis allowed, count remains constrained).

### Tabs

- tabs remain temporary and may be reduced/removed later if shell simplification continues.

### Bottom status

- uses the same bottom status strip grammar as other module families.

## Seed interaction model

Trigger seed behavior is explicit and instrument-like:

- seed field is editable,
- randomize is a separate direct action,
- seed drives visualization output,
- seed also drives generator output.

The UI must keep this relationship legible (same seed, same pattern character when other relevant parameters are unchanged).

## Visualization philosophy

Visualizations are **not decorative**. They are primary feedback surfaces that reflect generator/module state.

Examples:

- Drum → envelope response and percussive behavior cues,
- Trigger → pattern/generator state visualization,
- Synth → waveform/contour style readout (future-facing direction).

## Module color identity families

Canonical family color identity:

- Drum = red
- Trigger = purple
- Synth = blue
- Control = cyan
- Visual = amber

These color families are used for:

- knob rings,
- display accents,
- active tab indication,
- module highlights.

Accessibility rule remains unchanged: color is supportive, never the only state signal.

## Design references and intent

Inspiration references:

- Yamaha Tenori-on
- Korg Electribe ER-1
- Korg Electribe EA-1

Design goals:

- instrument-like UI behavior,
- reactive visualization as core feedback,
- grid-based generative interaction,
- minimal but expressive control sets.

## Family application notes

- Trigger: Main = IO/meta summary + generator/readout feature + playable rhythm controls + anchored bottom rack.
- Drum: Main prioritizes tone/performance controls; secondary Snap/Noise moved to Settings.
- Synth: Main prioritizes timbre/envelope/performance controls; secondary Mod depth moved to Settings.
- Control: Main = compact target summary + mode/shape + core shaping knobs + bottom meter.
- Visual: Main prioritizes display canvas/readout; routing complexity remains in Routing.
