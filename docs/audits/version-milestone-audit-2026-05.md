# Version & milestone audit — 2026-05 (post GEN/UI stabilization)

## Scope

Audit targets requested in this pass:
- `package.json`
- visible version display paths in `src`
- `README.md`
- `ROADMAP.md`
- `docs/status.md`
- version/release policy docs and prior audits

This is an **audit-first** report. No runtime/package version values were changed in this pass.

## 1) Current version references (where defined/displayed)

### Canonical app version (release number)
- `package.json` defines app version as `0.32.4`.

### Build-time propagation into runtime/UI
- `vite.config.ts` injects `__APP_VERSION__` from `process.env.npm_package_version`.
- `src/version.ts` reads injected values via `APP_VERSION` and exposes helpers:
  - `getVersionDetails()`
  - `getVersionTooltipText()`
  - `getVersionBuildString()`

### Visible UI surfaces
- Header transport uses version tooltip text via `src/ui/header/transportHeader.ts`.
- Settings/About modal renders `Version {version} • Build {build} • Branch {branch}` via `src/ui/modals/settingsModal.ts`.

### Narrative/docs references (manual literals)
- `README.md` states: `Current app version: 0.32.4`.
- `docs/status.md` states: `App version: 0.32.4`.
- `ROADMAP.md` labels current phase as `v0.32.x` stabilization.
- `docs/releases.md` currently lists `0.32.4` as baseline entry.

## 2) Is `0.32.4` still present?

Yes. It remains present in:
- `package.json` (authoritative app semver)
- docs (`README.md`, `docs/status.md`, `docs/releases.md`)
- roadmap phase naming (`v0.32.x` in `ROADMAP.md`)

## 3) Does package version match visible UI version?

Yes, currently **yes**:
- Package version is `0.32.4`.
- Runtime/UI pulls app version from Vite-injected `npm_package_version`, so the visible UI version tracks `package.json` directly.

No mismatch was found between package and UI display source.

## 4) Milestones completed since the long-standing `0.32.4` framing

Based on status/roadmap/audit docs, GRIDI has completed a substantial stabilization tranche that goes beyond a trivial patch narrative:

- GEN mode cleanup and convergence work.
- Display truthfulness contract and corrections across multiple modes.
- RADAR semantic correction + SONAR reserved as separate future mode family.
- Mode-aware `Main | Fine-tune | Routing` tab grammar standardization.
- Velocity/accent semantic alignment.
- Multiple mode display correctness passes.
- Scheduler live-edit spike fix and sequencing reliability hardening.
- Broader shell/routing/UI stabilization and interaction cleanup.

Interpretation: this is a **cohesive milestone-scale refinement phase**, not isolated micro-fixes.

## 5) Should the project bump version now?

**Recommendation: yes** (for next release cut), because:
- User-visible behavior/clarity meaningfully improved across core instrument surfaces (GEN + shell/routing semantics).
- Milestone language and actual shipped maturity are now outgrowing a static `0.32.4` narrative.
- Maintaining `0.32.4` after this phase increases “version meaning erosion,” even if technically valid pre-1.0.

## 6) If yes, to what?

**Recommended next app version: `0.33.0`.**

Rationale:
- Pre-1.0 SemVer convention: minor bumps (`0.y.0`) communicate meaningful capability/stability milestone shifts.
- This phase is best represented as a stabilization milestone completion rather than a patch-level hotfix.
- `0.33.0` preserves continuity with existing roadmap naming while clearly signaling new baseline maturity.

## 7) Which versioning model should GRIDI use?

Use a hybrid with clear boundaries:

1. **App release version:** SemVer pre-1.0 (`0.y.z`) as the user-facing release number.
2. **Milestone mapping:** Keep roadmap milestones (`v0.32.x`, `v0.4`, `v0.5`) as planning language mapped to app releases in `docs/releases.md`.
3. **Schema versions:** Keep independent contract versions for patch/preset/settings (already established).
4. **Alpha/prerelease tags:** Use only for intentionally pre-stable test cuts (e.g., `0.33.0-alpha.1`) before formal release.
5. **Human-readable codenames:** optional later, additive only; never replace numeric SemVer.

## 8) Future bump trigger rules

### App patch bump (`0.y.z+1`)
Trigger when:
- Bug fixes/refinements with no milestone-level contract or UX-meaning shift.
- No new architecture boundary crossed.

### App minor bump (`0.y+1.0`)
Trigger when:
- A milestone tranche lands with clear user-visible workflow/semantic change (like this GEN/UI stabilization phase).
- Routing/domain model ownership or module-face grammar changes meaningfully.
- Significant instrument-surface coherence upgrades are shipped.

### Schema bumps (independent)
Trigger when serialized contracts change:
- `Patch.version`
- preset/session export version
- settings schema version

Do not bump schema versions just because app version changes; do bump them whenever contract changes, with migration notes.

## Immediate recommendation (this pass)

- **Do not change runtime/package version in this audit-only pass.**
- Prepare a follow-up release PR to:
  1. bump `package.json` to `0.33.0`,
  2. align doc literals that intentionally state current app version,
  3. append a concrete `0.33.0` entry in `docs/releases.md` summarizing the GEN/UI stabilization milestone.

## Suggested next milestone name

After GEN/UI stabilization, suggested milestone framing:

- **`v0.33` — GEN/UI stabilization release baseline** (release cut milestone)
- followed by
- **`v0.4` — Performance routing consolidation** (as already planned in roadmap)

This keeps roadmap continuity while acknowledging the completed GEN/UI tranche as a real release boundary.
