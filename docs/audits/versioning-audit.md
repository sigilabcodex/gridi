# GRIDI Versioning Audit

Date: 2026-04-17  
Scope: Repository-wide audit of version declaration, propagation, consistency, and strategy (report-only; no implementation changes)

---

## 1) Executive summary

### Facts

- GRIDI currently has **multiple independent version domains**, not one unified version system:
  - App/release version (`0.32.4`) in `package.json`, surfaced in UI via Vite define constants.
  - Patch schema version (`"0.3"`) in the persisted `Patch` shape and migration checks.
  - Preset/session payload version (`"0.33"`) and storage namespace (`gridi.presets.v0_33`).
  - Settings schema version (`1`) for user settings migration.
- The **runtime app version source of truth is effectively `package.json`**, but docs also hardcode the same number manually.
- Version propagation into the UI is technically solid (build-time injection + runtime formatting), but docs and roadmap references are manual and prone to drift.
- Version bump governance appears weak: no git tags, no release notes/changelog source of truth, and no explicit policy connecting roadmap milestones to version increments.

### Assessment

- The current `0.32.4` app version is plausible for pre-1.0 software, but it does **not currently carry strong semantic signal** relative to the pace and size of architectural changes.
- The biggest risk is not a wrong number; it is **version meaning erosion** (same version while substantial capability shifts happen, and many manually duplicated references).

---

## 2) Current version sources (detailed)

## 2.1 App/release version (product version)

### Source and usage

1. **`package.json`**
   - Declares app version: `"version": "0.32.4"`.
2. **`vite.config.ts`**
   - Reads `process.env.npm_package_version` into `semver`.
   - Injects `__APP_VERSION__` (and build metadata) via `define`.
3. **`src/version.ts`**
   - Exposes `APP_VERSION = __APP_VERSION__` and helper formatters.
4. **UI surfaces**
   - Header title tooltip uses `getVersionTooltipText()`.
   - Settings modal About block prints `Version`, `Build`, and `Branch`.

### Related manual duplicates

- README hardcodes `Current app version: 0.32.4`.
- `docs/status.md` hardcodes app version `0.32.4`.
- `ROADMAP.md` refers to current phase as `v0.32.x`.
- RFC/docs references also anchor work to `v0.32`/`v0.4` nomenclature.

---

## 2.2 Patch schema version (data model compatibility)

- `Patch` type hardcodes `version: "0.3"` in `src/patch.ts`.
- Patch construction/migration emits and expects `"0.3"`.
- Patch-like guards in persistence modules (`bankState.ts`, `presetStore.ts`) validate against `x.version === "0.3"`.

**Interpretation:** this is a schema contract version, not the app release version.

---

## 2.3 Preset/session payload version (preset storage protocol)

- `src/ui/persistence/presetStore.ts` defines `PRESET_EXPORT_VERSION = "0.33"`.
- Session/export payloads carry `version: "0.33"`.
- Storage key is namespaced as `gridi.presets.v0_33`.
- Architecture docs (`docs/architecture/bank-system.md`) document this same schema.

**Interpretation:** this is a storage format version for presets/sessions.

---

## 2.4 Settings schema version

- `src/settings/schema.ts` defines `SETTINGS_VERSION = 1`.
- `src/settings/store.ts` writes and migrates settings using this numeric version.

**Interpretation:** independent settings migration version (again, not app release semver).

---

## 2.5 Commit/release metadata (observability)

- Vite injects build metadata (`commit`, `branch`, `dirty`) into runtime constants.
- UI exposes branch/build in settings and tooltip text.
- Repository has **no git tags** for releases.

---

## 3) Version propagation analysis

## 3.1 Actual flow for app version

`package.json version` → `npm_package_version` env → Vite `define.__APP_VERSION__` → `src/version.ts` helpers → UI display surfaces.

This is good because app version text is not hardcoded in UI components.

## 3.2 Build metadata flow

Git metadata is read in `vite.config.ts` via shell calls, then injected:
- `__APP_BUILD__` from short SHA (`dev+<sha>[.dirty]`) or fallback labels.
- `__APP_BRANCH__` and `__APP_DIRTY__` similarly injected.

## 3.3 Dev vs prod behavior

- If git metadata is available, both dev and build paths include a SHA-based build token.
- If git metadata is unavailable:
  - development mode falls back build label to `dev`;
  - non-development falls back to `release`.
- If `npm_package_version` is unavailable, fallback is `0.0.0`.

**Risk:** in atypical build environments, fallback values may weaken traceability.

## 3.4 Non-app versions

Patch/preset/settings versions are hardcoded in their own modules and used at runtime during parse/migration; these do not automatically map to app semver.

---

## 4) Identified inconsistencies and duplication

## 4.1 No single authoritative “version map”

There is a single source for app semver (`package.json`), but **no single source describing all version domains** (app, patch schema, preset schema, settings schema). Developers must infer relationships manually.

## 4.2 Documentation duplication drift risk

`README.md` and `docs/status.md` hardcode `0.32.4`; roadmap/RFC files hardcode milestone labels. These are maintenance hotspots and can desynchronize from code.

## 4.3 Mixed numbering semantics

- App version: `0.32.4`
- Patch schema: `0.3`
- Preset schema: `0.33`

