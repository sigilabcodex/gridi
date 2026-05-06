# Add-module IA Phase 2 Audit — Search, Presets, and Insertion Policy

## 1. Executive summary

This is an audit-only planning pass for Add-module IA Phase 2. No runtime behavior, patch schema, preset data, routing behavior, examples, dependencies, or UI implementation were changed.

Pre-change review found that Add-module IA Phase 1 successfully moved the Add Module affordance from a flat mixed list into a compact family-first browser. The current flow is optimized for fast creation of common modules: GEN, DRUM, and SYNTH are still one-action picks, while CTRL and VIS have lightweight subtype rows plus quick-add defaults. The browser remains close to the grid cell that invoked it and still feels like an instrument control rather than a broad app launcher.

The main Phase 2 recommendation is conservative:

1. Do **not** build a full preset browser yet.
2. Do **not** build a command palette or fuzzy global launcher.
3. Do **not** change insertion behavior yet.
4. Do make the current IA safer and more ready for growth by tightening metadata, copy, keyboard semantics, and test coverage.
5. Defer larger search/preset/scene-building decisions until after the v0.4 routing consolidation work clarifies how modules should connect and present routing intent.

The smallest useful Phase 2 scope should be an AddModuleSlot polish pass: replace fragile text-derived keyboard subtype detection with explicit button metadata, make phase-2 placeholder copy less prominent, add tests for the IA data model and keyboard-intent assumptions where practical, and document a future third-step preset path without exposing it yet.

## 2. Sources reviewed

Required project and direction sources:

- `README.md`
- `ROADMAP.md`
- `docs/status.md`
- `docs/releases.md`
- `docs/ui-principles.md`
- `docs/ui-faceplate-grammar.md`
- `docs/audits/interaction-architecture-audit-2026-05.md`

Current Add Module implementation and adjacent systems:

- `src/ui/AddModuleSlot.ts`
- `src/ui/render/moduleGrid.ts`
- `src/ui/app.ts`
- `src/patch.ts`
- `src/workspacePlacement.ts`
- `src/ui/style.css`
- `src/ui/persistence/modulePresetStore.ts`
- `src/ui/persistence/presetStore.ts`

Relevant tests reviewed:

- `tests/addModuleIa.test.mjs`
- `tests/moduleGridPlacement.test.mjs`
- `tests/presetStore.test.mjs`
- `tests/soundModules.test.mjs`
- `tests/patchMigrationRouting.test.mjs`
- `tests/moduleSelectionState.test.mjs`
- `tests/routingGraphHybrid.test.mjs`
- `tests/routingVisibilityModel.test.mjs`

## 3. Current Phase 1 behavior

### Family structure

Phase 1 defines five top-level Add Module families:

| Family | Label | Default pick | Current behavior |
| --- | --- | --- | --- |
| GEN | Generator | `trigger` | One-action creation. |
| DRUM | Drum | `drum` | One-action creation. |
| SYNTH | Synth | `tonal` | One-action creation. |
| CTRL | Control | `control-lfo` | Opens subtype row from family button; quick-add creates LFO. |
| VIS | Visual | `scope` | Opens subtype row from family button; quick-add creates Scope. |

The family order is GEN, DRUM, SYNTH, CTRL, VIS. This correctly foregrounds generative sources and playable sound voices before control and monitor utilities.

### Default picks

Defaults are intentionally immediate:

- GEN creates a Trigger module.
- DRUM creates a Drum module.
- SYNTH creates a Tonal/Synth module.
- CTRL quick-add creates LFO.
- VIS quick-add creates Scope.

This preserves the old fast-add expectation while adding future structure.

### Subtype coverage

CTRL currently exposes three subtypes:

- LFO
- Drift
- Stepped

VIS currently exposes eight subtypes:

- Scope
- Spectrum
- Vectorscope
- Spectral Depth
- Flow
- Ritual
- Glitch
- Cymat

GEN, DRUM, and SYNTH do not expose subtype rows yet. That is reasonable for Phase 1 because their common path is default creation, and their future complexity is more likely to come from preset/mode selection than a long raw subtype list.

### Keyboard behavior

Current keyboard behavior includes:

- Add slot is focusable.
- Enter or Space opens the menu.
- ArrowDown opens the menu from the slot and focuses the first button.
- Escape closes the menu and can restore focus.
- Menu ArrowDown/ArrowUp cycles through menu buttons.
- Home/End jump to first/last menu button.
- ArrowRight from a root family row enters a subtype menu when the active button text includes a subtype-capable family code.
- ArrowLeft from a subtype menu returns to family rows.
- Tab closes at the edges of the menu button list.
- Click outside, pointer outside, or focus leaving the menu closes the panel.

The overall keyboard model is useful and compact, but the ArrowRight implementation depends on `textContent` containing a family code. That is fragile: a copy-only change could break keyboard subtype entry. A future pass should add explicit metadata to buttons, such as `data-family-id`, `data-has-subtypes`, or a closure-owned button descriptor list.

### Styling behavior

AddModuleSlot styling is dark, compact, and instrument-adjacent:

- Empty add slots share the same module-cell geometry as occupied modules.
- The slot centers a plus sign and `Add module` label.
- The floating menu is clamped by the shared floating panel placement helper.
- Buttons use minimum 44px touch-friendly heights in the later Add Module menu rules.
- Family rows use a main family button plus optional compact quick-add button.
- GEN and DRUM are visually accented in the family list.
- Phase-hint copy is subdued but still present in the menu.

The style surface uses many literal dark RGBA values. That is acceptable for the current dark UI, but these rules should eventually be tokenized as part of the separate light-theme/UI-system pass already identified in the roadmap.

### Tests added

`tests/addModuleIa.test.mjs` covers:

- family-first order,
- default picks,
- default pick to module factory mappings,
- CTRL subtype values,
- VIS subtype values,
- empty subtype lists for direct-add families.

This is good data-model coverage. It does not simulate DOM keyboard behavior, focus transitions, menu close behavior, viewport clamping, or touch interaction.

### Deferred from Phase 1

The interaction architecture audit explicitly deferred:

- quick search across family/subtype/preset labels,
- full preset selection,
- insertion-direction policy,
- larger preset-bank IA,
- runtime/routing/schema changes.

Phase 1 also left `Presets/search arrive in phase 2.` and `Preset browser deferred to phase 2.` copy in the menu as explicit placeholders.

## 4. Current strengths

### Speed

The flow is fast for the highest-frequency actions. GEN, DRUM, and SYNTH are single actions after the menu opens; CTRL and VIS can still be quick-added without entering subtype browsing.

### Discoverability

The family-first list teaches the vocabulary of the instrument: generators, drum voices, synth voices, control sources, and visual displays. This is clearer than a flat mixed menu, especially for new users trying to understand why a module exists.

### Family clarity

The browser now mirrors GRIDI's module-family model instead of exposing implementation terms first. `GEN`, `DRUM`, `SYNTH`, `CTRL`, and `VIS` map well to the instrument's patch-building mental model.

### Touch use

The rows are reasonably large, quick-add targets are separated, and the menu is close to the touched add slot. The design is still compact enough for mobile and tablet use, although VIS is approaching the limit of comfortable menu height.

### Keyboard use

The current keyboard model is practical: a user can open, move, enter subtypes, leave subtypes, and close without a pointer. The behavior is not a full ARIA menu implementation, but it is workable and consistent with the transient-control policy.

### Scalability toward future presets

The family/subtype split creates a natural place for presets later: family -> subtype -> preset. It avoids forcing all factory and user presets into the top-level menu.

## 5. Current limits

### Comfortable choice count

The root menu currently fits comfortably: five family rows plus two quick-add buttons and short hints. The subtype pages are the first pressure point. CTRL is short at three subtype options plus a default row. VIS is already long at eight subtype options plus back/default/hint rows.

A comfortable limit for this exact menu surface is roughly:

- root: 5-7 family rows,
- subtype page: 4-6 options before the panel starts feeling like a list browser,
- preset list: likely no more than 4-6 visible suggestions unless a larger browser/sheet is introduced.

VIS already exceeds the ideal subtype count. It remains usable because labels are short, but adding more VIS modes would make search, grouping, or another IA layer more important.

### CTRL/VIS list length

