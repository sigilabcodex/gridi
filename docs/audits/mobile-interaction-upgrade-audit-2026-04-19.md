# Mobile Interaction Upgrade Audit (documentation-first)

Date: 2026-04-19  
Scope: roadmap placement and implementation readiness for mobile interaction upgrades (no feature implementation in this pass).

## Executive decision

This work should be **split across phases**, not shipped as one milestone:

1. **Now (`v0.32.x` stabilization):** docs + architecture prerequisites only (gesture ownership contract, interaction boundaries, transient surface rules, conflict matrix).
2. **Next (`v0.4`):** implement a **left-edge global controls drawer** (transport/session/global utilities) with strict gesture arbitration.
3. **Later (`v0.45` stage/workspace):** introduce stage navigation UI, likely as a compact selector first; evaluate right-edge drawer after stage model is concretely implemented.

Reason: the repository already treats stages as planned workspace segmentation (`v0.45`), while mobile global-controls pressure is already explicitly called out as near-term in status docs.

---

## Grounded findings from current repo

## 1) What is already aligned

- The docs already recommend a dedicated mobile global-controls pattern (compact launcher + sheet/drawer direction). That aligns with a **left-edge/global drawer** concept.  
- UI doctrine already prefers compact module faces and transient precision surfaces rather than dense always-visible editors.  
- Existing control architecture already uses floating/transient editors (`ctlFloat`) with viewport-clamped panel placement and keyboard escape behavior.

## 2) What is not ready yet

- Gesture ownership is not centralized. Transient panels and menus are closed by multiple ad hoc `document.pointerdown` listeners in separate modules.
- There is no app-level edge-gesture arbitration layer; edge navigation gestures and in-module pointer interactions are currently unmanaged as a shared policy.
- Stage UX is doctrine-defined but still a planned milestone; a right-edge stage drawer today would front-run unfinished stage architecture.

## 3) Existing UI/architecture signals relevant to placement

- Current roadmap marks `v0.32.x` as stabilization and `v0.45` as Stage/Workspace introduction.
- Current status explicitly calls out a dedicated mobile global-controls pattern as the recommended next step.
- Current transport already has compact-global launcher behavior and collapse/expand logic, which is a compatible stepping stone for a drawer-based global surface.

---

## Answers to requested questions

## 1) Where does this mobile interaction work belong?

**Recommendation: split across phases.**

- **`v0.32.x` (now):** only preparatory structure and doctrine updates; no broad UI rewrite.
- **`v0.4`:** left-edge global drawer implementation + gesture-ownership infrastructure.
- **`v0.45+`:** stage navigation UX (compact selector first), with right-edge drawer deferred until stage model and usage patterns are stable.

## 2) Which parts align vs require doctrine change?

### Already aligned with doctrine
- Mobile global control consolidation (header minimization on small screens).
- Transient precision editing over cramped inline controls.
- Fixed shell and no internal-scroll policy preserved.

### Requires doctrine clarifications/updates
- Explicit **gesture ownership doctrine** (edge gestures reserved for drawers; modules own interior interactions).
- Canonical **transient interaction stack policy** (z-index/lifecycle/focus/escape/outside-click ownership across all floating surfaces).
- Stage navigation form factor policy (compact selector baseline before drawer escalation).

## 3) Is left-edge transport/global drawer roadmap-compatible first?

**Yes — this is the best first functional step after prerequisites.**

It directly addresses the documented mobile pain and status backlog without changing stage semantics.

## 4) Is right-edge stage drawer compatible now?

**Not as a first move.**

It is conceptually compatible with the stage philosophy, but practically premature before stage system delivery. For initial stage rollout, a **compact selector/control** is more doctrine-consistent and lower-risk.

## 5) Best touch-safe parameter editing pattern under constraints?

Use and standardize the existing direction:

- Keep direct performative controls on module faces.
- Use tap-to-open transient value surfaces for precision edits.
- Keep horizontal edge zones reserved for navigation gestures.
- Within editors, avoid horizontal gestures that can conflict with drawer intent; prefer explicit sliders/steppers plus numeric input.

## 6) What architecture must change first for gesture ownership?

Introduce a top-level interaction layer (single ownership service/store) that:

