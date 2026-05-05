# GRIDI settings surface cleanup audit (2026-05)

Date: 2026-05-05  
Scope: focused settings surface cleanup (small IA/copy organization only; no runtime/audio behavior changes).

## Files inspected

- `README.md`
- `docs/status.md`
- `docs/ui-principles.md`
- `docs/audits/interaction-architecture-audit-2026-05.md`
- `src/ui/modals/settingsModal.ts`
- `src/ui/modals/welcomeModal.ts`
- `src/ui/header/transportHeader.ts`
- `src/settings/schema.ts`
- `src/settings/store.ts`
- `src/settings/types.ts`
- `src/main.ts`

---

## 1) Current settings state (pre-change)

### Current UI surface

- Settings are opened from the transport/header gear action.
- Settings modal contains:
  - intro/tips block,
  - About block,
  - dynamic sections generated from `settingsSchema`.

### Current persisted settings shape

- Settings are persisted in localStorage under `gridi.settings`.
- Current categories in state model:
  - `ui.*`
  - `audio.*`
  - `data.*`
  - `ux.*`

### Current controls by intent category

- Stable user preferences:
  - `ui.theme`
  - `ui.controlStyle`
  - `ui.reduceMotion`
  - `ux.tooltips`
  - `data.autosave`
  - `ui.hideWelcome`
- Audio/global behavior:
  - `audio.masterGain`
  - `audio.limiterEnabled`
- Experimental:
  - `ui.experimental`
- Developer-adjacent:
  - `ui.customCss`
- App/resources:
  - About copy + GitHub/docs links in settings modal

### Gaps / friction observed

- Section naming was technically correct but broad (`General`, `Data`, `UX`) and less aligned with current instrument IA direction.
- About block already existed but did not explicitly surface the long-form acronym line as a dedicated identity row.
- Experimental and developer-adjacent controls were not visually separated as clearly as they could be.

---

## 2) Changes made in this cleanup pass

### A) Clarified section IA via schema section labels only

Reorganized section labels in `settingsSchema` (no key/path/default/runtime behavior changes):

- `Interaction`
  - `ui.theme`
  - `ui.controlStyle`
  - `ui.reduceMotion`
  - `ux.tooltips`
- `Global Behavior`
  - `data.autosave`
  - `ui.hideWelcome`
- `Audio / MIDI`
  - `audio.masterGain`
  - `audio.limiterEnabled`
- `Experimental`
  - `ui.experimental`
- `Developer / Advanced`
  - `ui.customCss`

This is intentionally light-touch: existing storage shape remains intact and the modal rendering pipeline remains unchanged.

### B) Strengthened About / Resources identity content

Updated settings About section to:

- use explicit heading `About / Resources`,
- keep short GRIDI identity line,
- add explicit long-form acronym line:
  - `Generative Relational & Interactive Digital Instrument`,
- keep links:
  - GitHub: `https://github.com/sigilabcodex/gridi`
  - Documentation: `https://github.com/sigilabcodex/gridi/tree/main/docs`
- preserve secure external link attributes (`target="_blank"` with `rel="noopener noreferrer"`).

---

## 3) Recommended target structure (next safe iterations)

Use this as the stable settings architecture path:

1. **About / Resources**
   - identity lines
   - version/build/branch
   - GitHub + docs links

2. **Global Behavior**
   - autosave/session-level behavior
   - future transport/session preferences

3. **Interaction**
   - control style/UX behavior
   - reduced motion/tooltips
   - future desktop/mobile behavior preferences
   - future multi-select/batch interaction preferences

4. **Audio / MIDI**
   - master/limiter (current)
   - future MIDI input behavior prefs (if added)

5. **Experimental**
   - unstable feature toggles only, clearly marked

6. **Developer / Advanced** (optional long-term keep)
   - custom CSS and other power-user controls that should not mix with core performer preferences

---

## 4) Deferred work (intentionally not done in this pass)

- No new settings data model.
- No migration/schema version changes.
- No routing/session/preset semantics changes.
- No audio engine/generation behavior changes.
- No UI shell resizing/scroll behavior changes.
- No large settings component refactor.
- No MIDI settings expansion.

---

## 5) Outcome

Settings now reads closer to an instrument-grade global surface:

- clearer section semantics,
- explicit About/Resources identity,
- cleaner split between stable preferences, experimental toggles, and developer-adjacent controls,
- preserved runtime behavior and compact modal implementation.
