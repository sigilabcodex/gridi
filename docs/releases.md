# GRIDI Release Ledger

This file is the canonical, lightweight history of GRIDI releases and milestones.
Use it alongside `docs/versioning.md`: the versioning policy defines **how versions are chosen**, while this ledger records **what was released**.

When shipping a new release, add a new row at the top with only high-confidence details. If historical precision is unclear, keep entries broad and minimal.

| Version | Date | Phase / milestone | Summary | Schema changes (if any) | Notes / migration info (optional) |
| ------- | ---- | ----------------- | ------- | ----------------------- | ---------------------------------- |
| 0.33.0 | 2026-05-05 | v0.33 GEN/UI stabilization baseline (current) | GEN mode registry/staging metadata, display truthfulness contract, RADAR semantic correction with SONAR reserved for future mode family, mode-aware `Main | Fine-tune | Routing` tab grammar, GEN velocity/accent semantics alignment, multi-mode display truthfulness improvements, scheduler live-edit spike fix, and broader UI/faceplate stabilization. | None noted (`Patch 0.3`, preset/session `0.33`, settings `1` unchanged). | Stabilization baseline release; roadmap continuity preserved toward `v0.4` performance routing consolidation. |
| 0.32.4 | 2026-04-17 | v0.32.x stabilization | Current release baseline; stability-focused cycle with routing/versioning audits and UI shell hardening. | None noted (`Patch 0.3`, preset/session `0.33`, settings `1` unchanged). | Ledger baseline entry. |
| 0.32.3 (approx) | 2026-04 (approx) | v0.32.x stabilization | Mobile shell and compact controls refinements (portrait/short-height fixes, parameter editing UX). | None noted. | Backfilled from recent commit patterns; keep approximate. |
| 0.32.x | 2026 (in progress) | Sequencing separation | MAIN/SEQ/MIDI tab separation and deterministic scheduler overlap behavior. | Patch schema `0.3` active in this phase. | Milestone-level row (not a precise release cut). |
| 0.31 | 2026 (partial) | Core reinforcement | Pattern source abstractions, routing foundations, and UI/engine coupling cleanup. | Not backfilled. | Minimal historical placeholder. |
| 0.30 | 2026 (completed) | Modular baseline | Dynamic module grid, add-slot flow, patch persistence, and initial visual modules/transport controls. | Not backfilled. | Milestone-only baseline row. |
