# UI principles

These are the active interface constraints for GRIDI's workspace.

## 1) Fixed module size rule

- Each module occupies one fixed-size grid cell.
- Module surfaces should not change outer footprint between families or tabs.
- Empty cells (add-slots) and occupied cells use the same visual geometry.

Why: stable spatial memory while performing or editing patches.

## 2) No internal scrollbars rule

- Module content should fit the fixed shell.
- Avoid nested/internal scrolling regions in module surfaces.
- If content overflows, split controls across tabs or simplify the face.

Why: preserve instrument feel and avoid mini-app panels.

## 3) Tab behavior

- Tabs swap the active module face inside the fixed shell.
- Tab changes should not resize module cards.
- Main face is for immediate, performance-relevant controls.
- Secondary tabs handle routing/settings and less-frequent controls.
- MAIN/primary tab should stay playable without requiring navigation into setup-heavy flows.

## 4) Main-face philosophy

- Keep the first face compact, legible, and playable.
- Prefer grouped controls with clear musical meaning over long forms.
- Module headers should be preset-first: the preset chip is the primary visible identity, while module family and instance name remain secondary metadata.
- Identity hierarchy is: **engine** (runtime semantics) → **preset** (reusable flavor) → **instance** (local workspace label).
- Show setup/configuration detail only when needed (via tabs).

Why: preserve clear mental models and avoid conflating runtime behavior with UI naming.

## 5) Transport/header philosophy

- Keep transport/header controls minimal and instrument-like.
- Primary transport actions (audio/play/mute/tempo/master/output status) stay immediately reachable.
- Session-level actions (preset management and utilities) should be grouped without dominating workspace focus.
- Header composition should support compact layouts first, including narrow/mobile widths.

## 6) Workspace composition philosophy

- The workspace is a modular grid, not a scrolling dashboard.
- Add/remove actions are local to grid cells.
- Interaction should emphasize patch-building and performance flow, not menu depth.

## 6.1) Stage (scene/worktable) navigation philosophy

- Stages are switchable workspaces inside one session, not separate projects.
- Stage access should stay lightweight and instrument-like (for example a compact header selector/control), not DAW-style tabs or timeline metaphors.
- Switching stages should feel immediate and non-disruptive: no transport interruption and no routing context reset.
- Keep stage controls visually secondary to play controls so workspace navigation does not dominate the instrument surface.
- Stages should reduce clutter by letting performers group modules by musical role while preserving one coherent patch.

Why: support larger live-performance patches without turning GRIDI into a DAW-style shell.

## 7) Module shell expectations

- The shell is fixed-size and deterministic: no per-module card growth based on tab content.
- Identity metadata should stay concise to protect vertical space for playable controls.
- Avoid hidden dependencies where shell state changes runtime behavior indirectly.

Why: shell constraints are part of runtime usability, not only visual styling.

## 8) Shared control and transient-UI policy

- Continuous controls keep direct play on the module face, but precise value entry should open a lightweight floating editor instead of a full inspector.
- If a parameter already supports controller/modulation assignment, that assignment should be reachable from the same floating edit surface when practical.
- Menus and floating panels should clamp to the viewport, flip vertically when needed, and only scroll internally when the viewport truly runs out of space.
- The workspace should always leave at least two visible empty rows below the lowest occupied row so expansion stays legible.
- Keyboard flow must remain first-class: visible focus, Enter/Space activation, arrow-key tab/menu travel where appropriate, and Escape to dismiss transient UI.

Why: preserve a compact instrument surface while keeping editing precise, reachable, and playable.

Cross-reference: [`docs/architecture.md`](architecture.md), [`docs/module-types.md`](module-types.md), [`docs/status.md`](status.md), [`docs/gen-mode-design-principles.md`](gen-mode-design-principles.md).

## 9) Faceplate architecture authority (v1)

- The canonical architecture contract for module faceplates is defined in [`docs/faceplate-architecture-v1.md`](faceplate-architecture-v1.md).
- When there is ambiguity about module-zone composition, Main/Fine-tune/Routing responsibilities, or control density priorities, the v1 faceplate architecture document is authoritative.
- Current implementation naming may still use `Settings` in code paths; architecture guidance treats this as the Advanced-equivalent until code alignment is scheduled.


## 10) Control grid grammar authority

- Canonical faceplate grammar is based on a 4-row × 6-column mental model where practical.
- Main should expose up to 6 controls per row and remain performance-forward.
- Fine-tune should use the same 6-column rhythm and generally fit inside the 4×6 base grammar without internal scrolling.
- Prefer horizontal distribution/grouping over narrow vertical strips when shell width is available.

Why: preserve visual consistency, hardware-like density, and cross-family predictability.

Reference: [`docs/control-grid-spec.md`](control-grid-spec.md), [`docs/module-layout-spec.md`](module-layout-spec.md).

## 11) Semantic display requirement

- Module display surfaces are semantic behavior layers, not decorative scopes.
- Displays should communicate module-specific runtime behavior and parameter impact.
- GEN and DRUM establish the baseline: algorithm-state visualization and behavior-coupled drum synthesis visualization.
- VISUAL-family analyzer growth (including time-sensitive spectrogram direction) must remain module-scoped and performance-legible, not DAW-style detached analysis tooling.
- GEN display contract:
  - Displays are behavior surfaces, not decorations.
  - Every moving element must be tied to pattern phase, scheduler time, generated events, or mode state.
  - Every major control should have a visible consequence when practical.
  - If a mode cannot yet display its real algorithm truthfully, prefer a simple honest readout over fake complexity.
  - GEN displays should map to real generator state, scheduler phase, event output, or honest minimal placeholders.
  - Visual beauty is welcome, but it should emerge from structural truth.
  - RADAR semantics: directional rotating scan with angle/time-based detection.
  - SONAR semantics: radial pulse system with distance/time-based detection.
  - Different metaphors must map to different behaviors (do not relabel one algorithm as another).
  - RADAR and SONAR are separate semantics: RADAR = rotating scan; SONAR = pulse/echo propagation.

Reference: [`docs/ui-faceplate-grammar.md`](ui-faceplate-grammar.md), [`docs/gen-mode-design-principles.md`](gen-mode-design-principles.md).

## 12) Canonical module faceplate rule (current)

- Header `[type][preset][on/off]`
- Dominant display surface
- 6-column primary controls
- Tabs `Main / Fine-tune / Routing`
- Footer status tokens

This is the active canonical layout contract for future modules.

## 13) Stage UX constraints

- Stages are for layout segmentation and performance navigation only.
- Do not introduce mixer-panel, arrangement-page, or tabbed-DAW interaction patterns under the stage concept.
- Preserve module identity/faceplate grammar across stages; stage context should not alter module shell rules.
- No internal scrolling/layout hacks should be introduced to emulate stage behavior.
