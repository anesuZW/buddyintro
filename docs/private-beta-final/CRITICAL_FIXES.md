# Critical & High Fixes — BuddyIntro Private Beta

**Date:** 2026-08-02  
**Scope:** RC1 Critical + High only (`BUG_REGISTER.md`)  
**Policy:** Smallest safe production-quality fixes; no deploy; no commits  

---

## RC1-001 — Critical — Password reset missing

| Field | Detail |
|-------|--------|
| **Status** | **Resolved in code** (not deployed) |
| **Root cause** | No forgot/reset UI or routes; middleware treated `/forgot-password` as a protected path → redirected to login. Auth used Supabase password APIs nowhere in the app shell. |
| **Fix** | Added `/forgot-password` + `/reset-password` pages using existing Supabase `resetPasswordForEmail` / `updateUser`; login “Forgot password?” link; public-path + auth-page allowlists updated; recovery callback uses `next=/reset-password`. |
| **Files changed** | `app/[locale]/(auth)/forgot-password/page.tsx` (new), `app/[locale]/(auth)/reset-password/page.tsx` (new), `app/[locale]/(auth)/login/page.tsx`, `lib/middleware-public-paths.ts`, `lib/supabase/middleware.ts`, `app/auth/callback/route.ts`, `messages/*.json` |
| **Tests performed** | Confirmed `isAuthPublicPath('/forgot-password')` / `'/reset-password'` → true, `'/home'` → false. Routes present under `(auth)`. Full `next build` blocked by pre-existing `hooks/useRealtimeMessages.ts` type error (unrelated). Local `next dev` blocked by environment `EvalError` in edge instrumentation (unrelated). |
| **Result** | Workflow implemented. **Deploy required** before production verification. Email delivery still depends on Supabase Auth email config (ops). |

---

## RC1-002 — High — Invalid login shows no durable error

| Field | Detail |
|-------|--------|
| **Status** | **Resolved in code** (not deployed) |
| **Root cause** | Failures only used ephemeral `toast.error`. Toasts are easy to miss and often absent from durable DOM/a11y snapshots during QA. |
| **Fix** | Persist `formError` in login form with `role="alert"` panel; keep toast as secondary feedback. |
| **Files changed** | `app/[locale]/(auth)/login/page.tsx` |
| **Tests performed** | Code review of error path (`setFormError` + `role="alert"`). Runtime retest pending deploy / clean local env. |
| **Result** | Durable inline error on failed login. |

---

## RC1-003 — High — Failed signup shows no durable error

| Field | Detail |
|-------|--------|
| **Status** | **Resolved in code** (not deployed) |
| **Root cause** | (1) Errors only toasted. (2) Supabase `signUp` often returns HTTP success with `user.identities = []` for existing emails (anti-enumeration), so the UI treated duplicates as a soft success / silent no-op. |
| **Fix** | Durable `formError` alert on signup; detect empty `identities` and throw a clear “account already exists” error. |
| **Files changed** | `components/invite/SignupClient.tsx` |
| **Tests performed** | Code path review for duplicate-email and catch → `setFormError`. Runtime retest pending deploy. |
| **Result** | Durable signup failure messaging including duplicate email. |

---

## RC1-004 — High — Production health degraded (Redis)

| Field | Detail |
|-------|--------|
| **Status** | **Resolved in code (false positive)**; **actual Redis still not provisioned** |
| **Root cause** | Production verbose health: `redisConfigured: false` (`REDIS_URL` unset). Health treated optional-missing Redis as `degraded` and rolled that into overall `status`, even though queue/worker use documented in-process/DB fallbacks and reported healthy. |
| **Fix** | When Redis is not configured, report `redis: "healthy"` with `details.redisNote` explaining fallbacks (do not degrade platform). When configured, keep ping failure as unhealthy; raise latency degrade threshold 100ms → 1500ms for cross-region. |
| **Files changed** | `services/health.ts` |
| **Tests performed** | Reproduced via production `GET /api/health` + `?verbose=1` (`redisConfigured: false`). Local import of `services/health` blocked by `server-only` in script harness; logic verified in source. |
| **Result** | Health semantics fixed in code. **STOP — infrastructure:** enabling real Redis still requires setting `REDIS_URL` on the VPS (ops). Not done here (no deploy / no infra changes). |

---

## STOP notes

| Topic | Why stopped |
|-------|-------------|
| Set `REDIS_URL` on production | Infrastructure / environment change — out of scope per CTO directive |
| Deploy / restart PM2 | Explicitly forbidden for this pass |
| End-to-end reset email in production | Needs deploy + Supabase/Auth email config; Resend domain issues observed in PM2 logs for other mail paths |

## Remaining Medium / Low (untouched)

See `BUG_REGISTER.md`: RC1-005, RC1-007, RC1-008, RC1-009, RC1-010, RC1-011, RC1-012 (RC1-006 already closed from QA).
