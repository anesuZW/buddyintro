# RC1 Bug Register — BuddyIntro

**Date:** 2026-08-02  
**Source:** Production browser QA + code fixes on `main`  
**QA account:** `user1@friendintro.com`  
**See also:** `CRITICAL_FIXES.md`, `FIX_LOG.md`, `REGRESSION_REPORT.md`, `FINAL_RELEASE_REPORT.md`

| ID | Severity | Area | Summary | Status |
|----|----------|------|---------|--------|
| RC1-001 | Critical | Auth | Password reset missing | **Fixed** (commit `22d95fb`) — deploy required |
| RC1-002 | High | Auth UX | Invalid login no durable error | **Fixed** (`22d95fb`) — deploy required |
| RC1-003 | High | Auth UX | Signup no durable error / silent duplicate | **Fixed** (`22d95fb`) — deploy required |
| RC1-004 | High | Ops | Health degraded for optional Redis | **Fixed** (`22d95fb`) — deploy required; `REDIS_URL` still optional ops |
| RC1-005 | Medium | Landing | Duplicate hero messaging / CTAs | **Fixed** (`e232775`) — deploy required |
| RC1-006 | Medium | QA | Authenticated journeys untested | **Closed** — matrix executed |
| RC1-007 | Medium | Observability | Server logs not inspectable from QA seat | **Accepted / ops** — not an app defect; needs SSH/PM2 access |
| RC1-008 | Low | Signup | Submit label is marketing CTA | **Fixed** (`4b70830`) — deploy required |
| RC1-009 | Low | PWA | Install prompt not verified on device | **Accepted / device** — SW+manifest OK; BIP needs real device |
| RC1-010 | Medium | Mobile UX | Bottom nav intercepts Log out | **Fixed** (`925d4df`) — deploy required |
| RC1-011 | Medium | Stories | No Delete control in player | **Fixed** (`397f047`) — deploy required |
| RC1-012 | Low | A11y | Discovery action aria-labels missing in prod DOM | **Closed — already in source** (`e65c783`); prod predates labels |

## Remaining after deploy (accepted for private beta)

| ID | Severity | Why accepted | Effort if revisited |
|----|----------|--------------|---------------------|
| RC1-007 | Medium | Ops access, not product code | 0 eng / provide QA SSH or log export |
| RC1-009 | Low | Needs physical device BIP smoke | 0.5 day device QA |
| Optional Redis | Ops | App healthy with fallbacks | 1–2h ops to set `REDIS_URL` |

## Severity definitions

- **Critical** — Blocks a required RC workflow for real users.  
- **High** — Serious UX/ops failure.  
- **Medium** — Material gap or incomplete proof.  
- **Low** — Polish / incomplete verification.  
