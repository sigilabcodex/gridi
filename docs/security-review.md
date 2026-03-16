# GRIDI Security Review

Date: 2026-03-15
Scope: static review of client-side TypeScript/WebAudio app and repository workflows.

## Summary

No critical exploit pattern was found in current source. Main risks are future-facing and relate to user-provided content persistence, DOM insertion patterns, and dependency supply-chain hygiene.

## Findings

### 1) User CSS injection surface (intentional but high-impact)

- **Location:** `applyUserCss` path in UI app initialization.
- **Risk:** custom CSS can alter UI visibility/click targets and mislead users (UI redress/local abuse).
- **Current status:** expected behavior for customization; scoped to local settings.
- **Action required:** monitor; low immediate risk.
- **Mitigation:** consider optional CSS sanitization/allowlist or a clear “unsafe custom CSS” warning in settings UI.

### 2) `innerHTML` usage in UI rendering paths

- **Location:** module grid reset and modal content rendering paths.
- **Risk:** potential XSS if future changes interpolate untrusted strings into HTML templates.
- **Current status:** currently used with controlled static/known content.
- **Action required:** preventative.
- **Mitigation:**
  - prefer `textContent` and explicit node creation for dynamic user values,
  - keep templated HTML static,
  - document this constraint for contributors.

### 3) Local persistence trust boundary

- **Location:** `localStorage` settings and bank state loading.
- **Risk:** malformed or tampered local state could destabilize runtime expectations.
- **Current status:** guarded parsing and patch migration are present.
- **Action required:** low.
- **Mitigation:** continue strict migration/defaulting and reject malformed structures early.

### 4) Console warning disclosure in routing validation

- **Location:** routing validation warnings emitted to console.
- **Risk:** low; may expose implementation details during shared-screen demos.
- **Current status:** acceptable for development-oriented application.
- **Action required:** none now.
- **Mitigation:** optional debug-level gating in production builds.

### 5) Dependency supply-chain / reproducibility

- **Location:** npm dependencies and CI install path.
- **Risk:** unpinned transitive resolution drift and compromised upstream packages.
- **Current status:** lockfile exists; CI uses `npm ci`.
- **Action required:** medium.
- **Mitigation:** keep direct dependency versions pinned and periodically run `npm audit` in a trusted network.

## WebAudio-specific review notes

- Scheduler uses look-ahead timing with `AudioContext.currentTime`, which is good for timing safety.
- No `AudioWorklet` dynamic code loading was observed.
- No `eval`/`new Function` patterns were observed.

## Recommended follow-up cadence

- Re-run this review at each minor version milestone.
- Add a lightweight checklist item in PR template for DOM insertion and localStorage migration changes.
