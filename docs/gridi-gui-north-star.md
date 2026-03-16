# GRIDI GUI North Star

This document defines the visual and interaction direction for GRIDI’s workspace UI.
It is the decision baseline for GUI architecture, component design, and PR review.

If a change improves internal code structure but users still perceive “the same old tabbed card interface,” it is not a GUI success.

---

## 1) Product feeling

GRIDI should feel like a **playable modular instrument laid out in space**, not a settings app.

### Intended experiential identity

- **Modular**: each module is a self-contained unit with a predictable physical footprint.
- **Musical**: structure implies timing, trigger behavior, tonal behavior, and signal flow.
- **Spatial**: position in the grid is meaningful; users should build understanding through location memory.
- **Disciplined**: composition follows strict laws; freedom comes from arrangement and connection, not arbitrary UI forms.
- **Contemporary**: typography, spacing, and interaction states are crisp, minimal, and legible at performance speed.
- **Tactile**: modules feel like playable surfaces with immediate controls, not abstract records.
- **Legible**: role and state are obvious in <1 second.
- **Experimental but not chaotic**: unusual modules can exist, but they must obey the same spatial grammar.

### Perception target

A first-time user should think:

> “This is a modular performance grid where each block has a role,”

not:

> “This is a dashboard of similar cards with tabs.”

---

## 2) What GRIDI is not

GRIDI must not regress into any of the following:

- **Not a generic dashboard** with panels competing for attention.
- **Not a card admin panel** where each block is a near-identical container with different labels.
- **Not a tab-first inspector** where identity is hidden behind tab headers.
- **Not a patchwork of unrelated widgets** with inconsistent spacing, control styles, and behavior.
- **Not legacy voice-card UI with new internals** (architecture migration without perceptual shift).

### Explicit anti-regression statement

Architecture changes do not count as GUI success unless perception changes too.

---

## 3) Core visual laws

These are non-negotiable. Breaking them requires an RFC-level decision.

### 3.1 Fixed module footprint

- Modules must keep a **consistent footprint** in the main grid.
- Width and height classes are constrained to a small explicit set (e.g., single-cell, double-cell), never arbitrary per module.
- “Special” modules still conform to grid metrics and snap rules.

### 3.2 Intentional empty cells

- **Empty grid cells are part of the interface and must be intentional.**
- Empty cells preserve rhythm, aid scanability, and communicate growth paths.
- Do not auto-fill all gaps with secondary UI or decorative placeholders.

### 3.3 Stable grid proportions

- Cell dimensions, gutters, and row rhythm must remain stable across module families.
- Responsive behavior may reduce columns but must preserve module scale logic and spacing hierarchy.

### 3.4 Strong hierarchy

- Primary: module role, module title, immediate playable controls, live state.
- Secondary: fine tuning, diagnostics, rarely changed options.
- Tertiary: debug and development metadata.
- Primary information must be visible without opening tabs or drawers.

### 3.5 Restrained visual language

- Use minimal color accents to encode state and family, not decorate.
- Avoid nested borders, heavy gradients, or multiple competing shadows.
- Keep a single elevation logic for hover/selection/drag states.

### 3.6 Advanced controls are secondary

- Advanced controls must not dominate default surfaces.
- Advanced controls may live in expandable sub-panels, contextual popovers, or secondary inspector layers.
- Main surfaces must preserve role clarity and playability first.

---

## 4) Module family doctrine

Family identity must come from **structure and control topology**, not only color/icon swaps.

Tabs are secondary and must not define module identity.

### 4.1 Trigger modules

Structural grammar:
- Emphasize **event patterning** (steps, lanes, probability, timing offsets).
- Primary surface exposes trigger cadence and gate behavior immediately.
- Controls are discrete and rhythmic; interaction should feel pulse-oriented.

### 4.2 Drum modules

Structural grammar:
- Emphasize **hit shaping and per-voice articulation**.
- Primary surface prioritizes voice/onset-level controls and quick muting/variation.
- Should read as percussive instruments, not generic parameter cards.

### 4.3 Tonal / synth modules

Structural grammar:
- Emphasize **pitch, harmonic contour, and timbral macro-shape**.
- Primary surface foregrounds note/harmony behavior plus core timbre macro controls.
- Trigger and synth modules must not feel like the same object.

### 4.4 Visual modules

Structural grammar:
- Emphasize **render/output composition** and mapping to musical drivers.
- Primary surface shows visual output mode and dominant modulation sources.
- Must still obey grid scale, hierarchy, and interaction states used by audio modules.

### 4.5 Utility / controller modules

Structural grammar:
- Emphasize **routing, transforms, macros, and global influence**.
- Primary surface should make “what this controls” immediately visible.
- Must avoid becoming dense form panels; use compact directional affordances.

### Cross-family requirements

- Every family exposes a recognizable “front panel silhouette” via control layout.
- Family distinction is visible at a glance before reading labels.
- Future visual and live-coding modules must still fit the same core spatial logic.

---

## 5) Workspace doctrine

The workspace is the product. Module internals are in service of the workspace.

### 5.1 Module placement logic

- Placement is explicit and spatially stable.
- New module insertion should prefer nearby intentional slots, not random end-of-list behavior.
- Reordering preserves mental map; avoid unexpected auto-reflow when non-conflicting.

### 5.2 Add-slot logic

