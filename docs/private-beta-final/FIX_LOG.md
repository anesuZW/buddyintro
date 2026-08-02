# Fix Log — Private Beta Blocker Fixes

**Date:** 2026-08-02  
**Operator:** CTO directive — Critical/High only  
**Commits / push / deploy:** None  

---

## Sequence

### 1. RC1-001 Critical — Password reset

1. **Reproduce:** Production `/forgot-password` redirected to `login?next=/forgot-password`; login had no reset link; no app routes for reset.  
2. **Root cause:** Feature never implemented in app shell; path not public in middleware allowlist.  
3. **Fix:** Forgot + reset pages via existing Supabase Auth APIs; login link; middleware public/auth-page updates; i18n keys.  
4. **Build:** `next build` reached typecheck; failed on pre-existing `hooks/useRealtimeMessages.ts` (`Property 'id' does not exist on type 'never'`) — unrelated, not fixed.  
5. **Restart / deploy:** Skipped (forbidden).  
6. **Retest:** Public-path unit check passed for new routes.  
7. **Register:** Marked resolved in code.

### 2. RC1-002 High — Login durable errors

1. **Reproduce:** Prior RC: invalid login left idle UI with no lasting DOM error (toast-only).  
2. **Root cause:** Ephemeral toast only.  
3. **Fix:** Inline `role="alert"` `formError` on login.  
4. **Retest:** Code-path verification.  
5. **Register:** Resolved in code.

### 3. RC1-003 High — Signup durable errors

1. **Reproduce:** Prior RC: signup submit completed with no durable error.  
2. **Root cause:** Toast-only + Supabase duplicate-email empty-identities success.  
3. **Fix:** Inline alert + identities-length guard.  
4. **Retest:** Code-path verification.  
5. **Register:** Resolved in code.

### 4. RC1-004 High — Redis health degraded

1. **Reproduce:** `GET https://buddyintro.com/api/health` → `status/redis: degraded`; verbose → `redisConfigured: false`, note about in-process fallbacks; queue/worker healthy.  
2. **Root cause:** Optional Redis absence incorrectly degraded overall health.  
3. **Fix:** Unconfigured Redis → healthy component + note; latency degrade threshold 1500ms when configured.  
4. **STOP:** Actually provisioning Redis (`REDIS_URL` on VPS) is infrastructure — not applied.  
5. **Register:** Code false-positive resolved; infra Redis still optional/unset on prod until ops sets it.

---

## Files touched (all issues)

| File | Issues |
|------|--------|
| `app/[locale]/(auth)/forgot-password/page.tsx` | RC1-001 |
| `app/[locale]/(auth)/reset-password/page.tsx` | RC1-001 |
| `app/[locale]/(auth)/login/page.tsx` | RC1-001, RC1-002 |
| `app/auth/callback/route.ts` | RC1-001 |
| `lib/middleware-public-paths.ts` | RC1-001 |
| `lib/supabase/middleware.ts` | RC1-001 |
| `messages/*.json` | RC1-001 |
| `components/invite/SignupClient.tsx` | RC1-003 |
| `services/health.ts` | RC1-004 |
| `docs/private-beta-final/CRITICAL_FIXES.md` | docs |
| `docs/private-beta-final/FIX_LOG.md` | docs |
| `docs/private-beta-final/BUG_REGISTER.md` | docs |

---

## Regression notes

- No Prisma schema changes.  
- No auth architecture change (still Supabase Auth).  
- Recommendation / trust logic untouched.  
- Pre-existing build type error in `useRealtimeMessages.ts` remains (outside Critical/High scope).  
- Local `next dev` hit unrelated edge `EvalError` / CSS parse under non-standard `NODE_ENV`.  

## Next ops steps (outside this pass)

1. Deploy code to production.  
2. Confirm Supabase Auth redirect URLs include `/auth/callback` and site URL.  
3. Smoke: forgot-password → email → reset-password → login.  
4. Smoke: invalid login / duplicate signup show `role="alert"`.  
5. Confirm `/api/health` overall not degraded solely due to missing Redis.  
6. Optionally set `REDIS_URL` when ready for BullMQ at scale.  
