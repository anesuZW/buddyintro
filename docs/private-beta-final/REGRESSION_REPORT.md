# Regression Report — Private Beta Stabilization

**Date:** 2026-08-02  
**Environment probed:** https://buddyintro.com (deployed commit `87edda06…`)  
**Code under test for fixes:** local `main` (commits through `397f047`)  
**Note:** Production has **not** received the stabilization commits yet. Live probes confirm pre-deploy baseline still works; fix verification is code-level + prior authenticated matrix.

---

## Continuous checklist (post-fix intent)

| Workflow | Pre-deploy prod (live) | After deploy (expected) |
|----------|------------------------|-------------------------|
| Landing page | PASS (old duplicate CTAs still present) | PASS with RC1-005 |
| Login | PASS (session active) | PASS + durable errors |
| Logout / Login again | PASS (prior auth matrix) | PASS + clearer Log out hit target |
| Session persistence | PASS | PASS |
| Password reset | FAIL (missing on prod) | PASS path present |
| Signup page | PASS render | PASS + Create account label |
| Home feed | PASS | PASS |
| Discoveries | PASS + API 200 (~705ms) | PASS + aria-labels from prior hardening |
| Story create / upload / play / tag | PASS (prior matrix) | PASS + Delete UI for owners |
| Introductions | PASS (prior) | PASS |
| Messaging | PASS API 200 | PASS |
| Notifications | PASS API 200 | PASS |
| Profile edit | PASS (prior) | PASS |
| Avatar upload | PARTIAL (prior — media API OK) | PARTIAL→PASS on device file pick |
| PWA assets | PASS manifest/SW 200, SW activated | PASS; BIP device TBD |
| Offline | PASS (prior offline.html + banner) | PASS |
| Mobile | PASS (prior 390×844) | PASS + Log out clearance |

---

## Live API smoke (authenticated session, 2026-08-02)

| Endpoint | Status | Latency |
|----------|--------|---------|
| `/api/health` | 200 (status degraded — Redis unset on prod) | ~1.5s |
| `/api/stories` | 200 | ~953ms |
| `/api/discoveries` | 200 | ~705ms |
| `/api/messages` | 200 | ~565ms |
| `/api/notifications` | 200 | ~505ms |
| `/login`, `/signup`, `/offline.html`, `/manifest.webmanifest`, `/sw.js` | 200 | — |

No new console-blocking crashes observed during this smoke. Home + Discoveries rendered with session (“AR” / Alex Rivera QA).

---

## Regressions introduced by this pass

**None observed in code review.** Changes are localized (landing strip removal, copy, padding, story delete button, prior auth/health fixes).

---

## Deploy gate

Until `main` (including `22d95fb`…`397f047`) is deployed to buddyintro.com:

- Password reset, durable auth errors, landing cleanup, signup copy, logout clearance, story delete UI, and Redis health semantics **will not** appear in production.
- Invite private beta users only **after** deploy + the smoke items in `PRIVATE_BETA_CHECKLIST.md`.  
