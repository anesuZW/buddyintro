# Dependency Audit

**Date:** 2026-07-26  
**Command:** `npm audit`  
**Policy:** Do **not** upgrade major versions before launch.

---

## Summary

| Metric | Value |
|--------|-------|
| Total vulnerabilities | **36** (1 critical, 25 high, 3 moderate, 7 low) |
| Production runtime deps | **Clean of direct critical issues** |
| Dev-only exposure | `@lhci/cli`, `eslint`, `autocannon` transitive |

---

## Production dependencies (runtime)

| Package | Version | Launch status | Notes |
|---------|---------|---------------|-------|
| `next` | 14.2.15 | **Keep** | Stable; major upgrade deferred |
| `@prisma/client` | 5.22.0 | **Keep** | Matches schema |
| `@supabase/supabase-js` | 2.45.4 | **Keep** | Auth + realtime |
| `bullmq` / `ioredis` | current | **Keep** | Optional workers |
| `resend` | 6.12.3 | **Keep** | Email |
| `sharp` | 0.35.3 | **Keep** | Image processing |
| `pino` | 9.9.0 | **Keep** | Structured logging |

---

## Dev dependencies with audit findings

| Package | Severity | Recommendation |
|---------|----------|----------------|
| `@lhci/cli` | High (transitive) | **Keep** — audit tooling only, not deployed |
| `eslint` / `@eslint/*` | High (minimatch) | **Defer** — ESLint 10 is major; post-launch |
| `autocannon` | High (uuid/hyperid) | **Keep** — load test scripts only |
| `puppeteer-core` | Transitive | Dev audit only |

---

## Unused packages (manual review)

| Package | Used? | Verdict |
|---------|-------|---------|
| `idb` | PWA offline | **Keep** |
| `zustand` | Client state | **Keep** |
| `date-fns` | Date formatting | **Keep** |
| `nanoid` | ID generation | **Keep** |
| `archiver` | Referenced in tests only | **Optional devDep** — some archive tests fail if missing; not runtime |

No production packages identified for removal without code search false positives.

---

## Duplicate packages

| Area | Finding |
|------|---------|
| `@aws-sdk/client-s3` + presigner | **Intentional** — upload + signed URLs |
| `workbox-build` + `workbox-sw` | **Intentional** — SW generation |

---

## Pre-launch actions

| Action | When |
|--------|------|
| `npm audit fix` (non-breaking) | Optional on CI — review diff |
| `npm audit fix --force` | **Do not run** before launch |
| Next.js 15 / React 19 | **Post-launch** roadmap |
| ESLint 10 | **Post-launch** |

---

## Security note

Runtime attack surface is Next.js server + API routes. Dev dependency CVEs do not ship in standalone bundle (`outputFileTracing` excludes devDeps from server trace).

Verify on VPS after build: `.next/standalone/node_modules` should not contain `@lhci/cli`, `eslint`, or `autocannon`.
