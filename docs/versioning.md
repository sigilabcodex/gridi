# GRIDI Versioning Policy

Status: Active policy (pre-1.0)  
Last updated: 2026-04-17

## 1) Version domains (and why they are separate)

GRIDI has **four version domains**. They serve different purposes and must not be conflated.

1. **App version** (`package.json`, SemVer pre-1.0: `0.y.z`)
   - Purpose: release identity for the instrument behavior users run.
   - Scope: UI/runtime behavior, feature set, release communication.

2. **Patch schema version** (`Patch.version`, e.g. `"0.3"`)
   - Purpose: compatibility of saved patch structure and migration.
   - Scope: patch data model only.

3. **Preset/session schema version** (e.g. `"0.33"`)
   - Purpose: compatibility of imported/exported preset/session payloads.
   - Scope: preset/session storage and interchange only.

4. **Settings schema version** (integer, e.g. `1`)
   - Purpose: compatibility of user settings persistence.
   - Scope: settings migration only.

---

## 2) Core rules

### Rule A — App version is the release number
- Use `0.y.z` while pre-1.0.
- `y` and `z` describe **product behavior changes**, not raw commit count.

### Rule B — Schema versions are contract numbers
- Patch/preset/settings schema versions change **only** when their serialized contract changes.
- Schema version changes do **not** automatically require app patch bumps; bump app version according to user-visible impact.

### Rule C — Keep domains independent but documented together
- Domain numbers can differ (`0.32.4` app vs `0.3` patch schema).
- This is valid when documented clearly.

### Rule D — Do not use docs as source of truth for the current app version
- Canonical app version is `package.json`.
- Docs explain policy and milestones; they should not be treated as authoritative release state.

---

## 3) App version bump rules (pre-1.0)

## Patch bump (`0.y.z -> 0.y.(z+1)`)
Use for:
- bug fixes,
- small UX polish,
- internal refactors with no intentional behavior change,
- docs/tests/tooling updates.

## Minor bump (`0.y.z -> 0.(y+1).0`)
Use for:
- new or materially changed module behavior,
- routing semantics changes,
- MIDI or interoperability behavior additions,
- any change requiring users to relearn workflows,
- introduction of schema migrations with meaningful user impact.

## Breaking changes (still pre-1.0)
- Treat as at least a **minor bump**.
- Include explicit migration notes in release notes.

---

## 4) Schema bump rules

## Patch schema bump
Bump when patch JSON contract changes (new required fields, changed meaning, removed/renamed fields, migration path updates).

## Preset/session schema bump
Bump when preset/session import/export payload format changes.

## Settings schema bump
Bump when persisted settings shape changes and migration/defaulting rules are updated.

If schema changes are backward compatible via migration, still bump schema version if the serialized contract changed.

---

## 5) Relationship to GRIDI development phases

GRIDI roadmap phases (routing hardening, MIDI, performance readiness, ecosystem growth) should map to **app minor versions**, not patch versions.

Practical guidance:
- **Routing milestone changes** -> usually minor bump.
- **MIDI behavior landing** -> minor bump.
- **Performance-readiness hardening with no workflow shift** -> patch or minor based on user-visible change.
- **Large architectural shifts hidden from users** -> patch if behavior is unchanged; minor if behavior/expectations change.

---

## 6) Examples

- Example 1: fix scheduler edge-case bug, no workflow change  
  -> app **patch bump**.

- Example 2: add new trigger routing behavior users configure differently  
  -> app **minor bump**.

- Example 3: patch JSON adds a required routing field and migration is added  
  -> **patch schema bump** + app bump (usually minor if user-facing behavior changes).

- Example 4: preset export JSON gains new metadata field  
  -> **preset schema bump**; app bump based on user impact.

- Example 5: settings gains a new structured section with migration  
  -> **settings schema bump**; app bump optional unless behavior shifts.

---

## 7) What NOT to do

- Do not treat app, patch schema, preset schema, and settings schema as one shared counter.
- Do not bump app version only because many commits landed.
- Do not leave behavior-changing releases at the same app version.
- Do not hardcode “current version” across multiple docs as authoritative state.
- Do not change schema formats without a schema version bump and migration note.

---

## 8) Lightweight process checklist (manual, no new tooling)

Before merge of a release-relevant PR:
1. Did user-visible behavior change materially? If yes, plan app minor; otherwise patch.
2. Did any serialized contract change (patch/preset/settings)? If yes, bump that schema version.
3. Add a short release note entry (version, intent, migration notes if any).
4. Tag the release commit (`v0.y.z`) when cut.

---

## Why this policy fits GRIDI

GRIDI is an evolving instrument with multiple persistence contracts and ongoing architectural iteration. This policy keeps things simple: one clear release number for users, separate schema numbers for data compatibility, and minimal rules that match real milestone-driven development.

## Next smallest implementation step

Create a tiny `docs/releases.md` table (version, date, milestone, notable change, schema changes, migration notes) and start filling it from the next release onward.
