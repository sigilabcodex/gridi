# Naming & Identity Audit — GRIDI → xGRIDI (audit-only)

Date: 2026-04-18  
Scope: Repository-wide naming/identity inspection (no rename performed)

---

## 1) Executive summary

This repository contains many references to the current project identity (`GRIDI` / `gridi`), but most are **shallow, text-level references** (docs, headings, UI labels). A smaller subset are **technically sensitive identity couplings**: package name, GitHub Pages base path, localStorage namespaces, exported filename prefixes, and custom event/DOM ID prefixes.

### Bottom line

- **User-facing name usage:** frequent and broad (README/docs/UI).
- **Developer-facing name usage:** present in package/build/deploy setup.
- **Internal technical identifiers:** present and important, but concentrated in a small set of files.
- **Overall depth:** **moderate**, not deeply invasive across architecture.

Given the current repository state, a rename is feasible without rewriting core architecture, but it should be staged with explicit compatibility handling for persisted data and web deployment path changes.

---

## 2) Naming inventory

Audit scan found `GRIDI/gridi` references in **43 files** (excluding `.git` and `node_modules`) and **91 matched lines**.

### 2.1 User-facing naming

These are visible to end users and should usually be renamed if brand identity changes:

- App title/favicon surface in HTML:
  - `<title>GRIDI</title>` and logo path in `index.html`.
- Runtime app identity constants:
  - `APP_NAME = "GRIDI"`, subtitle expansion, title string builder in `src/version.ts`.
- UI header/modal strings:
  - Header title and subtitle in `src/ui/header/transportHeader.ts`.
  - Settings "About" surface and welcome modal content in `src/ui/modals/settingsModal.ts` and `src/ui/modals/welcomeModal.ts`.
- Documentation and contributor surfaces:
  - `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`, many files under `docs/`.

### 2.2 Developer-facing naming

These are visible to contributors/tooling and affect setup/build expectations:

- Package metadata:
  - `package.json` and lockfile use package name `gridi`.
- Build/deploy assumptions:
  - Vite GH mode base path is hardcoded to `/gridi/` in `vite.config.ts`.
  - GitHub Pages workflow builds with `npm run build:gh` in `.github/workflows/pages.yml`; path behavior depends on that Vite base.
- Setup instructions:
  - README setup says `cd gridi`.

### 2.3 Internal technical identifiers

These are not just presentation strings; changing them may impact compatibility or runtime behavior:

- localStorage namespaces:
  - `gridi.settings` (`src/settings/store.ts`)
  - `gridi.presets.v0_33` (`src/ui/persistence/presetStore.ts`)
  - `gridi.module-presets.v1` (`src/ui/persistence/modulePresetStore.ts`)
  - `gridi.state.v0_30` legacy key (`src/ui/persistence/bankState.ts`)
- Download/export filenames:
  - `gridi-<preset>.json`, `gridi-session.json` in `src/ui/app.ts`.
- DOM/event IDs:
  - `gridi-user-css` style element id in `src/ui/app.ts`.
  - `gridi-history-gesture-*` custom events in `src/ui/app.ts`, `src/ui/knob.ts`, `src/ui/ctl.ts`.
  - `gridi-tooltip-*` id prefix in `src/ui/tooltip.ts`.
- Brand assets and names in paths:
  - `src/ui/logo/GRIDI_logotype_round_90deg_v1.svg`
  - `src/ui/logo/GRIDI_modular_grid_v1.svg`
  - `docs/gridi-gui-north-star.md`

### 2.4 Historical/legacy surfaces

- `rc/legacy/main_v01_legacy.ts` and `rc/ui-react/font.tsx` include GRIDI naming and logo identity. These appear archival/reference-oriented, but still part of repository identity and search surface.

---

## 3) Coupling/risk classification

### Class A — Trivial text replacement (low risk)

- Most docs headings/body mentions (`GRIDI`) across README/ROADMAP/docs.
- UI copy bound to `APP_NAME` and static text in modal/header.
- Comments and style comments (e.g., "verde GRIDI").

**Risk profile:** low; mostly editorial and consistency work.

### Class B — Moderate rename risk

- Package name `gridi` in `package.json` and `package-lock.json`.
- File/path names with `gridi`/`GRIDI` in docs/assets.
- README setup command (`cd gridi`) and any scripts/docs expecting folder naming.

**Risk profile:** moderate; tools and references may break if path/package assumptions aren’t updated together.

### Class C — Sensitive technical coupling

1. **GitHub Pages base path `/gridi/`** in Vite GH mode.
   - Directly affects runtime asset resolution when deployed from Pages.
   - If repo or Pages path changes, this must be updated in lockstep.

2. **localStorage key namespaces**.
   - Renaming keys without migration will make existing user data appear "lost".
   - Needs backward-compatibility read path or one-time migration strategy.

