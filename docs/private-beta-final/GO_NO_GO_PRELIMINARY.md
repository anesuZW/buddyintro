# RC1 Preliminary Go / No-Go

**Date:** 2026-08-02  
**QA Lead — TEST ONLY**  
**Site:** https://buddyintro.com  
**Update:** Authenticated matrix completed with repo demo account `user1@friendintro.com`

## Preliminary recommendation

# NOT READY

## Why NOT READY

1. **RC1-001 Critical — Password reset does not exist**  
   First-time / returning users cannot recover accounts. Required workflow in the RC brief.

2. **RC1-002 / RC1-003 High — Auth failures are silent**  
   Invalid login and failed signup leave users with no durable explanation.

3. **RC1-004 High — Redis degraded**  
   Production `/api/health` still reports overall `degraded` with Redis unhealthy (reconfirmed while authenticated).

Authenticated product smoke is **no longer the gap** — see below.

## What improved since the public-only pass

Using the existing seed QA account (`user1@friendintro.com` / documented in seed + QA scripts):

- Login, home, discoveries (like/comment/bookmark), introductions  
- Stories: photo + video upload, create, playback, tagging, expiry field, API delete  
- Messaging send, notifications API, profile edit, logout/re-login  
- PWA assets while signed in, mobile viewport, slow network, offline banner recovery  

**RC1-006 closed** (authenticated journeys now exercised).

Remaining authenticated nits (non-blocking for GO if Critical/High cleared): RC1-010 bottom-nav tap interception; RC1-011 missing story Delete UI; RC1-009 install prompt; RC1-012 a11y labels.

## What already looks acceptable

- Public landing + legal pages  
- Auth gates on private routes  
- Core authenticated product paths on production (demo account)  
- PWA assets (manifest + active SW) + offline banner  
- Mobile authenticated shell  
- DB / Supabase / storage / worker healthy in health check  

## Conditions to reconsider

Upgrade toward **READY WITH MINOR ISSUES** after:

1. Password reset path exists and is tested end-to-end  
2. Auth error toasts verified for login + signup failures  
3. Redis restored to healthy (or accepted with documented impact + owner sign-off)  

Optional before private beta invite:

4. Story Delete affordance in player UI (API already works)  
5. Device install / push smoke  

## Next QA action

No credentials needed from operator for demo seed account. Prefer a dedicated disposable RC account for invitee testing so seed data is not mixed with real users. Re-check RC1-001–004 after fixes; keep decision **NOT READY** until then.

---

**Decision type:** Preliminary (public + authenticated evidence).  
**Code changes:** None made.