These are valid as separate domains, but without explicit policy they can be misread as directly related progression.

## 4.4 Release process opacity

- No git release tags.
- No canonical changelog/releases ledger linking version changes to milestone intent.
- Commit history shows many substantial changes after the last package version set, with no further app version bump governance visible.

---

## 5) Maturity vs version evaluation

## 5.1 Evidence of current maturity

Docs and implementation show GRIDI has moved far beyond a toy prototype:
- Deterministic scheduler and pattern window behavior.
- Multiple module families (trigger/drum/synth/control/visual).
- Routing model, migration logic, and significant UI shell architecture.
- Extensive iterative feature and architecture work in recent commits.

## 5.2 Does `0.32.4` reflect reality?

### What fits

- Remaining pre-1.0 is reasonable: routing ownership, MIDI/ecosystem expansion, and broader stabilization are still in progress.

### What does not fit well

- The patch-level perception (`.4`) under-communicates the scale of ongoing architectural/UI shifts.
- Milestone language in docs (`v0.32.x`, `v0.4`, `v0.5`) exists, but there is no enforced policy binding those milestones to actual bumps.

**Conclusion:** the issue is **not necessarily “too low” or “too high”**, but that the current number has weak operational meaning because bump criteria are unspecified.

---

## 6) Recommended versioning strategy (for GRIDI)

Adopt a **hybrid strategy**:

1. **App release version:** strict SemVer pre-1.0 (`0.y.z`) for distributable behavior.
2. **Schema versions:** independent, explicitly named compatibility versions:
   - `patchSchemaVersion`
   - `presetSchemaVersion`
   - `settingsSchemaVersion`
3. **Milestone mapping:** maintain a lightweight release ledger mapping app versions to roadmap phases and architectural intent.

Why this fits GRIDI:
- GRIDI is an evolving instrument with multiple persistence protocols; forcing one number for everything would be brittle.
- Hybrid separation preserves technical rigor while keeping contributor workflow simple.

---

## 7) Version lifecycle policy (proposed)

## 7.1 While pre-1.0 (`0.y.z`)

- **Patch (`z`)**
  - Bug fixes, UI polish, tests/docs/tooling, and non-breaking internal refactors.
  - No user-visible behavior contract shift.
- **Minor (`y`)**
  - New module behavior/capability, significant UX changes, routing semantics expansion, or any intentional behavior change users must adapt to.
  - Any schema migration introduction (even backward-compatible) should strongly favor at least minor bump.
- **Breaking changes**
  - Use release notes + migration notes; while pre-1.0, treat as minor bumps with explicit “breaking” annotation.

## 7.2 Schema version policy

- Increment schema version only when serialized format contract changes.
- Keep schema migration functions and compatibility notes adjacent to each schema domain.
- Do not couple schema version increments automatically to app patch increments.

## 7.3 Experimental/stable communication

- Mark unstable features as experimental via flags/docs, not by silent version behavior.
- Use prerelease identifiers when needed (`0.33.0-alpha.1`) for test builds intended for feedback before a stable cut.

---

## 8) Implementation recommendations (no code)

1. **Establish a written “Version Domains” contract** in docs (one page) describing each version type and ownership.
2. **Keep `package.json` as sole app semver source**, and treat all docs version literals as derived content.
3. **Introduce a release ledger** (`docs/releases.md`) with columns: app version, date, roadmap phase, notable changes, breaking notes, schema changes.
4. **Add lightweight CI guardrails** (policy checks) to detect manual drift (e.g., docs claiming current app version not matching package version if such claims remain).
5. **Standardize UI exposure**:
   - Header tooltip and settings About already good.
   - Consider a debug/export payload footer field for schema versions to help support/migration diagnostics.
6. **Adopt release tagging** (`v0.32.5`, etc.) so versions are discoverable and reproducible from git history.

---

## 9) Risks and anti-patterns to avoid

- Treating docs as authoritative for current version.
- Conflating app semver with schema versions.
- Bumping version only when remembered, not when policy triggers.
- Shipping behavior changes without corresponding release notes/migration notes.
- Using fallback build labels (`0.0.0`, `release`) in production artifacts without additional provenance metadata.

---

## 10) Suggested next steps

1. **Immediate next concrete step:** align on and document the version policy (app + schema + milestone mapping) in a dedicated short doc before any further bump decisions.
2. Add `docs/releases.md` and backfill recent releases/milestones from current history.
3. Start using git tags for every future app version release.
4. Remove or minimize hardcoded “current app version” literals in general docs, or enforce their consistency automatically.

---

## Appendix: quick evidence index

- App semver declaration: `package.json`.
- Build-time injection: `vite.config.ts`.
- UI version formatting + display consumers: `src/version.ts`, `src/ui/header/transportHeader.ts`, `src/ui/modals/settingsModal.ts`.
- Patch schema version: `src/patch.ts`, guards in `src/ui/persistence/bankState.ts` and `src/ui/persistence/presetStore.ts`.
- Preset schema version: `src/ui/persistence/presetStore.ts`, documented in `docs/architecture/bank-system.md`.
- Settings schema version: `src/settings/schema.ts`, `src/settings/store.ts`.
- Manual doc literals: `README.md`, `docs/status.md`, `ROADMAP.md`, relevant RFCs.
