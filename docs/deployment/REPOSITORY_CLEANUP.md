# Repository Cleanup — Launch Preparation

**Date:** 2026-07-26  
**Scope:** Pre-launch audit; remove only unreferenced or deprecated artifacts.

---

## Summary

| Action | Count | Notes |
|--------|-------|-------|
| **Removed** | 1 file | Deprecated duplicate |
| **Kept (intentional)** | Scripts, QA harness, deployment pipeline | All referenced by `package.json` or deploy |
| **Documented for archival** | ~80 root-level `docs/*.md` | Superseded by sprint reports; not deleted (may contain historical evidence) |

---

## Removed

| Path | Reason | Verified unreferenced |
|------|--------|----------------------|
| `scripts/rollback.js` | Deprecated wrapper; `package.json` `rollback` script calls `deploy-rollback.js` directly | `grep` — no imports |

---

## Kept — Scripts (production & ops)

All scripts under `scripts/` referenced by `package.json` npm scripts or deployment pipeline (`deploy-v3.js`, `deploy-production.js`, `verify-deployment.js`) were **retained**.

| Category | Examples | Purpose |
|----------|----------|---------|
| Deploy | `deploy-v3.js`, `deploy-production.js`, `sync-standalone.js` | VPS release |
| Workers | `media-worker.ts`, `push-worker.ts`, `job-worker.ts` | PM2 background jobs |
| Backup | `backup-database.ts`, `backup-nightly.js`, `restore.js` | DR |
| Audit | `audit-*.ts`, `verify-*.js` | Pre/post deploy checks |
| QA (RC) | `rc1-api-smoke.ts`, `rc2-validation.ts` | Release gates — keep until post-launch |

---

## Kept — QA & test assets

| Path | Reason |
|------|--------|
| `public/qa/test-upload.png` | Upload verification |
| `public/qa/test-video.webm`, `test-voice.webm` | RC2 story validation |
| `scripts/qa-inject-session.js` | Browser session injection for QA |
| `docs/qa/` | RC1/RC2 reports and screenshots |

---

## Kept — Entry points

| Path | Reason |
|------|--------|
| `index.js` | cPanel Passenger entry (documented in `docs/deployment/PASSENGER.md`) |
| `ecosystem.config.js` | Current PM2 config |
| `ecosystem.production.config.js` | **New** production-hardened PM2 config |

---

## Documented — Not removed (superseded docs)

The repository contains many sprint reports at `docs/*.md` (performance, auth profiling, middleware audits). These are **not deleted** because they provide audit trail. For launch operations, prefer:

| Canonical doc | Supersedes (examples) |
|---------------|----------------------|
| `docs/deployment/DEPLOYMENT_CHECKLIST.md` | `docs/DEPLOYMENT_FLOW.md`, `docs/RELEASE_CHECKLIST.md` |
| `docs/deployment/LAUNCH_READINESS.md` | `docs/LAUNCH_READINESS_FINAL.md`, `docs/BETA_READINESS.md` |
| `docs/qa/RC2_REPORT.md` | Prior QA audit fragments |
| `docs/production/PRODUCTION_HARDENING_REPORT.md` | `docs/PLATFORM_HARDENING_REPORT.md` |
| `docs/performance/PERFORMANCE_RECOVERY.md` | `docs/PERFORMANCE_FIX_REPORT.md` |

**Recommendation (post-launch):** Move historical reports to `docs/archive/` in a dedicated cleanup PR — not done in this sprint to avoid breaking links.

---

## Duplicate configs

| Item | Status |
|------|--------|
| `ecosystem.config.js` vs `ecosystem.production.config.js` | **Intentional** — dev/staging vs production restart policies |
| Security headers in `next.config.js` + `lib/security.ts` | **Intentional** — static assets via Next headers; dynamic via middleware |
| `.env.example` only | **Gap** — production values documented in `ENVIRONMENT_VARIABLES.md` |

---

## Migrations

All 11 migrations (`0001`–`0011`) are **active** and referenced by `scripts/lib/migration-audit.js`. None removed.

---

## Screenshots

| Location | Action |
|----------|--------|
| `docs/qa/screenshots/rc2-*.png` | **Keep** — RC2 evidence |
| `docs/qa/screenshots/page-*.png` | **Keep** — raw browser captures; rename to phase names over time |

---

## Unused imports / dead code

No automated dead-code purge performed (risk of false positives). TypeScript `tsc --noEmit` **passes** — no compile-time orphans in application code.

---

## Suggested follow-up (post-launch)

1. Archive `docs/*.md` sprint reports into `docs/archive/`
2. Add `docs/archive/README.md` index
3. Consolidate `.env.production.example` from `ENVIRONMENT_VARIABLES.md`
