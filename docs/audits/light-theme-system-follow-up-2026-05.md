# Light Theme System Follow-up — Deferred UI-system task

Date: 2026-05-06  
Scope: deferred UI-system planning note for a real light theme. This is intentionally separate from the first `v0.4` Routing architecture audit/planning pass.

## Context

GRIDI currently exposes a `ui.theme` setting with `dark` and `light` choices, but the light option should be treated as a placeholder until the UI theme system is audited and completed. The app's visual implementation still primarily assumes the dark instrument surface through root CSS tokens and explicit dark color-scheme declarations.

This work should be scheduled after the initial routing audit/planning pass so routing ownership and signal-flow decisions are not mixed with broad visual-system changes.

## Future work checklist

- Audit existing theme tokens and CSS variables before adding new colors.
- Check where theme state is stored, read, and applied across settings, app startup, and UI rendering.
- Make sure dark/light mode affects all module faceplates consistently, including GEN, DRUM, SYNTH, CTRL, and VIS surfaces.
- Test readability and contrast for GEN displays, chips, controls, routing indicators, transport UI, floating panels, and settings surfaces.
- Avoid one-off color overrides that would make future theming harder to maintain.
- Preserve GRIDI's instrument-like visual identity in both dark and light themes; light mode should not become a generic web-app skin.

## Guardrails

- Do not implement this as a routing-audit side effect.
- Prefer token-level theme architecture over component-local overrides.
- Treat faceplate grammar, routing visibility, and transport controls as first-class theme consumers.
- Include manual visual QA once the theme is implemented; readability matters as much as token completeness.
