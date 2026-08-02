# AUTH_PERFORMANCE_REPORT

**Phase:** Performance Phase 2 — Authentication Pipeline  
**Generated:** 2026-07-31  
**Scope:** Authentication only (no Story / recommendations / UI changes)

---

## Summary

Authentication no longer pays a Supabase Auth **`GET /auth/v1/user`** round-trip on every middleware hit. Middleware resolves identity with **`getClaims()`** (local JWT / JWKS), and i18n locale loading reuses **`getCurrentUser()`** instead of a second `getUser()`.

Warm middleware latency dropped from **~500–700 ms → ~20–50 ms**. Auth network component dropped from **~500–700 ms → 0 ms** (after JWKS warm). Route handlers still report **`duplicateAuth=no`** and **`source=middleware-headers`**.

---

## Profile — stages (before)

| Stage | Typical warm cost | Notes |
| --- | --- | --- |
| `createServerClient()` | 4–20 ms | Local |
| Cookie / session local | 10–60 ms | Local |
| `supabase.auth.getUser()` → `/auth/v1/user` | **460–1200 ms** | Dominant |
| Token refresh | 0 ms | Not near expiry |
| Trusted headers → RSC `getAuthUser` | 0 ms | Sprint 2 already |
| Prisma `User.findUnique` | separate DB RTT | Not Auth HTTP |

Evidence: `artifacts/bench-before.json` (port 3040, `AUTH_PROFILE=1`).

### Duplicate work found

1. **Middleware** called `getUser()` (network) every request.  
2. **`getSessionPreferredLanguage`** (`lib/i18n/session-locale.ts`) called **`supabase.auth.getUser()` again** + a separate `User.findUnique` during `next-intl` `getRequestConfig` — **outside** React `cache()` on `getAuthUser` / `getCurrentUser`.  
3. Layout/page `requireUser` was already deduped (Sprint 2).

---

## Changes made

| File | Change |
| --- | --- |
| `lib/supabase/middleware.ts` | Prefer `auth.getClaims()`; fallback `getUser()`; preserve session cookies when rebuilding response with trusted headers |
| `lib/middleware-auth-timing.ts` | Attribute JWKS + `/user` as auth network; emit `x-auth-resolve-method` |
| `lib/i18n/session-locale.ts` | Use cached `getCurrentUser()` for preferred language (no second Auth `getUser`) |

**Behaviour preserved**

- Unauthenticated protected routes still redirect to `/login`.  
- Authenticated `/login` still redirects to `/home` (verified).  
- Ban/suspend still enforced via Prisma `User` in `requireUser`.  
- Trusted headers still strip client-supplied `x-auth-*` before validation.  
- If `getClaims()` fails, middleware falls back to `getUser()`.

**Intentional Auth-server difference (documented)**  
`getClaims()` verifies the JWT cryptographically (JWKS) and does **not** call Auth for a fresh user row on every request. Immediate Auth-server revocation without JWT expiry is no longer observed in middleware; app ban/suspend flags remain DB-enforced.

---

## Benchmark — before vs after

Base: `http://127.0.0.1:3040`, user `user1@friendintro.com`.  
Compare **warm** samples (exclude first-compile cold).

### Warm middleware / Auth network / TTFB

| Page | Metric | Before (warm) | After (warm median, n=3) | Δ |
| --- | --- | --- | --- | --- |
| `/home` | middleware | 568 ms | **44 ms** | **−524 ms** |
| `/home` | auth network | 546 ms | **0 ms** | **−546 ms** |
| `/home` | TTFB | 6879 ms | **1631 ms** | **−5248 ms** |
| `/messages` | middleware | 700 ms | **23 ms** | **−677 ms** |
| `/messages` | auth network | 675 ms | **0 ms** | **−675 ms** |
| `/messages` | TTFB | 3491 ms | **842 ms** | **−2649 ms** |
| `/discoveries` | middleware | 488 ms | **53 ms** | **−435 ms** |
| `/discoveries` | auth network | 460 ms | **0 ms** | **−460 ms** |
| `/profile` | middleware | 1221 ms | **29 ms** | **−1192 ms** |
| `/profile` | auth network | 1199 ms | **0 ms** | **−1199 ms** |

After resolve method on all measured requests: **`getClaims`**.

Artifacts: `bench-before.json`, `bench-after.json`, `bench-after-warm.json`.

---

## Once-per-request verification

| Check | Result |
| --- | --- |
| Middleware Auth resolve | **1×** (`getClaims`, fallback `getUser`) |
| Route `getAuthUser` Supabase | **0×** (`source=middleware-headers`) |
| `duplicateAuth` | **no** |
| `getUserCalls` (profiled) | **1** (middleware path only) |
| i18n preferred language | Shares `getCurrentUser()` cache with layout |

---

## Page authentication verification

| Page | Auth middleware | Page status | Notes |
| --- | --- | --- | --- |
| `/home` | OK (`getClaims`) | **200** | Authenticated |
| `/messages` | OK | **200** | Authenticated |
| `/discoveries` | OK | **500** | Pooler `Can't reach database` during page queries — **not auth** |
| `/profile` | OK | **500** | Same pooler failures in analytics/insights — **not auth** |
| `/login` (authed) | OK | **307 → /home** | Redirect behaviour unchanged |

Auth success criterion met: every target route **authenticates correctly** in middleware; RSC uses trusted headers. Discoveries/profile 500s are **Supabase pooler connectivity under load**, outside this phase.

---

## Success criteria

| Criterion | Status |
| --- | --- |
| Authentication executes once per request | **Pass** |
| No duplicated Auth `getUser` (middleware + i18n) | **Pass** |
| Lower TTFB (warm `/home`, `/messages`) | **Pass** |
| Identical gate/redirect behaviour | **Pass** |
| No Story / recommendations / UI changes | **Pass** |

---

## Remaining (out of scope)

- Pooler RTT / intermittent DB unreachable → page 500s on heavy routes  
- Prisma `User.findUnique` still ~1× DB RTT after auth  
- First request may still pay JWKS fetch (~hundreds ms) before cache warm
