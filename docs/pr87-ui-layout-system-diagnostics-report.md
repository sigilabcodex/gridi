# PR87 — UI Layout System Diagnostics Report

## Summary

This PR is a diagnostics-only audit of the current UI layout system. No layout rewrite was performed.

Core finding: the current regressions are not from a single bug; they come from **layered, conflicting layout authorities** (especially in `src/ui/style.css`) plus **mixed composition models** (fixed-height shell + flex/grid content + family-level overrides), with no enforced single canonical contract for Main/Routing/Settings composition.

## Files inspected

### Required docs read first
- `README.md`
- `ROADMAP.md`
- `docs/status.md`
- `docs/ui-principles.md`
- `docs/module-types.md`

### Additional relevant docs
- `docs/module-shell-stability-and-tab-policy.md`
- `docs/module-family-surfaces.md`
- `docs/ui-audit-current-state.md`

### Implementation files inspected
- `src/ui/app.ts`
- `src/ui/render/moduleGrid.ts`
- `src/ui/moduleShell.ts`
- `src/ui/style.css`
- `src/ui/triggerModule.ts`
- `src/ui/voiceModule.ts`
- `src/ui/controlModule.ts`
- `src/ui/visualModule.ts`
- `src/ui/header/transportHeader.ts`
- `src/ui/ctl.ts`
- `src/ui/floatingPanel.ts`
- `src/ui/state/voiceTabs.ts`

## Current layout architecture map

### 1) Shell size + vertical budgeting source of truth (current state)

**Nominal shell authority (intended):**
- CSS custom properties and grid shell rules in `src/ui/style.css`:
  - `--module-cell-w`, `--module-cell-h`, `--module-header-h`, `--module-tabs-h`, etc.
  - `.moduleSurface { grid-template-rows: var(--module-header-h) minmax(0, 1fr) var(--module-tabs-h) }`
  - `.moduleCell` fixed width/height + `overflow: hidden` constraints.

**Runtime geometry authority (actual):**
- `src/ui/render/moduleGrid.ts` computes visible columns from CSS vars (`--module-cell-w`, `--workspace-grid-gap`, `--workspace-grid-pad`) and viewport width, then sets `--workspace-visible-columns` / `--workspace-render-columns` dynamically.
- Grid renderer wraps layout in `.workspaceViewport` (horizontal scroll container) and `.workspaceGrid` (fixed-column track template).

**Reality:** shell authority is split across multiple repeated CSS passes in `style.css` that redefine the same variables/selectors later in the file.

### 2) Main face composition authority

- **Shared tab shell and panel hiding**: `createModuleTabShell()` in `src/ui/moduleShell.ts`.
- **Family composition factories**:
  - Trigger: `renderTriggerSurface()` (`src/ui/triggerModule.ts`)
  - Drum/Synth: `renderDrumModuleSurface()` + `renderSynthModuleSurface()` (`src/ui/voiceModule.ts`)
  - Control: `renderControlSurface()` (`src/ui/controlModule.ts`)
  - Visual: `renderVisualSurface()` (`src/ui/visualModule.ts`)

Composition strategy differs per family (different control counts, summaries, route cards, panel grids), but all are inserted into the same fixed shell.

### 3) Tab layout authority

- Tab interaction/ARIA logic: `createModuleTabShell()`.
- Tab persistence for voices only: `createVoiceTabsState()` stores Drum/Synth tab state by module ID; Trigger/Control/Visual default to Main on each render.
- Tab panel visibility via `.hidden` class toggling.

### 4) Shared control row / knob / value layout authority

- `ctlFloat()` in `src/ui/ctl.ts` produces either knob or slider controls and optional floating editor.
- Knob/row density set almost entirely in `src/ui/style.css` (`.knobCtl`, `.voiceControlGrid`, `.triggerPulseRack`, `.moduleKnobGrid`, `.controlMainKnobGrid`, etc.), repeatedly redefined.

### 5) Transport/header composition authority

- DOM structure in `createTransportHeader()`:
  - `transportRowMain` with `transportZoneIdentity`, `transportZoneCenter`, `transportZoneRight`
  - clusters: primary controls, tempo/master, session/actions, status/output, settings.
- CSS authority is split between older grid-based header rules and newer flex-zone overrides, both present in the same file.

## Root causes found

### Root cause 1 — Multiple CSS authorities in one file, with late-pass overrides

`src/ui/style.css` contains many “pass” blocks (`polish`, `rescue`, `final authority`, `PR86`, etc.) that redefine the same selectors and variables later in cascade order.

