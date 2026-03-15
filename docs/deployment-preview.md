# Preview Deployment (Demo/Test Only)

This project should be deployed for demos as a **full-stack Next.js app**, not as a static site.

## Why GitHub Pages is not the primary target

GitHub Pages only serves static content. For this app, that would break or heavily compromise:

- authentication/session handling
- server-side rendering and protected routes
- Prisma database access
- report generation and PDF workflows
- attachment endpoints and secure file handling

For demo/testing, use a host that runs Next.js server code and supports runtime environment variables.

## Chosen approach

Use **Vercel Preview Deployments + managed PostgreSQL (Neon/Supabase/Railway Postgres)**.

Why this is practical for private preview testing:

- native support for full-stack Next.js runtime
- per-branch preview URL suitable for mobile testing
- easy environment variable management
- works well with Prisma and PostgreSQL
- simple migration path later to VPS/self-hosting (Docker + Node runtime + Postgres)

## Required platform setup

1. Connect repository to Vercel.
2. Configure Preview and Production environments (for this phase we only use Preview).
3. Create a managed PostgreSQL database dedicated to demo/testing only.
4. Add environment variables in Vercel Preview environment.

## Environment variables (preview)

Define these in Vercel Preview (names may vary to your app conventions):

- `NODE_ENV=production`
- `DATABASE_URL` (pooled connection for Prisma)
- `DIRECT_URL` (direct DB connection for migrations, if used)
- `NEXTAUTH_URL` (set to the preview URL or custom demo domain)
- `NEXTAUTH_SECRET` (strong random value)
- `APP_ENV=demo`
- `DEMO_MODE=true`
- `PDF_STORAGE=ephemeral` (or platform blob bucket for demo-only files)
- `UPLOAD_STORAGE=ephemeral`
- `MAX_UPLOAD_MB=5`

If your app requires extra provider/API keys, use dedicated demo keys only.

## Build and database commands

Recommended build command in Vercel:

```bash
npm ci && npm run build
```

Recommended post-deploy/manual DB commands (run from CI job or local terminal):

```bash
npx prisma migrate deploy
npx prisma db seed
```

If your project already uses a custom seed command, keep that command as the source of truth.

## Deployment flow (operator checklist)

1. Push branch to GitHub.
2. Vercel creates preview URL.
3. Run migrations against demo DB.
4. Seed demo data.
5. Verify login with demo credentials from `docs/demo-environment.md`.
6. Share URL with stakeholder for mobile testing.

## Notes for later VPS/self-hosting

This preview setup stays portable:

- Next.js app can run in Node server mode on VPS.
- PostgreSQL remains external or self-hosted.
- same Prisma migration/seed flow applies.
- env vars map 1:1 to `.env` files on VPS.

