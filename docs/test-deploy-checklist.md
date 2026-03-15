# Test Deployment Checklist

Use this checklist each time you prepare a stakeholder preview.

## 1) Hosting and environment

- [ ] Preview host supports full-stack Next.js runtime (not static-only).
- [ ] Preview database is separate from any production database.
- [ ] All preview env vars are configured.
- [ ] No production secrets are present in preview.

## 2) Database and seed

- [ ] Prisma migrations applied successfully.
- [ ] Demo seed executed successfully.
- [ ] Seed created role-based demo users.
- [ ] Seed contains fake records for key workflows.

## 3) Authentication and access

- [ ] Demo login credentials validated.
- [ ] Protected routes verified for each demo role.
- [ ] Session lifecycle works (login, refresh, logout).

## 4) Core workflow checks

- [ ] Main dashboard and list pages load.
- [ ] Reporting views load with demo data.
- [ ] PDF generation works in preview runtime.
- [ ] Attachment workflow works with demo-safe storage.

## 5) Mobile sanity check

- [ ] Open preview URL on iPhone/Android browser.
- [ ] Login form is usable without layout breakage.
- [ ] Core navigation and forms are operable by touch.

## 6) Safety checks

- [ ] No real customer names/files in DB or storage.
- [ ] No outbound integration calls to production systems.
- [ ] Demo banner/label visible (if implemented).

## 7) Share-out package for stakeholder

- [ ] Preview URL
- [ ] Demo username(s)
- [ ] Demo password
- [ ] Short note: "Demo data only; environment resets periodically."

## 8) Re-seed / recovery steps documented

- [ ] `migrate deploy` command documented
- [ ] seed command documented
- [ ] reset/refresh flow documented