- arbitrates gesture intent (edge-nav vs module-edit),
- coordinates transient UI open/close behavior,
- enforces one canonical escape/outside-click contract,
- exposes explicit APIs to modules/header for claiming/releasing interaction ownership.

Without this, drawer gestures will conflict with the current distributed listeners and module pointer handling.

## 7) Main risks

1. **Gesture conflicts:** edge swipe vs knob/slider drag vs grid drag.
2. **Shell violations:** oversized drawers/sheets causing implicit mini-app behavior.
3. **Transient clutter:** many independent floating panels with inconsistent dismissal/focus rules.
4. **Routing/state coupling risk:** accidental transport/routing side-effects from UI refactors around app-level orchestration.
5. **Accessibility risk:** gesture-only paths or weak keyboard/screen-reader equivalents.
6. **Testing fragility:** interaction behavior spread across multiple modules without a centralized contract.

## 8) What should be implemented first, second, later?

### First (prerequisite phase; documentation + architecture)
- Write gesture-ownership RFC/spec.
- Define transient-surface lifecycle contract.
- Define edge-gesture exclusion zones and precedence table.
- Add test-plan skeleton for interaction arbitration.

### Second (delivery phase in `v0.4`)
- Implement left-edge global drawer (transport/session/global only).
- Migrate existing compact launcher logic into drawer trigger(s).
- Wire drawer behavior through new interaction ownership layer.

### Later (`v0.45+`)
- Ship stage model and compact stage selector first.
- Re-evaluate right-edge drawer only after real stage workflows are validated.

---

## Files/modules most likely affected (when implementation begins)

## Primary architecture + app ownership
- `src/ui/app.ts`
- `src/ui/header/transportHeader.ts`
- `src/ui/floatingPanel.ts`
- `src/ui/style.css`

## Parameter/transient editing surfaces
- `src/ui/ctl.ts`
- `src/ui/knob.ts`
- `src/ui/tooltip.ts`
- `src/ui/modulePresetControl.ts`
- `src/ui/triggerModule.ts`
- `src/ui/visualModule.ts`

## Workspace interaction + potential gesture contention
- `src/ui/render/moduleGrid.ts`
- `src/ui/AddModuleSlot.ts`

## Doctrine/docs (should update before code)
- `docs/ui-principles.md`
- `docs/status.md`
- `ROADMAP.md` (if milestone language is adjusted)
- new RFC under `docs/rfcs/` for gesture ownership and transient interaction stack

---

## Do now / Do later / Avoid

## Do now
- Update docs first: gesture ownership, drawer boundaries, stage-control sequencing.
- Approve phase split (global drawer before stage drawer).
- Define non-negotiable invariants: fixed shells, no internal scrollbars, deterministic runtime boundaries.

## Do later
- Right-edge stage drawer exploration after stage model lands and compact selector usage is validated.
- Additional gesture richness beyond edge open/close (if still needed after usage feedback).

## Avoid
- Shipping bilateral edge drawers before gesture arbitration exists.
- Introducing inspector-like persistent side panels.
- Embedding precision editors permanently into already dense module faces.
- Coupling routing/runtime behavior changes to mobile navigation rollout.

---

## Should docs be updated before code?

**Yes, explicitly yes.**

This initiative crosses UI doctrine boundaries (gesture reservations, transient ownership, stage navigation semantics). The repository is currently in a stabilization posture, so doctrine and ownership contracts should be locked before implementation PRs.

---

## Suggested PR strategy

## Small safe spike (optional)
- Non-invasive spike: add an internal interaction-ownership skeleton with no UI behavior change (single source of truth for active transient owner + debug logging for edge-intent classification).
- Goal: validate integration points and test harness shape, not ship drawers.

## Larger follow-up PR plan
1. RFC + docs updates (gesture ownership, edge rules, transient stack contract).
2. Interaction owner implementation and migration of existing floating surfaces to shared close/escape APIs.
3. Left-edge global drawer implementation replacing/augmenting compact launcher.
4. Mobile interaction test coverage pass (keyboard + pointer + touch intent regression suite).
5. Stage selector rollout in stage milestone; only then assess right-edge drawer necessity.