CTRL does not feel long. VIS does. VIS should probably be the first family to receive either grouping, search filtering, or a more compact subtype model if more visual modules are added.

### GEN/DRUM/SYNTH future growth

GEN will likely need mode-aware creation later because generator modes are behaviorally distinct. However, adding a GEN subtype step too early could slow the most important creation path.

DRUM and SYNTH have factory module presets already, and their growth pressure is preset-related rather than subtype-related. A future preset affordance should not turn DRUM/SYNTH creation into a mandatory browser step.

### Instrument control vs app launcher

The current menu still feels like an instrument control because it is local, small, family-first, and directly creates modules. It would start feeling like an app launcher if it gained global search, large preset lists, templates, routing recipes, previews, categories, or command-palette behavior in the same surface.

### Placeholder copy

The current placeholder copy is useful for development continuity but too implementation-facing for a released instrument surface. `Presets/search arrive in phase 2.` should not remain as prominent user-facing copy indefinitely. If any copy remains in Phase 2, it should become more subtle and user-benefit oriented, such as `Fast defaults now; presets later.` or be removed entirely until the feature exists.

## 6. Search audit

### Is quick search needed now?

Not urgently. With five families, three CTRL subtypes, and eight VIS subtypes, the browser is still navigable without search. Adding search now risks making the menu feel more like a command palette or launcher than a direct instrument control.

The strongest argument for search is VIS growth: eight visual subtypes already form a long list. The strongest argument against search is that the root workflow remains small and fast.

Recommendation: **defer full search**, but make Phase 2 implementation choices search-ready.

### Smallest useful search, if implemented later

If search becomes necessary, the smallest useful version should be local to the Add Module menu:

- simple substring matching, not fuzzy search,
- matches family code and label (`GEN`, `Generator`, etc.),
- matches subtype labels and descriptions,
- optionally matches factory module preset `code` and `name` only after presets are intentionally exposed,
- does not search global commands, transport actions, settings, sessions, examples, routing actions, or hidden engine internals,
- keyboard-first, but not a global command palette,
- appears only after typing while the menu is open or behind a small `Filter` affordance, not as the first visual element.

### Search coverage recommendation

| Search target | Recommendation | Rationale |
| --- | --- | --- |
| Family names/codes | Later, yes | Cheap and useful if filtering exists. |
| Subtypes | Later, yes | VIS length makes this useful. |
| Factory module presets | Later, only when preset creation is exposed | Avoid searching records that cannot be acted on. |
| User module presets | Later, only after preset browser model is clear | User records can become numerous and need source/provenance clarity. |
| Session presets/examples | No | That belongs to session management, not Add Module. |
| Commands/settings/routing actions | No | Would become a command palette and blur instrument boundaries. |

### Trigger model

Search should not appear as a persistent input at the top of the root menu yet. A persistent input would make the first impression more app-like and consume vertical space on mobile. If added later, support type-to-filter after menu open and show the input/results only once the user starts typing or activates a small filter affordance.

## 7. Preset placeholder audit

### Where module presets are stored

Module presets are handled by `src/ui/persistence/modulePresetStore.ts`. The library uses localStorage under `gridi.module-presets.v1` for saved user/factory-combined records. Loading starts from starter factory records, reads localStorage if present, normalizes records, and appends any missing factory records by ID.

### Factory preset representation

Factory module presets are `ModulePresetRecord` objects with:

- stable `id`,
- optional display `code`,
- `name`,
- `family`,
- `subtype`,
- captured module `state`,
- `source: "factory"`,
- `createdAt`,
- `updatedAt`.

Factory starter records currently focus on DRUM and SYNTH banks with stable codes such as `DRUM001` and `SYNTH001`. Some starter factory records are generated through helper functions from module factories, then adjusted with state overrides.

### User preset representation

User module presets use the same `ModulePresetRecord` shape with `source: "user"`. Saving from a module snapshots the family-specific state, stores the record in the library, and links the module back to the preset through `presetName` and `presetMeta` fields including module preset ID, family, subtype, updated timestamp, source, and optional code.

### Should Add Module expose presets now?

