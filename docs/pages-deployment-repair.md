# GitHub Pages deployment repair

## What was failing

The `Deploy to GitHub Pages` workflow was failing during the build stage (`exit code 1`) after recent merges, which prevented fresh artifacts from being published and left GitHub Pages serving older successful output.

Quoted failing signal from prior runs:

- `Run npm run build:gh`
- `Error: Process completed with exit code 1.`

Two signals were reported during investigation:

1. Build step failure (`exit code 1`)
2. Node.js 20 deprecation warnings for GitHub Actions

## Root cause classification

This was primarily a **build/dependency-install reliability issue**, with **workflow compatibility concerns already addressed** in the current workflow file.

- The workflow already used modern action versions:
  - `actions/checkout@v5`
  - `actions/setup-node@v6`
- The install step used plain `npm ci`, which can be sensitive to environment defaults and may omit dev dependencies required for this project's build tooling (`vite`, `typescript`).
- If dev dependencies are unavailable, `npm run build:gh` fails with exit code 1, which prevents Pages artifact upload and deployment.

## Changes carried forward from PR #31

### 1. Workflow install hardening
- From: `npm ci`
- To: `npm ci --include=dev`

### 2. Split CI checks for clearer failure reporting
- Added explicit `npm run typecheck` step before build

### 3. Build script cleanup
- `build:gh` changed from:
  - `tsc && vite build --mode gh`
- To:
  - `vite build --mode gh`

Type checking remains enforced by the dedicated workflow step.

## Workflow/runtime status

- `actions/checkout@v5`
- `actions/setup-node@v6`
- `node-version: 22`

Pages artifact upload/deploy flow remains unchanged:

- build job uploads `dist`
- deploy job runs `actions/deploy-pages@v4`

## Code/config changes that fixed build reliability

### `package.json`
- Simplified `build:gh` to avoid duplicate TypeScript invocation now that typecheck runs separately in CI

### `.github/workflows/pages.yml`
- Explicitly install dev dependencies in CI
- Run dedicated typecheck before build

## How to verify Pages is now serving current main

1. Merge this change into `main`
2. Confirm the latest `Deploy to GitHub Pages` workflow run is green for both jobs:
   - `build`
   - `deploy`
3. Confirm the deploy output URL matches the repository Pages URL
4. Load the live site with a hard refresh or in a private/incognito window
5. Verify the latest hashed assets are being served

## Notes on what was and was not changed

- No new GUI features were added in this repair task
- No new deployment target was introduced
- No action major-version bump was required in this patch because the workflow already used current major versions
- Final confirmation still depends on a successful GitHub Actions run after merge