Consequences:
- A local tweak can unintentionally re-activate or suppress earlier assumptions.
- Developers read one block and think it is authoritative while a later block silently wins.
- Regressions appear when changing one family because shared selectors are globally redefined elsewhere.

### Root cause 2 — Mixed layout paradigms inside fixed-height cells

The shell is fixed-height, but panel internals mix:
- grid rows with `minmax(0, 1fr)`
- flex column regions
- family-specific `min-height` blocks
- bottom alignment via `.surfaceMainBottom`

This creates fragile vertical budgeting. Small changes to gaps/label heights/control widths cause bottom-row clipping or overlap in certain families/viewport widths.

### Root cause 3 — Family implementations are “shared shell + local geometry contracts” without one strict grammar

Each family builds Main differently:
- Trigger: rail + dynamic step grid + bottom rack.
- Voice: summary strip + primary grid + bottom strip.
- Control: type row + knob grid + meter.
- Visual: canvas-dominant region + readout.

Because these contracts are not normalized into one formal faceplate grammar (e.g., explicit budget tokens per zone), family-specific changes have cross-family side effects when shared spacing changes.

### Root cause 4 — Main / Routing / Settings boundaries are policy-driven in docs but not structurally enforced in code

Docs specify separation principles, but module code still includes mixed concerns:
- Main includes routing summaries/chips in every family (partial routing presence on Main is expected but currently unconstrained).
- Some Settings panels are placeholder-thin (e.g., “No secondary controls”) yet still consume full tab structure.
- Routing panels vary in depth/semantic scope by family.

Result: tab responsibilities bleed because there is no hard “what must not appear in Main” rule at component level.

### Root cause 5 — Transport/header has legacy + current composition layers coexisting

Header DOM now uses zone-based structure, but CSS still carries earlier transport grid assumptions and multiple responsive rewrites.

Result: partial improvements with continued instability under medium/narrow widths (clusters reflow inconsistently, weight distribution changes abruptly).

### Root cause 6 — Structural noise from placeholder or semantically thin sections

Some tabs/controls exist structurally but add little semantic value (especially Settings in voice modules). This increases layout pressure and cognitive noise without payoff, making regressions appear “random” when only spacing changes.

## Rule conflicts found

1. **Root variable conflicts** in `:root` for shell sizing (`--module-cell-h`, header/tabs heights) defined repeatedly across the file; last definition wins.
2. **`.moduleSurface` conflicts**: declared as flex in one section, grid in another, then repeatedly adjusted for padding/rows/overflow.
3. **`.surfaceFace` conflicts**: declared as flex in some passes, grid in others, then panel child set to flex again in PR86 block.
4. **`.surfaceTabPanel` conflicts**: margin/padding/overflow/gap/height rules are repeatedly overridden (`margin-top` toggles between `0` and `6px`; display toggles grid/flex assumptions).
5. **`.triggerPulseRack` conflicts**: column count appears as 6, 4, then 3 across passes.
6. **`.controlBody` conflicts**: defined as multi-column grid in earlier rules, then converted to row-stacked one-column main layout later.
7. **`.transportRowMain` conflicts**: first grid-template columns, later force-overridden to flex row with zones.
8. **Mobile header conflicts**: multiple `@media (max-width: 760px)` blocks from older `.transportGroup*` structures coexist with newer `.transportZone*` rules.
9. **Shared selector vs family override conflicts**: common `.utilityPanel`, `.moduleKnobGrid`, `.voiceControlGrid` rules are globally redefined while family modules assume specific local geometry.
10. **Component-vs-CSS assumption mismatch**: module builders assume stable zone budgets (summary/feature/controls/bottom), while CSS frequently retunes gaps/padding/grid columns globally.

## Main / Routing / Settings responsibility audit

### Trigger
- **Main should contain:** generator mode/seed, pattern/pulse readout, performance-critical rhythm controls.
- **Routing should contain:** outgoing voice targets, modulation sources.
- **Settings should contain:** algorithm-specific secondary params (Euclid/CA/gravity).
- **Current violation:** Main still carries routing summary strip (helpful but unconstrained), and Settings remains compact but can become crowded if tuning expands.

### Drum
- **Main should contain:** core voice shaping + performable level/pan.
- **Routing should contain:** trigger source + modulation assignments.
- **Settings should contain:** true secondary behavior (currently mostly empty).
- **Current violation:** Settings tab is semantically thin (“No secondary controls”), while Main and Routing already hold nearly all meaningful content.