Not yet. Presets already exist inside module-level preset controls, but Add Module should not expose them until the IA can protect fast defaults. Adding a preset browser too soon would likely make DRUM/SYNTH creation slower and make the add menu feel like a product catalog.

### Future preset placement

The right long-term shape is:

1. family,
2. subtype/engine only when needed,
3. preset choices as an optional third step.

Important constraint: the third step must be optional. A user choosing DRUM should still be able to create a default drum immediately.

### Preview-only, one-click create, or both?

Eventually both may be useful, but not in Phase 2.

A conservative future model:

- Default row: creates the standard module immediately.
- Recent/factory suggestions: one-click create with preset applied.
- Preview/details: deferred until there is an audio-safe preview policy and clear UI room.

Do not add audio preview in Phase 2. Preview introduces transport/audio state questions, performance risks, and DAW-browser expectations.

### Avoiding overwhelm

Preset exposure should be capped and contextual:

- show only compatible presets for the selected family/subtype,
- prioritize a few factory/core presets,
- keep user presets behind an explicit `User` section or later filter,
- never show the full factory bank at the root,
- avoid nested categories until banks have real metadata,
- keep default creation as the visually dominant action.

### Keeping common creation fast

Common creation stays fast if:

- root family rows keep direct default actions for GEN/DRUM/SYNTH,
- CTRL/VIS retain quick-add defaults,
- preset browsing is opt-in through a secondary button or third step,
- search/filter does not steal focus unless explicitly invoked or typing begins.

## 8. Insertion policy audit

### How empty slots are computed

Grid placement is split between canonical workspace coordinates and responsive display coordinates.

`resolveGridLayout()` reads module `x`/`y` coordinates, resolves collisions with a dense fallback, tracks max occupied coordinates, and returns at least two visible rows beyond the lowest occupied module.

Desktop/non-constrained layout renders a grid of `renderedColumns` by `totalRows`. Every unoccupied position becomes an AddModuleSlot whose display position and target insertion position are the same.

Constrained/mobile/tablet layout renders modules densely by source-slot order into the visible column count, then appends two rows of empty slots. In this constrained mode, the empty slot display position can differ from its canonical target position.

### How a new module position is chosen

AddModuleSlot receives a `position` and calls `onPick(what)`. The module grid passes a target position to `createModuleAt()`. `createModuleAt()` creates a module via the appropriate patch factory, then writes the target grid position into the module before pushing it into the patch.

### Desktop behavior

On desktop, insertion is spatial and literal: selecting an empty cell inserts into that cell's same canonical `x`/`y`. The grid preserves wider explicit coordinates and renders enough columns to include occupied wide positions.

### Mobile/responsive behavior

On constrained viewports, modules are displayed as a dense sequence in visible columns. Empty slots are appended after the module sequence. Their canonical target positions are computed using the legacy/default workspace column count, not necessarily the visible mobile column count. This means mobile insertion is more like `append in canonical order` than visually literal insertion into a persistent 2D layout.

This is a pragmatic compromise: mobile gets a compact list-like grid while the underlying patch keeps canonical positions.

### Predictability

Desktop insertion is predictable. Mobile insertion is predictable enough for append-style creation, but less transparent because the visual slot and canonical target can differ. That matters only if users expect exact spatial placement on mobile.

### Implicit direction

The current implicit insertion policy is:

- desktop: insert exactly into the selected empty grid cell,
- constrained/mobile: append after the dense rendered module list, with canonical positions advancing through default slot order,
- layout expansion: always keep at least two empty rows available.

This is closer to `insert right then wrap` than `insert below`, but only as a byproduct of slot-index ordering. It is not an explicit user-facing policy.

### Should there be a setting?

No setting yet. A setting such as `insert right then wrap` vs `insert below` would add configuration weight before there is evidence of user pain. It could also interact poorly with responsive layout and future routing-aware placement.

### Should insertion direction remain deferred?

Yes. Keep insertion automatic for now. If Phase 2 touches insertion at all, it should only document the current behavior or add tests around existing expectations. Do not rewrite placement policy before Routing v0.4.

## 9. Fast musical scene creation

Add Module should help create playable musical situations quickly, but it should not become a DAW template system.

### Useful future helpers

Potential small helpers:

