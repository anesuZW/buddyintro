# FIX_LOG — RC-1 Validation

**Date:** 2026-07-31  
**Environment:** Local production (`next start` :3060–:3063)  
**Tester roles:** CTO / QA / Performance / PWA / Security

---

## Fixes shipped this session

### RC3-001 — CSRF rejects loopback host aliases (HIGH) — FIXED

| Field | Detail |
| --- | --- |
| **Symptom** | Browser POST `/api/discoveries` → **403** `{ code: "csrf_rejected" }` when using `http://127.0.0.1:PORT` under `NODE_ENV=production` |
| **Root cause** | `originsEquivalent()` short-circuited in production and did not treat `localhost` ↔ `127.0.0.1` ↔ `[::1]` as equivalent on the same protocol/port |
| **Impact** | Mutations (discoveries, uploads, analytics) fail silently / with opaque toast for local prod and any mis-matched loopback Host |
| **Fix** | `lib/security.ts` — allow loopback hostname aliasing when protocol + port match (CSRF-safe) |
| **Retest** | Rebuild + middleware reload; Origin alias path no longer returns `csrf_rejected` when DB is up. When pooler is down, responses become **500/P1001** (infra), not 403 |

### RC3-002 — Authenticated shell hard-crashes on DB blip (CRITICAL) — FIXED

| Field | Detail |
| --- | --- |
| **Symptom** | `/home`, `/messages`, etc. show Next.js **“Application error: a server-side exception…”** digest when Prisma cannot reach the pooler |
| **Root cause** | `(main)/layout.tsx` calls `requireUser()` / Prisma; `error.tsx` does **not** catch layout errors. Badge queries also threw uncaught |
| **Impact** | Any pooler timeout → blank crash for logged-in users (churn-level) |
| **Fix** | 1) `getLayoutBadges` try/catch → zeros 2) Main layout catches non-redirect failures → `ServiceUnavailable` UI 3) New `components/layout/ServiceUnavailable.tsx` |
| **Retest** | With DB unreachable, `/home` returns **200** + “BuddyIntro is temporarily unavailable” (confirmed browser + smoke TTFB ~5s HTML) |

### RC3-003 — Opaque discovery CSRF toast (MEDIUM) — FIXED

| Field | Detail |
| --- | --- |
| **Symptom** | Failed post showed raw `Invalid origin` (easy to miss toast) |
| **Fix** | `DiscoveriesComposer` maps `csrf_rejected` to a clear retry message |

---

## Not fixed (documented)

| ID | Sev | Item | Why deferred |
| --- | --- | --- | --- |
| RC3-INFRA-001 | Critical | Supabase pooler `P1001` / multi-second RTT from this workstation | Infrastructure / region; not an app logic change |
| RC3-004 | High | Mutating APIs return empty **500** when DB down (should be **503** JSON) | Partial; shell UX fixed; API envelope polish remains |
| RC3-005 | Medium | Redis reported `degraded` in `/api/health` | Config / Redis not required for core read paths |
| RC3-006 | Low | `/api/version` `builtAt` / commit stale vs current HEAD | Build metadata sync outside this RC loop |
| RC3-007 | Low | Login invalid-credential toast easy to miss | Toast exists; visibility polish only |
| QA-012 | Info | No discovery delete/edit UI | Product gap (prior) |
| RC2-OBS-001 | Info | No typing indicators | Product gap (prior) |
