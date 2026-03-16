# GitHub Pages deployment repair

## What was failing

The `Deploy to GitHub Pages` workflow was intermittently failing at the build stage (`exit code 1`) after recent merges, which prevented fresh artifacts from being published and left GitHub Pages serving older successful output.

Two signals were reported:

1. Build step failure (`exit code 1`).
2. Node.js 20 deprecation warnings for GitHub Actions.

## Root cause classification

This was primarily a **build/dependency installation reliability issue**, with **workflow compatibility concerns already addressed** in the current workflow file.

- The workflow was already using Node 24-compatible major versions for key actions:
  - `actions/checkout@v5`
  - `actions/setup-node@v6`
- The workflow install step used plain `npm ci`, which is sensitive to environment defaults (notably `NODE_ENV=production`), and can omit dev dependencies required for build tooling (`vite`, `typescript`).
- If dev dependencies are omitted, `npm run build:gh` can fail with exit code 1 (tooling unavailable), causing the Pages pipeline to stop before artifact upload/deploy.

## Workflow changes made

Updated `.github/workflows/pages.yml`:

1. **Install step hardened**
   - From: `npm ci`
   - To: `npm ci --include=dev`

2. **Typecheck separated from bundling for clearer failure reporting**
   - Added: `npm run typecheck`
   - Kept build step: `npm run build:gh`

3. **Node strategy confirmed**
   - Kept `actions/setup-node@v6` with `node-version: 22` (compatible runtime for current toolchain and modern action ecosystem).

## Code/config changes that fixed build reliability

1. `package.json`
   - Simplified `build:gh` script:
     - From: `tsc && vite build --mode gh`
     - To: `vite build --mode gh`
   - Reason: avoid duplicate TypeScript invocation now that typecheck runs as a dedicated CI step.

2. `.github/workflows/pages.yml`
   - Explicitly install dev dependencies in CI and run a dedicated typecheck before build.

## How to verify Pages is now serving current main

1. Push this commit to `main`.
2. Confirm workflow success in Actions:
   - Workflow: `Deploy to GitHub Pages`
   - Required: both `build` and `deploy` jobs green.
3. Confirm deploy job output URL matches repository Pages URL.
4. Open the live site and force-refresh (or private window).
5. Validate the loaded app corresponds to latest `main` bundle:
   - Network tab should show freshly generated hashed assets from the latest run.
   - If still stale, check repository Pages source settings and any CDN/browser cache.

## Notes on what was and was not changed

- No new GUI features were added in this repair task.
- No action major-version bump was required in this patch because the workflow already used modern versions.
