# GitHub Pages deployment repair

## What was failing

The Pages pipeline was failing during the build phase, which blocked new artifacts and left GitHub Pages serving older output.

Quoted failing step (from prior failed run):

- `Run npm run build:gh`
- `Error: Process completed with exit code 1.`

## Root cause

This was a build/dependency-install reliability issue, not an outdated action-major issue.

- The workflow already used modern actions (`actions/checkout@v5`, `actions/setup-node@v6`).
- The failing path was that plain `npm ci` can install without required dev tooling in production-leaning environments, while this project's build depends on devDependencies (`vite`, `typescript`).
- When that happens, `npm run build:gh` fails with exit code 1 and Pages upload/deploy never runs.

## Changes carried forward from PR #31

1. **Workflow install hardening**
   - `npm ci` → `npm ci --include=dev`
2. **Split CI checks**
   - Added explicit `npm run typecheck` step before build.
3. **Build script cleanup**
   - `build:gh` changed from `tsc && vite build --mode gh` to `vite build --mode gh`.
   - Type checking remains enforced by the dedicated workflow step.

## Workflow/runtime status

- `actions/checkout@v5`
- `actions/setup-node@v6`
- `node-version: 22`
- Pages artifact upload/deploy flow remains unchanged:
  - build job uploads `dist`
  - deploy job runs `actions/deploy-pages@v4`

## How to verify Pages serves current main

1. Push this branch and merge.
2. Confirm latest `Deploy to GitHub Pages` run is green for both jobs (`build` and `deploy`).
3. Confirm deploy output URL points to repo Pages URL.
4. Load the live site with cache bypass and verify latest hashed assets are served.