3. **Export filename prefixes**.
   - Lower risk technically, but downstream user workflows/scripts may rely on naming conventions.

4. **Custom event/ID prefixes**.
   - Internal-only today, but changing requires consistency across emit/listen sites.

**Risk profile:** high relative to simple string edits; should be planned as a compatibility phase.

---

## 4) Rename-in-place analysis (Option 1)

### What this means

Keep current repository and history; perform staged rename from GRIDI → xGRIDI in code/docs/config.

### Pros

- Preserves full git history, open PR continuity, issue references, stars/watchers, and contributor familiarity.
- Lower operational overhead than spinning up a second canonical repo.
- Can be executed incrementally:
  1) user-facing rename,
  2) deployment path updates,
  3) persistence compatibility/migration.

### Cons / required care

- Requires careful sequencing to avoid data breakage (localStorage keys) and Pages breakage (`/gridi/` base path).
- Temporary mixed identity may exist during transition if staged over multiple PRs.

### Effort estimate (qualitative)

- **Low-to-moderate** for docs/UI/package updates.
- **Moderate** for deployment and persistence-safe migration.

### Continuity impact

- Best continuity for repository ecosystem (links, history, PRs/issues).
- If GitHub repo itself is renamed, GitHub redirects generally help, but Pages path assumptions still require explicit handling.

---

## 5) New-repo migration analysis (Option 2)

### What this means

Create a new canonical repo for xGRIDI, migrate code, and archive/redirect old repo.

### Pros

- Very clean outward identity from day one in the new repo.
- No need to carry transitional naming compromises in repo metadata.

### Cons

- Splits or complicates history continuity unless mirrored carefully.
- Breaks/disrupts existing issue/PR workflows and inbound links unless heavy redirect and communication process is maintained.
- More coordination burden (CI secrets/settings, Pages setup, branch protections, integrations, docs links, contributor habits).
- Increases migration surface beyond code rename itself.

### Effort estimate (qualitative)

- **Moderate-to-high** operational effort even if code changes are small.

### Search / AI disambiguation

- New repo can improve name-level disambiguation, but you can get most of that benefit by in-place rename plus clear docs/repo description updates.

---

## 6) Recommendation

### Recommended path: **Option 1 — Rename in place**

For this project’s current stage, rename-in-place is cleaner and safer overall.

Reasoning from repo inspection:

1. Core runtime architecture is not identity-coupled; naming is mostly docs/UI/config.
2. Sensitive couplings exist but are concentrated and manageable (`/gridi/` base path + storage namespaces + file/export prefixes).
3. Existing docs/history are active and extensive; preserving continuity is valuable.
4. A new repo would add process risk without clear technical necessity.

### Classification verdict

Current name is **not deeply embedded in core architecture**, but it is **moderately embedded in operational surfaces** (deployment and persistence namespaces). That supports staged in-place rename, not repo replacement.

---

## 7) Risks / anti-patterns to avoid

1. **Blind global find/replace** across storage keys and deployment path.
2. **Renaming localStorage keys without migration/fallback reads**.
3. **Changing Pages base path without validating deployment URL behavior**.
4. **Mixing branding rename with unrelated refactors** in one large PR.
5. **Case inconsistency** with intentional lowercase `x` in `xGRIDI`.
6. **Forgetting non-code identity surfaces** (docs filenames, logo asset names, README clone path, package metadata).

---

## 8) Suggested next step (safest next prompt)

Use a planning-only follow-up prompt to generate a staged execution plan (still no code changes), e.g.:

> "Create a phased rename plan for GRIDI → xGRIDI with explicit checklists for (1) user-facing strings, (2) package/build/deploy metadata, (3) persistence/storage migration compatibility, (4) docs/path cleanup, and (5) rollout/verification gates. Include rollback points and required tests per phase."

This keeps rename risk controlled before implementation begins.

---

## 9) Optional appendix — concise file/path inventory

### High-priority technical identity files

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `.github/workflows/pages.yml`
- `src/version.ts`
- `src/main.ts`
- `src/settings/store.ts`
- `src/ui/persistence/presetStore.ts`
- `src/ui/persistence/modulePresetStore.ts`
- `src/ui/persistence/bankState.ts`
- `src/ui/app.ts`
- `src/ui/knob.ts`
- `src/ui/ctl.ts`
- `src/ui/tooltip.ts`
- `index.html`

### Brand/path identity assets

- `src/ui/logo/GRIDI_logotype_round_90deg_v1.svg`
- `src/ui/logo/GRIDI_modular_grid_v1.svg`
- `docs/gridi-gui-north-star.md`

### Broad documentation identity surface

- `README.md`, `CONTRIBUTING.md`, `ROADMAP.md`
- Multiple `docs/*.md` and `docs/**/**/*.md` files with GRIDI naming.