- quick add GEN + DRUM,
- quick add GEN + SYNTH,
- quick add GEN + DRUM + CTRL,
- quick add VIS monitor.

These map well to GRIDI's identity because they create small modular systems rather than timeline templates.

### Where this belongs

This probably does **not** belong in the Add Module menu yet. Bundles introduce routing questions: should GEN auto-drive DRUM? Should CTRL auto-map to density, cutoff, or amplitude? Should VIS auto-monitor master output or a selected module? Those questions are central to v0.4 routing consolidation.

Better homes later:

- a separate examples/session system,
- a lightweight `starter scene` affordance for empty patches only,
- or a future routing-aware creation helper after routing policy is settled.

### Recommendation

Defer scene-building helpers until after Routing v0.4. In Phase 2, only preserve enough Add Module simplicity that such helpers could be added later without turning the menu into a template browser.

## 10. Accessibility and interaction audit

### Keyboard behavior

Current behavior is solid for a compact custom menu: open, close, arrow movement, subtype entry/exit, Home/End, and edge Tab dismissal are supported.

Main concern: ArrowRight subtype entry currently relies on button text containing a family code. This should be replaced with explicit metadata or a button descriptor model in the next implementation pass.

### ARIA/menu semantics

Current semantics:

- slot has `aria-haspopup="menu"`,
- slot updates `aria-expanded`,
- menu has `role="menu"`,
- buttons have `role="menuitem"`.

This is a reasonable start, but not a complete ARIA menu pattern. If the project keeps native buttons inside a custom menu, it should ensure focus order and Escape behavior remain consistent. A later pass could consider `aria-label` on the menu, `aria-controls` from the slot to the menu, and clearer labels for quick-add buttons.

### Focus management

Focus management works in broad strokes:

- keyboard-open can focus the first menu button,
- Escape restores focus to the slot when requested,
- outside focus closes the menu,
- returning from subtype can focus the first root button.

Potential improvements:

- preserve the originating family focus when returning from subtype,
- ensure quick-add button focus labels are self-explanatory,
- avoid closing the menu unexpectedly if focus moves to a future search input inside the menu.

### Escape and click-outside behavior

Escape and pointer/focus outside behavior are implemented at the document level while the menu is open. This matches transient UI expectations. The implementation should remain small; no global modal manager is needed for Phase 2.

### Touch target sizes

The later CSS rules set Add Module menu items to at least 44px high, and quick-add buttons also use 44px minimum height. This is appropriate. The VIS subtype list height remains the bigger touch issue on short screens.

### Mobile viewport constraints

The floating panel helper clamps the menu to the viewport and allows overflow scrolling through the `.floatingPanel` rule. This is acceptable, but a long preset list would outgrow the current menu. That is another reason not to add a full preset browser inside this exact surface.

### Fragile label/text matching

ArrowRight root-to-subtype behavior should not depend on text matching. Explicit metadata is safer and should be part of the smallest Phase 2 implementation.

Suggested future approaches:

- assign `familyButton.dataset.familyId = family.id`,
- assign `familyButton.dataset.hasSubtypes = String(Boolean(family.subtypes?.length))`,
- or replace `buttons: HTMLButtonElement[]` with `buttons: Array<{ element: HTMLButtonElement; familyId?: AddModuleFamilyId; opensSubtypes?: boolean }>`.

The descriptor approach is more testable and avoids accidental coupling to DOM text.

## 11. AddModuleSlot CSS and future theming notes

AddModuleSlot Phase 1 added and reused styles with many literal dark colors:

- dark translucent slot backgrounds,
- light RGBA borders,
- blue/cyan accent states,
- dark floating panel surfaces,
- dark tooltip/panel shadows,
- subdued phase-hint text.

These are visually consistent with the current dark UI, but they are not fully tokenized. Because the project already has a known placeholder light theme that does not fully work, AddModuleSlot should not receive one-off light-mode overrides in Phase 2.

Recommendation:

- Do not implement light theme here.
- Do not audit the whole theme system here.
- Later UI-system pass should token-check AddModuleSlot colors alongside other floating panels, faceplates, routing indicators, transport controls, and GEN display surfaces.
- If Phase 2 changes AddModuleSlot styles, prefer existing CSS variables or introduce narrowly scoped semantic variables only if they are reused by floating panel/menu surfaces.

