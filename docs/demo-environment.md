# Demo Environment Guide

This guide defines a **safe test/demo environment** for stakeholder previews.

## Safety rules

- Use demo/fake data only.
- Do not load production exports or customer files.
- Do not reuse production secrets.
- Keep demo storage isolated and disposable.

## Demo mode behavior

Use `APP_ENV=demo` and `DEMO_MODE=true` to enforce demo-safe behavior:

- show clear demo badge/banner in UI (recommended)
- disable or isolate integrations that can reach real systems
- store attachments in ephemeral/local preview storage
- watermark generated PDFs as `DEMO` where feasible

## Demo accounts

Seed stable test users with role coverage (example):

- Owner/Admin: `demo.owner@creditool.test`
- Ops/Seller: `demo.seller@creditool.test`
- Viewer/Auditor: `demo.viewer@creditool.test`

Use a shared demo password for previews and rotate regularly:

- Password: `DemoOnly-ChangeMe!`

> If your authentication layer requires invite/activation flows, include these users directly in the seed script with pre-verified status.

## Demo seed dataset requirements

Seed should include realistic but fake entities:

- fake clients, deals, installments, and payment history
- fake attachment metadata and sample placeholder files
- fake reportable records across multiple statuses
- enough records for pagination/filter testing

Use clearly fake names and values, e.g. `Acme Test Trading`, `Northwind Demo Retail`.

## Reset and refresh strategy

For stale demo data or after stakeholder sessions:

1. Reset schema or truncate key tables.
2. Re-run migrations.
3. Re-run demo seed script.
4. Re-verify demo login.

Typical reset command flow:

```bash
npx prisma migrate reset --force
npx prisma db seed
```

If destructive reset is not allowed in your preview environment, provide a `seed:demo:refresh` script that upserts demo fixtures idempotently.

## Attachment and PDF handling in demo

- attachments: demo-only bucket/path with automatic expiry
- generated PDFs: do not persist indefinitely unless needed
- no uploads containing real PII
- add cleanup cron/job if storage accumulates

## Mobile stakeholder testing expectations

Before sharing URL:

- login page works on mobile viewport
- session persists after login
- protected routes are accessible with seeded roles
- reporting and PDF generation run without server errors
- uploads/attachments follow demo-safe rules

