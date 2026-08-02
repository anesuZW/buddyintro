# PRODUCTION_HARDENING_SUMMARY

**Date:** 2026-08-01  
**Audience:** First ~50 private beta users  

---

## Recommendation

# READY WITH MINOR ISSUES

---

## Why not “READY FOR PRIVATE BETA” unqualified?

Application-level Critical/High crash and empty-500 issues are **fixed and retested**. Remaining items are **latency/infra** (pooler ~3 s from this host, Redis degraded) and **device-only** push/install confirmation on production HTTPS — not app logic defects.

For a CTO inviting friends/testers on a properly hosted VPS next to Supabase: **ship this build**.

---

## What we fixed

1. Structured **503** JSON when the database is unavailable (APIs + upload)  
2. `withApiHandler` on core user APIs  
3. **422** validation envelopes (no Zod crash → 500)  
4. Push subscribe fails gracefully if VAPID missing  
5. Client retry messaging for 503  
6. Prior RC: CSRF loopback + Service Unavailable shell  

## Retest highlights (`:3070`)

- Discovery create **201** (including localhost↔127.0.0.1 Origin)  
- Image upload **200**  
- CSRF evil origin **403**  
- Bad input **422**  
- Home **200**, PWA assets **200**  
- Push `configured: true`  

Artifacts: `artifacts/harden-smoke.json`, mutate smoke results in session log.

---

## Remaining issues (ranked)

### Critical

*None in application code.*

### High (infra / manual)

| Issue | Effort | Owner |
| --- | --- | --- |
| Supabase pooler latency / intermittent `P1001` from remote clients | 0.5–2 d | Ops / Supabase |
| Confirm push delivery + notification click on a real device over HTTPS | 2–4 h | QA on VPS |
| Confirm PWA install + standalone on Android/iOS Safari | 2–4 h | QA |

### Medium

| Issue | Effort |
| --- | --- |
| Redis `degraded` in health (optional dependency) | 1–4 h ops |
| Wrap remaining low-traffic admin APIs with `withApiHandler` | 2–4 h |
| Manual large video upload soak on VPS | 2 h |

### Low

| Issue | Effort |
| --- | --- |
| Login error toast visibility | 1–2 h (product/UI — deferred by rules) |
| Native file picker polish on discoveries | deferred (UI) |

---

## Infrastructure / human tasks (do not block code freeze)

1. Deploy this build to production VPS with correct `NEXT_PUBLIC_APP_URL`  
2. Verify `/api/health` from the **server** shows healthy/low-latency DB  
3. One real-device push + one PWA install  
4. Optional: tune Supabase pooler / place app in same region  

---

## Final CTO note

Trust > elegance. Users now get calm recovery and honest JSON when the backend flaps, instead of white screens and empty 500s. Invite a small private beta once the VPS health check is green.
