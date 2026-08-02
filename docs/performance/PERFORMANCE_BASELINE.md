# BuddyIntro Performance Baseline

**Sprint:** Performance Recovery  
**Date:** 2026-07-26  
**Branch:** `performance-recovery-sprint`  
**Environment:** `http://localhost:3000` (Next.js 14.2.15 dev, Supabase pooler)

---

## Methodology

| Tool | Command | Scope |
|------|---------|-------|
| Live page/API audit | `npx tsx scripts/live-performance-audit.ts` | Unauthenticated TTFB |
| Static hotspot audit | `npm run audit:performance` | Code + optional DB stats |
| Health warm probe | `Invoke-WebRequest /api/health` ×3 | Load-balancer path |
| Auth route profiling | `AUTH_PROFILE=1 npm run dev` + `npm run profile:auth` | Authenticated APIs |
| Production benchmark | `PROFILE_PRODUCTION=1 npm run start` + `npm run profile:production` | Production build |

**Note:** First dev compile inflates `/` and `/login`. Warm measurements below exclude cold-compile outliers.

---

## Baseline (before sprint changes)

Measured 2026-07-26 prior to optimizations.

| Route | Status | TTFB / total | Notes |
|-------|--------|--------------|-------|
| `/` | 200 | **28,843ms** | Cold dev compile |
| `/login` | 200 | **22,807ms** | Cold dev compile |
| `/home` | 307 | 126ms | Auth redirect |
| `/discoveries` | 307 | 43ms | Auth redirect |
| `/messages` | 307 | 37ms | Auth redirect |
| `/profile` | 307 | 35ms | Auth redirect |
| **`GET /api/health`** | 200 | **21,795ms** | Full production summary on every request |
| `GET /api/feed` | 401 | 68ms | Unauthenticated |
| `GET /api/discoveries` | 401 | 47ms | Unauthenticated |
| `GET /api/messages` | 401 | 41ms | Unauthenticated |
| `GET /api/notifications` | 401 | 42ms | Unauthenticated |

### Health endpoint breakdown (before)

Default `GET /api/health` invoked `getProductionHealthSummary()` which ran:

- `runHealthChecks()` — 3× `backgroundJob.count`, analytics count, `userConnection.count`, worker status (4 more counts + groupBy)
- Supabase auth health fetch
- `analyticsEvent.groupBy` for active users 24h

**Root cause:** Load-balancer probe treated as full operational audit.

### Database (dev pooler)

- `[prisma:slow]` warnings on most layout/badge queries (500ms–3s)
- `BackgroundJob.count` up to **3,195ms** during health check
- Pooler latency dominates; not application N+1 in health path alone

### Prisma overhead

- Query extension wrapped **every** DB call with `performance.now()` ×2 even in production
- No request-scoped dedupe on `getDiscoveriesNetworkAuthorIds`, `canViewDiscoveryPost`, `listBlockedUserIds`

---

## Post-optimization (same session, warm)

| Route | Before | After | Δ |
|-------|--------|-------|---|
| `GET /api/health` (cold) | 21,795ms | 526ms | **−97.6%** |
| `GET /api/health` (warm avg) | — | **384ms** | Stable warm |
| `GET /api/feed` 401 | 68ms | 28ms | **−59%** |
| `GET /api/discoveries` 401 | 47ms | 21ms | **−55%** |
| `/` (warm) | 28,843ms | 1,582ms | Compile still dominates |
| `/login` (warm) | 22,807ms | 1,390ms | Compile still dominates |

---

## Targets (production VPS)

| Metric | Target | Current dev status |
|--------|--------|-------------------|
| LB health probe | < 100ms | 384ms warm (pooler-limited) |
| Auth API p50 | < 200ms | 17–28ms (401 path) |
| Home feed SSR | < 800ms | Not measured authenticated this sprint |
| DB latency | < 50ms | Pooler often 300–800ms |
| Memory / instance | < 512MB RSS | Not measured |

---

## Endpoints reference (after sprint)

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | **Lite probe** — `SELECT 1` + memory/uptime |
| `GET /api/health?verbose=1` | Full subsystem checks (`runHealthChecks`) |
| `GET /api/health?deep=1` | Production summary + active users + deployment info |
| `GET /api/metrics` | Prometheus scrape |

---

## Recording template

```markdown
### YYYY-MM-DD
- Health lite p50: ___ms
- Health verbose p50: ___ms
- Home SSR p50: ___ms
- Discoveries SSR p50: ___ms
- DB pooler latency: ___ms
```