## 12. Risks before implementation

Key risks:

- **Overbuilding the add menu:** adding search, presets, templates, previews, and routing helpers at once would make the menu feel like a launcher.
- **Slowing common creation:** mandatory preset/subtype steps for GEN/DRUM/SYNTH would undermine immediacy.
- **DAW drift:** templates, arrangement-like scenes, timeline language, or mixer-like auto-routing could pull GRIDI away from modular instrument identity.
- **Fragile keyboard navigation:** current ArrowRight label matching can break with copy changes.
- **Preset data complexity:** factory/user presets share a record shape, but future bank metadata, tags, source labels, and compatibility rules are not yet fully modeled.
- **Responsive menu size:** VIS is already long, and presets would make mobile overflow likely.
- **Theme hardcoding:** AddModuleSlot/floating menu styles are dark-specific and should not receive ad hoc light overrides.
- **Patch schema churn:** Add Module IA does not need schema changes; touching patch shape would create unnecessary migration risk.
- **Routing conflict:** scene helpers or auto-wiring would overlap with upcoming v0.4 routing consolidation.
- **Preset browser expectations:** audio preview, favorites, tags, banks, and search are a larger product surface than Phase 2 should carry.

## 13. Recommended Phase 2 scope

### Include

Smallest useful Phase 2 implementation scope:

1. **Interaction robustness pass**
   - Replace text-dependent ArrowRight subtype lookup with explicit metadata or button descriptors.
   - Preserve existing visual behavior and module creation behavior.

2. **Placeholder copy polish**
   - Remove or soften `Presets/search arrive in phase 2.` and `Preset browser deferred to phase 2.`
   - Keep copy user-facing, not roadmap-facing.

3. **Search-ready internal structure only**
   - Keep family/subtype data structured enough to index later.
   - Do not expose a search UI yet unless menu growth happens first.

4. **Preset-ready documentation and tests only**
   - Document optional family -> subtype -> preset path.
   - Add tests that protect current default picks and subtype compatibility.

5. **Responsive guardrails**
   - Confirm the current menu remains usable with the existing VIS list.
   - Avoid adding new rows that worsen mobile height.

### Do not include

- full preset browser,
- command palette,
- fuzzy search,
- scene/template browser,
- routing-aware auto-wiring,
- insertion policy rewrite,
- schema changes,
- preset data changes,
- light theme implementation,
- runtime behavior changes.

### Why this scope

This scope improves the current Phase 1 browser without changing what users can create or how patches behave. It reduces known fragility, removes development-facing copy from the instrument surface, and leaves Routing v0.4 unblocked.

## 14. Explicit deferrals

Do not do these in Add-module IA Phase 2:

- full preset browser,
- persistent search input,
- global command palette,
- fuzzy search/scoring,
- search across sessions/examples/settings/commands,
- user preset browser inside Add Module,
- audio preview for module presets,
- scene/template browser,
- starter-scene bundle creation,
- routing-aware auto-wiring,
- automatic GEN-to-DRUM/SYNTH connection behavior,
- large insertion policy rewrite,
- insertion-direction user setting,
- patch schema changes,
- preset data/model changes,
- factory preset additions or renames,
- example/session preset changes,
- full light theme implementation,
- global graph/routing interactions,
- new dependencies.

## 15. Next small implementation passes

### Pass 1 — AddModuleSlot keyboard metadata hardening

- **Goal:** Remove fragile text matching from ArrowRight subtype navigation.
- **Files likely involved:** `src/ui/AddModuleSlot.ts`, `tests/addModuleIa.test.mjs`.
- **Expected behavior change:** No user-visible behavior change. Keyboard subtype entry remains the same but is safer against copy changes.
- **Tests to add/update:** Add IA data/descriptor tests if descriptors are exported; otherwise add focused tests around family subtype metadata.
- **Risks:** Accidentally changing focus order or menu button ordering.
- **Do not touch:** patch schema, module factories, presets, routing, visual styling beyond what is necessary.

### Pass 2 — Add Module placeholder copy polish

