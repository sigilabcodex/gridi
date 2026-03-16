# UI/UX Audit — Current State (Why the interface still feels like the old GRIDI)

## 1. Current dominant mental model
A first-time user is still likely to perceive GRIDI as **a single-page rack of similar synth cards with tabs**, not a modular groovebox with distinct module families.

What the current screen communicates above the fold:
- “Everything is a card in one scroll feed.”
- “The real app is a transport bar plus parameter panels.”
- “Trigger, synth, and visual are just variants of the same widget shell.”
- “Connections are metadata, not a core interaction model.”

The visible result is that the product still reads as **voice-centric panel editing**, not **module composition + routing + role-specific workflows**.

## 2. Legacy patterns still present

### 2.1 Generic module card shell dominates all families
Trigger, drum, tonal, visual, and add-module browser all share the same `.card`/`.moduleCard` anatomy, same header rhythm, same on/off + delete affordances, and similar internal spacing.

Impact:
- Family-specific identity is weak.
- New module families feel like renamed old cards.
- Scanning cost stays high because every module has similar visual weight.

### 2.2 Tab-heavy anatomy remains the core interaction model
Both trigger and voice modules still rely on `Main / Connections / Settings`-style tabs, and tonal/drum also include “coming soon” tabs (`MIDI`, `Settings`) that occupy UI real estate without delivering differentiated workflows.

Impact:
- Old “card with tabs” mental model remains intact.
- Interaction still feels panel-switching based, not patching/routing based.

### 2.3 Control density is normalized across unlike module roles
Sequencing controls and synthesis controls are both presented as dense knob grids in similarly sized panels.

Impact:
- Trigger modules do not feel “algorithmic/event-centric.”
- Voice modules do not feel “performance/timbre-centric.”
- Visual modules look like cards with a canvas inserted, not true first-class monitoring surfaces.

### 2.4 Distinction between trigger vs synth role is mostly textual
Role differences are mainly encoded in small labels (`familyBadge`, type text, connection pills), not in layout structure or interaction hierarchy.

Impact:
- Users still parse by reading labels, not by shape/flow.
- The product lacks immediate role affordance.

### 2.5 Weak global hierarchy above the fold
The sticky header is crowded with transport, preset, randomization, regen, gain, BPM, mute, reset, etc. Module composition starts only below this dense command strip.

Impact:
- First impression is “control toolbar app,” not “modular workspace.”
- The top region still anchors the old DAW utility-bar identity.

### 2.6 Old section grouping logic remains linear and list-based
The grid is rendered as titled sections (`Trigger Modules`, `Synth Modules`, `Visual Modules`, `Module Browser`) in one vertical scroll sequence.

Impact:
- Families are grouped, but not spatially composed.
- No explicit routing canvas, lanes, or signal flow zone.
- Connections feel secondary because layout does not encode flow direction.

### 2.7 Connection model is still non-visual and low-affordance
Connection UX is mostly a select dropdown in a tab and text pills (“Connections use module IDs and badges instead of patch cables.”).

Impact:
- Architectural modularity exists, but perceptual modularity does not.
- Users cannot “see the patch” without reading controls.

### 2.8 Styling evolution is incremental, not structural
Color accents and gradients were updated, but spacing, card geometry, control rows, tab bars, and component composition patterns remain close to legacy.

Impact:
- The look changed, the grammar did not.
- Users perceive skinning, not redesign.

## 3. Structural reasons the redesign is not being perceived
1. **Architecture changed faster than presentation grammar.**
   Data model separation (trigger vs sound vs visual) is real, but the renderer still maps all families into one repeated card template.

2. **Renderer centralization preserves old frame.**
   `createModuleGridRenderer` still composes the app as sequential sections + cards. Even with new module types, the composition algorithm outputs the same UX silhouette.

3. **Shared CSS primitives enforce homogeneity.**
   Core classes (`.card`, `.cardHeader`, `.modTabs`, `.moduleGroup`, `.row`) create uniformity that suppresses family-specific interaction models.

