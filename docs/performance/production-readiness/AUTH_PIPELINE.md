# AUTH_PIPELINE

**Phase:** Production Readiness — Phase 3  
**Generated:** 2026-07-31  
**Mode:** READ-ONLY (existing `AUTH_PROFILE` / `PROFILE_PRODUCTION` instrumentation)  
**Evidence:** `artifacts/auth-runtime-capture.json`, server logs port 3012, `lib/supabase/middleware.ts`, `lib/auth.ts`, `lib/middleware-auth-timing.ts`

---

## Pipeline stages (code map)

```
HTTP request
  → middleware.ts (intl + CSRF)
  → updateSession (lib/supabase/middleware.ts)
       1. stripTrustedAuthHeaders
       2. createServerClient()          [createClientMs]
       3. cookie get/set adapters       [included in loadSessionMs residual]
       4. supabase.auth.getUser()
            · fetch /auth/v1/user       [getUserNetworkMs]
            · fetch /auth/v1/token*     [refreshNetworkMs]
            · local JWT/session work    [loadSessionMs]
       5. setTrustedAuthHeaders
       6. auth redirects                [responseBuildMs]
  → LocaleLayout (no requireUser)
  → MainLayout.requireUser()
       → getCurrentUser (cache)
            → getAuthUser (cache)
                 · trusted headers OR supabase.getUser fallback
            → prisma.user.findUnique    [Prisma — currently P2022]
            → optional create/update/RBAC sync
  → page loaders…
```

---

## Live measurements (2026-07-31, base `http://127.0.0.1:3012`)

Label: **Runtime Evidence**

| Page | HTTP | Middleware total | createClient | loadSession | getUserNetwork | refresh | TTFB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 200 | 555 | 3 | 15 | **536** | 0 | 7789* |
| `/home` | **500** | 548 | 8 | 10 | **528** | 0 | 4892 |
| `/discoveries` | **500** | 343 | 3 | 6 | **334** | 0 | 3942 |
| `/messages` | **500** | 305 | 0 | — | — | 0 | 2422 |
| `/profile` | **500** | 357 | 1 | 3 | **353** | 0 | 2651 |
| `/login` | 307 | 319 | 2 | 6 | **310** | 0 | 338 |

\* Landing TTFB inflated by first-compile on fresh server.

### Parallel capture on 3010 (also profiled)

| Page | Middleware | getUserNetwork | Notes |
| --- | --- | --- | --- |
| `/home` | 1048 | **1361** | Spike |
| `/discoveries` | 314 | 304 | |
| `/profile` | 409 | 404 | |
| `/login` | 378 | 374 | |

### External Auth cost

| Probe | ms | Label |
| --- | --- | --- |
| `signInWithPassword` | 1120–2012 | Runtime Evidence |
| Health `databaseLatencyMs` | 3051 | Runtime Evidence |
| Auth network share of middleware | **typically >95%** of middleware total | Runtime Evidence |

---

## Route-level auth (server log, `/profile` `b1a27815`)

```
getAuthUser source=middleware-headers supabaseGetUser=0ms
route-summary /profile
  middlewareGetUser=357ms
  routeGetUser=0ms
  prisma=0ms          ← findUnique throws before timing completes as success
  getUserCalls=1
  duplicateAuth=no
```

| Stage | Elapsed | Caller | Prisma | External HTTP |
| --- | --- | --- | --- | --- |
| Middleware createClient | 1–8 ms | `updateSession` | 0 | 0 |
| Cookie/session local | 2–15 ms | `updateSession` | 0 | 0 |
| Auth `GET /auth/v1/user` | **310–1361 ms** | `supabase.auth.getUser` | 0 | **1** |
| Token refresh | **0 ms** (warm session) | — | 0 | 0 |
| Trusted header reuse | **0 ms** | `getAuthUser` | 0 | 0 |
| `User.findUnique` | **fails P2022** | `getCurrentUser` | attempted 1 | 0 |

---

## Findings

1. **Dominant auth cost is Supabase Auth network** (`getUserNetwork`), not `createServerClient` or cookie parsing. **Runtime Evidence.**
2. **Sprint 2 dedupe works:** `duplicateAuth=no`, route `getUser` = 0 via middleware headers. **Runtime Evidence.**
3. **Session Prisma load is currently a hard blocker** due to missing `preferred_language`. Authenticated pages never reach business loaders. **Runtime Evidence.**
4. **Public `/` still pays full middleware getUser** (~500 ms). **Runtime Evidence.**
5. Request context creation (trusted headers) is negligible (&lt;1 ms after getUser). **Runtime Evidence.**

---

## Prisma queries in auth path (intended)

| Query | When | Status live |
| --- | --- | --- |
| `User.findUnique` by id | every `getCurrentUser` | **Error P2022** |
| `User.create` | first login only | not reached |
| `User.update` emailVerified | conditional | not reached |
| RBAC sync reads/writes | admin emails | not reached on failure |

---

## Reproducibility

```powershell
$env:AUTH_PROFILE='1'; $env:PROFILE_PRODUCTION='1'; npm run dev -- -p 3012
npx tsx docs/performance/production-readiness/artifacts/capture-auth-baseline.ts --base=http://127.0.0.1:3012
```

Headers: `x-auth-create-client-ms`, `x-auth-session-ms`, `x-auth-get-user-ms`, `x-auth-refresh-ms`, `x-auth-profile-middleware-ms`.