- **Goal:** Remove development-phase wording from the menu or make it subtle and user-facing.
- **Files likely involved:** `src/ui/AddModuleSlot.ts`, possibly `tests/addModuleIa.test.mjs` if copy is tested later.
- **Expected behavior change:** Menu copy feels less like a roadmap note. Creation behavior unchanged.
- **Tests to add/update:** Snapshot-like DOM tests only if a DOM harness exists; otherwise no new behavior tests needed.
- **Risks:** Removing useful contributor context. Mitigate by keeping this audit as documentation.
- **Do not touch:** search UI, preset browser, CSS layout, presets, patch schema.

### Pass 3 — Minimal DOM interaction test harness for AddModuleSlot

- **Goal:** Cover open/close and keyboard navigation behavior with a small DOM test approach if the repo's test environment can support it without dependencies.
- **Files likely involved:** `tests/addModuleIa.test.mjs` or a new focused test file.
- **Expected behavior change:** None.
- **Tests to add/update:** Enter/Space open, Escape close, ArrowDown/ArrowUp move, ArrowRight enters CTRL/VIS subtype, ArrowLeft returns, quick-add default pick fires.
- **Risks:** Node's built-in test environment has limited DOM support without a browser/JSDOM dependency. Do not add dependencies just for this pass.
- **Do not touch:** runtime behavior, dependencies, Vite config unless a no-dependency route is already available.

### Pass 4 — Search readiness only

- **Goal:** Add a pure data helper that can produce searchable Add Module entries without rendering search UI.
- **Files likely involved:** `src/ui/AddModuleSlot.ts`, `tests/addModuleIa.test.mjs`.
- **Expected behavior change:** None unless helper is only exported for tests/future use.
- **Tests to add/update:** Verify family/subtype labels, codes, descriptions, and values are represented without including presets yet.
- **Risks:** Premature abstraction. Keep helper tiny and do not wire UI.
- **Do not touch:** DOM menu, CSS, module preset store, preset data.

### Pass 5 — Future preset entry design note after Routing v0.4

- **Goal:** Revisit whether Add Module should expose a few compatible preset suggestions after routing consolidation.
- **Files likely involved:** documentation first; later `src/ui/AddModuleSlot.ts`, `src/ui/persistence/modulePresetStore.ts`, module preset tests.
- **Expected behavior change:** None in documentation pass. Later implementation might add opt-in preset suggestions.
- **Tests to add/update:** Compatibility filtering by family/subtype/source; default creation remains one action.
- **Risks:** Turning Add Module into a preset catalog.
- **Do not touch:** routing auto-wiring, patch schema, factory preset data, scene templates.

## 16. Testing recommendations

Documentation-only validation for this audit:

- Run `npm test` to ensure the current suite still passes after adding the audit document.
- Check `git diff --stat` and `git diff --name-only` to confirm only the audit document changed.

Recommended future tests for Phase 2 implementation:

- AddModule family order remains GEN, DRUM, SYNTH, CTRL, VIS.
- Default picks remain `trigger`, `drum`, `tonal`, `control-lfo`, and `scope`.
- CTRL/VIS subtype values remain compatible with patch factories.
- Keyboard metadata for subtype-capable rows does not depend on visible text.
- Placeholder copy changes do not affect pick behavior.
- If a search helper is added later, substring matching covers family codes/labels and subtype labels without including global commands.
- If preset suggestions are eventually added, default module creation remains available as the first action.

## 17. Open questions

1. Should VIS subtypes be grouped before adding any more visual modes, or is a future local filter enough?
2. Should GEN eventually expose mode selection at creation, or should mode stay inside the module face after default GEN creation?
3. Should DRUM/SYNTH preset suggestions appear as a small optional list, or should preset browsing stay inside module faceplate controls?
4. Should Add Module ever create connected mini-systems, or should that live entirely in examples/session workflows?
5. After Routing v0.4, is there a safe, instrument-like way to create `GEN + voice` without surprising users through hidden auto-wiring?
6. Should constrained/mobile insertion continue to append in canonical order, or should a later mobile-specific explanation/placement affordance make this clearer?
7. Should AddModuleSlot share floating-panel theme tokens with control editors and tooltips in a later UI-system pass?