4. **Connection workflows were abstracted in state, not elevated in UI.**
   Trigger/source linkage moved into clean module IDs and selectors, but the interaction remains a dropdown instead of a primary composition action.

5. **“Coming soon” tabs preserve old shell without adding new behavior.**
   Placeholder tab panels reinforce legacy anatomy while signaling that major interaction changes are deferred.

6. **High-control header consumes primary attention budget.**
   Legacy transport/utility concentration dominates first glance and delays recognition of modular workflows.

## 4. File-level responsibility map
These files are the highest-responsibility surfaces for why the UI still feels old:

### Primary structural bottlenecks
- `src/ui/render/moduleGrid.ts`
  - Hard-codes sectioned card feed structure.
  - Enforces list-first rendering rather than flow-first workspace.
- `src/ui/style.css`
  - Shared card/tab/group primitives produce family homogeneity.
  - Legacy rhythm (padding, grid, tabs, compact rows) dominates every module.
- `src/ui/header/transportHeader.ts`
  - Dense top command strip sets legacy first impression.

### Module anatomy bottlenecks
- `src/ui/voiceModule.ts`
  - Heavy tab framing and dense grouped controls replicate old voice-card paradigm.
  - “Connections by select + IDs” remains secondary and non-spatial.
- `src/ui/triggerModule.ts`
  - Trigger UI still mirrors voice-card shell instead of distinct sequencing workspace.
  - Tabs duplicate old interaction style.
- `src/ui/visualModule.ts`
  - Visual modules wrapped in same card anatomy, reducing first-class “monitoring surface” identity.
- `src/ui/AddModuleSlot.ts`
  - Module browser implemented as just another card in the feed; composition action lacks dedicated affordance.

### Architectural-but-not-perceptual adapters
- `src/ui/state/voiceTabs.ts`
  - Enables per-card tab persistence, but this is invisible to users and reinforces existing card-tab model.
- `src/ui/app.ts`
  - Integrates modular backend cleanly, but mounts unchanged top-level UX pattern (header + module grid).

## 5. “What must become impossible”
The next redesign pass should make the following patterns impossible to ship:

- [ ] New module families reusing the exact same card anatomy by default.
- [ ] Connection editing hidden behind per-module tabs and dropdowns only.
- [ ] Placeholder tabs (“coming soon”) occupying primary module UI.
- [ ] Equal visual weight for unlike roles (trigger/synth/visual) with only label-level differentiation.
- [ ] A first screen where transport/preset utility controls visually dominate over composition/routing.
- [ ] Linear feed layout as the only representation of modular relationships.
- [ ] Add-module interaction represented as just another ordinary module card.

### Top 5 blockers to a visibly new interface
1. **Card-template monoculture across all module families.**
2. **Tab-first interaction model inherited from legacy voice cards.**
3. **Non-visual connection workflow (ID dropdowns instead of spatial patching/routing surface).**
4. **Over-dense global header dominating above-the-fold hierarchy.**
5. **Renderer output remains a vertical sectioned list, not a modular workspace.**

## 6. Prioritized redesign targets (highest → lowest impact)
1. **Replace the sectioned card feed with a flow-oriented module workspace** (lanes/canvas/zones that encode trigger → voice/effect → output relationships by layout).
2. **Promote routing/connection editing to a primary interaction layer** (direct linking, visible signal paths, persistent relationship map).
3. **Create family-specific module anatomies** (trigger = sequence-centric; synth = performance/timbre-centric; visual = large monitoring surfaces; utility = compact operators).
4. **Reframe the header into progressive disclosure** (core transport only in top bar; advanced/global actions in collapsible utility panel).
5. **Remove placeholder tabs and ship role-specific panels only** (no dead tabs in primary UI).
6. **Move add-module interaction out of the feed card pattern** (dedicated browser, quick-add palette, or contextual insertion affordance in workspace).
7. **Establish hard visual grammar rules per family** (size classes, density limits, allowed controls, default panel structures).
8. **Encode module relationships visually at all times** (source/target badges are supplemental, not primary).
