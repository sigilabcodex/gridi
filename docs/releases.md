# GRIDI Release Ledger

This file is the canonical, lightweight history of GRIDI release versions and major milestones.
It complements (but does not replace) the rules in `docs/versioning.md`: use this ledger to record **what shipped** and whether any schema contracts changed.

When adding a new entry, append a new row at the top for the newest release, keep summaries short, and avoid reconstructing uncertain historical detail.

| Version | Date | Phase / milestone | Summary | Schema changes (if any) | Notes / migration info (optional) |
| ------- | ---- | ----------------- | ------- | ----------------------- | ---------------------------------- |
| 0.32.4 | 2026-04-17 | v0.32.x stabilization (current) | Current app release; recent work focused on shell/mobile stability, routing audits, and formalized version policy. | None noted for this release snapshot (`Patch 0.3`, preset/session `0.33`, settings `1` unchanged). | Documentation baseline entry for ledger creation. |
| 0.32.x | 2026 (in progress) | Sequencing separation | MAIN/SEQ/MIDI tab separation, deterministic scheduler overlap behavior, and active patch `0.3` model in roadmap/docs. | Patch schema `0.3` active in this phase. | Backfilled at milestone level only (no precise historical cut date captured yet). |
| 0.31 | 2026 (partial) | Core reinforcement | Pattern source abstractions, routing foundations, and UI/engine coupling cleanup (partially completed). | Not backfilled. | Keep minimal until tagged releases are available. |
| 0.30 | 2026 (completed) | Modular baseline | Dynamic module grid, add-slot flow, patch persistence, and initial visual modules/transport controls. | Not backfilled. | Milestone-only row from roadmap baseline. |