### Synth
- **Main should contain:** core timbre/envelope performance controls.
- **Routing should contain:** trigger + modulation mapping.
- **Settings should contain:** secondary/non-performance controls.
- **Current violation:** same as Drum — Settings is largely structural placeholder.

### Control
- **Main should contain:** kind/wave + speed/amount/rate + immediate output meter.
- **Routing should contain:** targets overview and assignment context.
- **Settings should contain:** phase/randomness and less-frequent controls.
- **Current violation:** acceptable split overall, but routing summary also shown on Main; this is okay if formalized as a “compact IO strip” rule.

### Visual
- **Main should contain:** visualization surface and immediate readout.
- **Routing should contain:** input source and contributor summary.
- **Settings should contain:** display/FFT options.
- **Current violation:** mostly clean split; minimal issue is that Routing content can become descriptive-heavy relative to compact shell height.

## Redundant or dead UI structures

1. **Voice Settings tab (Drum/Synth) currently low-value**: mostly “No secondary controls.”
2. **Placeholder utility actions in header menu** (`Randomize selected (soon)`, `Randomize groups (soon)`, `Save As (soon)`) consume UI surface without immediate utility.
3. **Excessive duplicate style blocks** in `style.css` act as dead/latent structure: many earlier rules are effectively superseded yet still active as maintenance hazards.
4. **Repeated “summary in Main + full Routing tab” without strict policy** creates partial duplication noise (not duplicate controls, but duplicate relationship information).
5. **Legacy transport class ecosystem remnants** (`transportGroup*` mobile rules) appear structurally stale against current `transportZone*` header anatomy.

## Recommended corrective order

1. **Establish single CSS authority file section (or split files) for shell contract first.**
   - Freeze canonical tokens and selectors for cell/shell/header/tabs.
   - Remove superseded duplicate blocks.

2. **Lock a formal vertical budget contract for module faces.**
   - Define explicit zone budgets (IO strip, feature, controls, bottom row) and allowed growth behavior.
   - Enforce family conformance with shared helper classes.

3. **Normalize Main/Routing/Settings policy with hard component rules.**
   - Keep Main minimal playable + optional compact IO strip only.
   - Move all editable routing controls to Routing.
   - Remove or collapse empty Settings tabs.

4. **Family-by-family normalization pass against the shared faceplate grammar.**
   - Trigger, Drum, Synth, Control, Visual each mapped to same composition primitives with family-specific content only.

5. **Transport/header consolidation pass after module shell is stable.**
   - Remove legacy transport class paths and keep one responsive strategy (zone-based).

6. **Viewport truth pass (wide, medium, narrow, mobile) with explicit acceptance snapshots.**
   - Validate mixed-family patches and freeze spacing tokens with regression checks.

7. **Optional follow-up: lightweight UI layout regression harness.**
   - Screenshot assertions for representative patches/viewports to stop spacing regressions from recurring.

## Testing / verification performed

### Static/code-path verification
- Verified module shell geometry path (`moduleGrid.ts` + CSS vars + fixed cell shell).
- Verified tab-shell behavior (`moduleShell.ts`) and voice-tab persistence (`voiceTabs.ts`).
- Verified family render compositions for Trigger/Drum/Synth/Control/Visual.
- Verified transport DOM composition and floating menu positioning logic.

### Viewport behavior assessment (wide/medium/narrow/mobile)
This audit is based on code/CSS-path analysis (media queries + column calculations + shell constraints), not a browser visual capture in this PR.

- **Wide desktop:** multi-column fixed-cell grid with side-gutter centering via runtime measurement.
- **Medium desktop:** transition region where header cluster distribution can shift due to competing grid/flex transport rules.
- **Narrow desktop:** workspace becomes horizontally scroll-driven with reduced visible columns; shell remains fixed but internal density depends on final CSS overrides.
- **Mobile portrait/landscape:** specialized column limits in `moduleGrid.ts` + multiple transport media-query layers; highest risk area for cascade conflicts.

### Mixed patch coverage intent
Inspected code paths for mixed-family patches containing Trigger, Drum, Synth, Control, Visual; all families share fixed-cell shell but carry different internal layout contracts, confirming the cross-family regression mechanism.

## Intentional non-changes

- No broad CSS rewrite.
- No module renderer redesign.
- No transport/header redesign.
- No audio/routing/scheduler/schema changes.
- No dependency additions.

This PR intentionally provides diagnosis and corrective sequencing only.
