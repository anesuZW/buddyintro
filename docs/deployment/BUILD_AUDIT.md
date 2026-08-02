# Production Build Audit

**Date:** 2026-07-26  
**Command:** `npm run build`

---

## Result

| Check | Status | Evidence |
|-------|--------|----------|
| `npm run typecheck` | **PASS** | `tsc --noEmit` exit 0 |
| `npm run build` (this session) | **BLOCKED** | Windows EPERM on Prisma query engine — file locked by running Node/PM2 processes |
| Prior hardening sprint build | **PASS** | `docs/production/PRODUCTION_HARDENING_REPORT.md` — 272s, standalone verify OK |

---

## Build pipeline (unchanged)

```
clean-build → prisma generate → PWA icons → next build → build-sw → sync-standalone → verify-standalone-build
```

See `docs/DEPLOYMENT_PIPELINE.md` for full graph.

---

## Standalone verification

| Step | Script | Purpose |
|------|--------|---------|
| Sync | `scripts/sync-standalone.js` | Copy static, public, manifests into `.next/standalone` |
| Verify | `scripts/verify-standalone-build.js` | Manifest git SHA == `git rev-parse HEAD` |
| Runtime | `npm run start:standalone` | **Use this on VPS**, not bare `next start` |

---

## Known build warnings (non-blocking)

| Warning | Source | Launch impact |
|---------|--------|---------------|
| `lib/metrics.ts` Node APIs in Edge trace | Next.js trace | Metrics not on edge middleware path |
| ESLint hook deps (`NotificationBell.tsx`) | eslint | Pre-existing |
| Webpack cache large strings | Informational | None |

---

## SSR / hydration

| Area | Status |
|------|--------|
| PWA `InstallPrompt` SSR | **Fixed** (QA-001) |
| Story player | Client component — no hydration issues in RC2 |
| IntlProvider | Dev HMR edge case only (QA-011) |

---

## Pre-build requirement (VPS)

1. Stop PM2: `pm2 stop all`
2. Run `npm run build`
3. Verify: `node scripts/verify-standalone-build.js`
4. Start: `pm2 start ecosystem.production.config.js`

On Windows dev machines: stop all `node` processes before build to avoid Prisma EPERM.

---

## Regression

RC2 final regression: RC1 smoke **18/18** with running server (no rebuild required for API validation).
