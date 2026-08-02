# RC1 Bug Register — BuddyIntro

**Date:** 2026-08-02  
**Source:** Production browser QA on https://buddyintro.com (public + authenticated)  
**Update:** Critical/High blocker fixes applied in code (not deployed) — see `CRITICAL_FIXES.md` / `FIX_LOG.md`  
**QA account:** `user1@friendintro.com` (repo seed / prior RC docs)

| ID | Severity | Area | Summary | Evidence | Status |
|----|----------|------|---------|----------|--------|
| RC1-001 | **Critical** | Auth | Password reset workflow missing | Was: no UI/routes; `/forgot-password` → login redirect | **Resolved in code** — forgot/reset pages + login link + public paths. Pending deploy + email smoke |
| RC1-002 | **High** | Auth UX | Invalid login shows no durable error | Was: toast-only / no lasting DOM error | **Resolved in code** — inline `role="alert"` on login. Pending deploy verify |
| RC1-003 | **High** | Auth UX | Failed/blocked signup shows no durable error | Was: toast-only; Supabase empty-identities on duplicate email | **Resolved in code** — inline alert + identities guard. Pending deploy verify |
| RC1-004 | **High** | Ops | Production health **degraded** — Redis | Prod verbose: `redisConfigured: false` with healthy queue/worker fallbacks | **Resolved in code (false positive)** — optional Redis no longer degrades overall status. **Infra still open:** set `REDIS_URL` on VPS if BullMQ Redis desired |
| RC1-005 | **Medium** | Landing UX | Duplicate hero messaging / CTAs | Two stacked value props + repeated “Start Building…” links | Open |
| RC1-006 | **Medium** | QA / Release | Authenticated journeys untested | Was blocked pending credentials | **Closed** — demo seed account used; matrix executed |
| RC1-007 | **Medium** | Observability | Server logs not inspectable from QA seat | PM2 / Next / Prisma logs unavailable from QA workstation | Open |
| RC1-008 | **Low** | Signup copy | Primary button label is marketing CTA, not “Create account” | Signup submit = “Start Building Your Trusted Network” | Open |
| RC1-009 | **Low** | PWA | Install prompt not verified on device | SW active + manifest 200; BIP/iOS install not completed | Open |
| RC1-010 | **Medium** | Mobile UX | Fixed bottom nav intercepts taps on lower profile actions | “Log out” click intercepted by bottom nav until scroll-into-view | Open |
| RC1-011 | **Medium** | Stories UX | No Delete control in story player for own stories | `DELETE /api/stories/{id}` works; player UI has Back/Close only | Open |
| RC1-012 | **Low** | A11y | Discovery like/comment/bookmark buttons lack exposed `aria-label` in live DOM | Queried buttons show `aria: null` despite icons | Open |

## Severity definitions

- **Critical** — Blocks a required RC workflow for real users (e.g. cannot recover account).  
- **High** — Serious UX/ops failure; users stuck or ops unhealthy.  
- **Medium** — Material gap or incomplete proof.  
- **Low** — Polish / incomplete verification.

## Explicitly not filed as bugs (PASS)

- Valid demo login → home  
- Home feed, introductions hub/detail  
- Photo + video media upload API  
- Story create / playback / tag / expiry timestamp / API delete  
- Discoveries like / comment / bookmark  
- Messaging send in existing thread  
- Notifications list API + page shell  
- Profile display-name save  
- Logout → login again (session cycle)  
- PWA manifest + active SW while authenticated  
- Mobile 390×844 authenticated home  
- Slow-network discoveries still usable  
- Offline banner + recovery when online  
- Unauthenticated access correctly redirected to login  
- Legal pages, offline HTML shell  
- Health: database, Supabase, storage, queue, worker healthy  