- **AddModuleSlot is a first-class element of the workspace.**
- Add slots should be consistently represented as actionable grid occupants.
- Add slots signal valid growth points and composition possibilities.

### 5.3 Spatial add interactions

- Add interactions originate from spatial context (the target slot/cell), not detached global dialogs.
- Module picker surfaces should retain location context (“adding here”) while browsing options.

### 5.4 Drag-and-drop expectations

- Drag start, hover target, valid drop zone, and commit state must be unambiguous.
- During drag, maintain grid structure and target predictability.
- Failed drops should resolve cleanly with clear return behavior.

### 5.5 Transport/header relationship

- Transport/header is global control infrastructure, visually subordinate to workspace composition.
- Header should not visually compete with module field.
- Workspace remains the dominant canvas at all times.

---

## 6) Interaction doctrine

Interaction states must be coherent across all module families.

### 6.1 Hover

- Hover reveals affordance, never dumps full configuration UI.
- Hover styling should be subtle and consistent.

### 6.2 Focus

- Keyboard focus must be clearly visible and meet accessibility contrast requirements.
- Focus order should follow spatial reading order before deep-control traversal.

### 6.3 Selection

- Selection indicates the current active module context.
- Selected state is distinct from hover and drag target.

### 6.4 Dragging

- Dragging state should elevate the moving module and preserve its footprint silhouette.
- Drag previews must respect the same visual language as static modules.

### 6.5 Dropping

- Drop targets should be explicit before drop commit.
- Invalid targets should be communicated early, not only on release.

### 6.6 Contextual add menus

- Add menus open from AddModuleSlot or equivalent in-grid affordance.
- Menu grouping mirrors module families and their structural roles.
- Menus should prioritize fast insertion over encyclopedic browsing.

### 6.7 Revealing advanced controls

- Advanced controls are progressive disclosure, not default clutter.
- Expansion should preserve module footprint where possible; if overlays are used, they should anchor clearly to the invoking module.

---

## 7) Density and restraint

GRIDI should feel information-rich but never crowded.

### Main surface belongs to:

- module identity
- immediate performance controls
- live state feedback
- placement and relationship cues

### Secondary layers belong to:

- edge-case parameters
- diagnostic readouts
- setup that is not touched during active composition/performance

### Rules

- Do not place rarely used controls on primary surfaces by default.
- Do not require tab switching to access the module’s essential behavior.
- If everything is visible at once, hierarchy has failed.

Main surfaces must express role immediately.

---

## 8) Anti-regression checklist

Use this checklist in every GUI PR review.

1. Does this change strengthen the perception of a modular spatial instrument?
2. Are module footprints still consistent with grid laws?
3. Are empty cells still intentional and readable, not accidental leftovers?
4. Does AddModuleSlot remain explicit and first-class?
5. Is module identity visible without relying on tabs?
6. Are primary controls visible without opening secondary layers?
7. Does this avoid returning to “similar cards with different labels”?
8. Are trigger vs synth (and other families) structurally distinguishable at a glance?
9. Are drag/drop and add interactions spatially coherent?
10. Is visual complexity restrained, with one clear hierarchy?
11. For new module types (including visual/live-coding), do they obey existing spatial logic?
12. Would a user perceive a UI improvement, not just an implementation change?

If 3 or more answers are “no,” the PR is misaligned and should be reworked before merge.

---

## 9) PR evaluation rubric

Score GUI PRs from 0–2 on each dimension (max 10).

### Dimension A: Perceptual shift
- 0 = no visible change or purely cosmetic restyling
- 1 = modest visible improvement, identity still ambiguous
- 2 = clear shift toward modular spatial instrument feel

### Dimension B: Structural clarity
- 0 = card/tab pattern unchanged
- 1 = partial structural improvement
- 2 = module roles and families clearer by layout/topology

### Dimension C: Workspace coherence
- 0 = change ignores spatial composition rules
- 1 = mostly coherent, with minor conflicts
- 2 = reinforces add-slot, grid rhythm, drag/drop logic

### Dimension D: Hierarchy and restraint
- 0 = increased clutter or flattened hierarchy
- 1 = neutral or mixed hierarchy impact
- 2 = stronger primary/secondary separation

### Dimension E: Future-fit consistency
- 0 = special-cased solution unlikely to scale
- 1 = partly reusable pattern
- 2 = reusable pattern for current and future module families

### Interpretation

- **0–3**: Cosmetic-only or regressive. Do not merge as GUI progress.
- **4–6**: Incremental but incomplete. Merge only with explicit follow-up plan.
- **7–8**: Structurally meaningful and aligned.
- **9–10**: Strong North Star advancement; use as reference for future work.

---

## How to use this document in future PRs

When opening any GUI PR:

1. Include a short “North Star alignment” section in the PR description.
2. State which module family/workspace law the change targets.
3. List which anti-regression checklist items were verified.
4. Provide before/after evidence (screenshots or short clips) demonstrating perceptual change.
5. Add a rubric self-score (A–E) with one sentence justification per dimension.

When reviewing any GUI PR:

1. Reject “backend-only GUI claims” that do not alter user perception.
2. Reject changes that reintroduce tab-first or generic-card behavior.
3. Require explicit reasoning when exceptions to core visual laws are proposed.
4. Prefer fewer, structurally meaningful changes over many cosmetic edits.

Default policy: if a change cannot explain how it advances this North Star, it should not be presented as GUI progress.
