# RC_VALIDATION_REPORT

**Product:** BuddyIntro  
**Candidate:** RC-1 (full E2E)  
**Date:** 2026-07-31  
**Branch HEAD:** `87edda0` (standalone sync)  
**Method:** Production `next start` + Cursor browser (real clicks/forms) + authenticated smoke scripts  
**Accounts:** `user1@friendintro.com`  
**Servers:** `http://127.0.0.1:3060` → `:3063` (rebuilds after fixes)

**Decision:** see [GO_NO_GO_REPORT.md](./GO_NO_GO_REPORT.md) → **GO WITH MAJOR FIXES**

---

## Executive summary

BuddyIntro presents as a polished, trustworthy product. Landing, login, empty states, navigation, PWA manifest/SW, and unauthenticated security gates behave correctly. This RC found and **fixed** two ship-blocking application defects:

1. CSRF rejecting loopback host aliases in production mode  
2. Authenticated layout hard-crashing when the database is unreachable  

Remaining release risk is dominated by **Supabase pooler reliability/latency** from the validation host, which blocked certification of uploads, story creation, messaging sends, and push. Those flows have prior RC evidence when the DB is healthy and must be re-run on the VPS after deploy.

---

## Phase results

| Phase | Result | Evidence |
| --- | --- | --- |
| **1 First impression** | **PASS** | Landing branded, clear CTA, professional dark UI; cookie banner OK |
| **2 Authentication** | **PASS*** | Invalid login → Auth 400; valid login → `/home`; unauth `/home` → 307 login; refresh/session cookies work across nav. *Password reset / multi-tab / browser restart not fully re-run |
| **3 Onboarding** | **PARTIAL** | Invite/signup entry points present; full new-user invite token flow not completed (no fresh invite) |
| **4 Stories** | **BLOCKED** | Create-story page 200 when DB up; media upload 500 under P1001 this session |
| **5 Introductions** | **PARTIAL** | Empty home/intros states OK; accept/decline not exercised (empty graph) |
| **6 Discoveries** | **FIXED→BLOCKED** | Composer + empty state excellent; post hit CSRF (fixed) then DB 500 |
| **7 Messaging** | **PARTIAL** | Inbox page/API 200 empty; send/realtime not exercised |
| **8 Notifications** | **PARTIAL** | API + bell UI OK empty; push not E2E |
| **9 PWA** | **PASS** | Manifest + SW headers + controller active |
| **10 Push** | **NOT COMPLETE** | See NOTIFICATION_REPORT |
| **11 Performance** | **CONDITIONAL** | Bundles good; TTFB DB-bound (see PERFORMANCE_REPORT) |
| **12 Responsiveness** | **PARTIAL** | Desktop mobile-first layout looks correct; tablet/landscape not matrix-tested |
| **13 Stress** | **PARTIAL** | Natural pooler outage acted as stress — recovery UI now graceful |
| **14 Security** | **PASS** | Unauth APIs 401; `/home` 307 login; CSRF present (loopback fixed) |
| **15 UX** | **PASS w/ notes** | See UX_REPORT |
| **16 Bug fix loop** | **DONE** | RC3-001/002/003 fixed + rebuilt + retested |
| **17 Decision** | **GO WITH MAJOR FIXES** | |

---

## Critical findings

### Fixed in this RC

- **RC3-001** CSRF `localhost` ↔ `127.0.0.1`  
- **RC3-002** Service Unavailable instead of Application error  
- **RC3-003** Clearer discovery CSRF error copy  

### Still open

- **RC3-INFRA-001** Pooler `P1001` / degraded health  
- **RC3-004** Empty 500 on mutating APIs during outage  

---

## Security spot checks

| Probe | Result |
| --- | --- |
| `GET /api/feed` no cookie | **401** |
| `GET /api/discoveries` no cookie | **401** |
| `GET /api/messages` no cookie | **401** |
| `GET /home` no cookie | **307** `/login?next=%2Fhome` |
| Mutating without allowed Origin | **403** csrf (by design) |

---

## Success criteria scorecard

| Criterion | Status |
| --- | --- |
| Feel fast | **Conditional** — client OK; SSR waits on DB |
| Feel responsive | **Pass** when DB up |
| Upload media reliably | **Not certified this run** |
| PWA installation | **Manifest/SW ready** |
| Notifications correctly | **In-app OK; push incomplete** |
| Recover from poor networks | **Improved** (Service Unavailable) |
| No critical browser errors | **Pass** after RC3-002 |
| No critical server errors | **Infra P1001 remains** |
| No release-blocking app defects | **App blockers fixed; infra remains** |

---

## Required follow-up before broad launch

1. Deploy RC3 fixes  
2. On production VPS: `node docs/release-candidate/artifacts/rc-mutate-smoke.mjs --base=https://…`  
3. Browser: create image story, discovery post+like, send message, logout/login  
4. One real-device push delivery  

Companion docs: `BUG_LIST.md`, `FIX_LOG.md`, `PERFORMANCE_REPORT.md`, `PWA_REPORT.md`, `NOTIFICATION_REPORT.md`, `UPLOAD_REPORT.md`, `UX_REPORT.md`, `GO_NO_GO_REPORT.md`.
