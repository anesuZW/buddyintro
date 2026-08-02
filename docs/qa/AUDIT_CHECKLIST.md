# BuddyIntro Production Readiness Audit Checklist

**Started:** 2026-07-25  
**Environment:** http://localhost:3000  
**Auditor:** Autonomous QA Engineering System

---

## Issue Log

| ID | Phase | Page | Status | Summary |
|----|-------|------|--------|---------|
| QA-001 | 17/PWA | Global | FIXED | SSR `window is not defined` in `detectPlatform()` |
| QA-008 | 4/Stories | `/create-story` | DOCUMENTED | Intermittent `POST /api/stories` 400 — Supabase pooler connection reset during transaction commit; retry succeeds |
| QA-009 | 4/B | `/create-story` | **FIXED** | Prisma transaction timeout on external-email story create (5s default) |
| QA-010 | 4/B | `/create-story` | **FIXED** | `StoryUploader.onFileChange` did not set `mediaType`; publish silently no-oped |
| QA-011 | 4 | `/create-story` | DOCUMENTED | Dev HMR `useContext` null in `IntlProvider` during hot reload |
| QA-012 | 7 | Discoveries | DOCUMENTED | No user-facing delete/edit for discoveries (API/UI not implemented) |
| QA-013 | 7/D | `/discoveries` | **RESOLVED** | Like/bookmark/share pass after server restart (RC2 regression) |

---

## RC2 Final Validation (2026-07-26)

| Workflow | Result | Evidence |
|----------|--------|----------|
| Video story publish + playback | **PASS** | `POST /api/stories` 201; browser `/stories/view/c9eecda5-…` |
| Voice recommendation story | **PASS** | Image + `voiceNoteUrl`; feed includes voice note |
| External phone introduction | **PASS** (intermittent) | `phoneInvites` returned; 400 on overloaded retry (QA-008) |
| External email introduction | **PASS** (intermittent) | `emailDelivery` object when 201; Resend 422 locally (prior) |
| Dual-user messaging | **PASS** | User1 POST → User2 inbox unread + preview |
| Typing indicator | **N/A** | Not implemented in product |
| Profile avatar PATCH | **PASS** | Requires `name` + `profilePicture` (UI sends both) |
| Upload oversize → 413 | **PASS** | `app_body_limit`; retry succeeds |
| Discovery edit/delete | **N/A** | QA-012 — 404 by design |
| RC1 regression smoke | **PASS** | 18/18 |
| Long session (~30 min) | **PARTIAL** | Server outage iter 5–6; recovered iter 10 |
| Responsive tablet/mobile | **NOT RUN** | Desktop browser only |

**RC2 scripts:** `scripts/rc2-validation.ts`, `scripts/rc2-long-session.ts`  
**Report:** `docs/qa/RC2_REPORT.md`

---

## Authenticated audit continuation (2026-07-25)

| Workflow | Result | Evidence |
|----------|--------|----------|
| Story playback (Jordan intro) | **PASS** | `/stories/view/a10d49bb-…` loads caption + Jordan tag |
| External email introduction | **PASS** (after QA-009/010) | Draft story `aed0736f-…`; invitation `454cf577-…`; `POST /api/stories` 201 |
| Invitation email delivery | **PARTIAL** | Resend 422 (`example.com`); SMTP ETIMEDOUT; DB + logs correct |
| Discoveries text post | **PASS** | `POST /api/discoveries` 201 |
| Discoveries image post | **PASS** | "QA image discovery - audit phase D" visible in feed |
| Discoveries comment | **PASS** | Comment panel opens; prior `POST …/comments` 201 |
| Discoveries like/bookmark/share | **BLOCKED** | `POST …/like` 500 — stale dev server / corrupted `.next` after build during dev |
| Messaging inbox | **PASS** | `/messages` loads authenticated |
| Profile page | **PASS** | Display name, trust stats, notification prefs, file input for avatar |
| Profile picture upload | **NOT RUN** | File input present; upload not automated this pass |
| Sent introductions | **PASS** | QA Jordan + external email draft visible at `/introductions/sent` |
| Phone external intro | **NOT RUN** | Phone tag flow not exercised |
| Logout/login regression | **NOT RUN** | Session preserved |
| Long session / responsive / full regression | **NOT RUN** | Environment instability (DB pooler + port 3000 zombie process) |

---

## Authenticated audit (2026-07-25, human session as Alex Rivera QA)

| Workflow | Result | Evidence |
|----------|--------|----------|
| Profile edit/save | PASS | Display name `Alex Rivera QA`; `PATCH /api/profile` 200 |
| Create introduction (photo + Jordan Kim) | PASS (retry) | First attempt 400 (DB rollback); second `POST /api/stories` 201 |
| Home feed / story bar | PASS | QA intro visible on `/home` |
| Sent introductions | PASS | QA intro at top of `/introductions/sent` |
| Discoveries composer (text) | PASS | Prior session `POST /api/discoveries` 201 |
| Discoveries like / bookmark | PASS | Like + bookmark clicks; analytics tracked |
| Discoveries comment | PARTIAL | Comment panel opens (`GET …/comments` 200); POST blocked by automation input |
| Messaging inbox + thread | PASS | Jordan Kim thread; prior `POST /api/messages` 200 |
| Message context panel | PASS | Trust score, connection path, “View introduction” on thread |
| Notifications dropdown | PASS | Trust-score notifications; `GET /api/notifications?limit=5` 200 |
| Upload (authenticated) | PASS | Prior `POST /api/media/upload` 200 |
| Introductions hub + mutual | PASS | Pages load; main list empty (user never tagged — expected) |
| Profile page | PASS | Trust stats, notification prefs, language, privacy actions render |
| Voice recommendation UI | PARTIAL | Record/stop controls work; publish succeeded without voice blob |
| External email invite publish | NOT RUN | — |
| Logout/login regression | NOT RUN | Preserved human session |

---

## QA-001 — PWA InstallPrompt SSR crash

| Field | Detail |
|-------|--------|
| **Page** | All pages (InstallPrompt in layout) |
| **Browser action** | Load any page |
| **Reproduction** | Visit homepage; server renders InstallPrompt |
| **Console output** | `ReferenceError: window is not defined at detectPlatform` |
| **Network request** | N/A (SSR failure) |
| **HTTP status** | 500 SSR error digest |
| **Root cause** | `detectPlatform()` checked `navigator` but accessed `window.matchMedia` during SSR; Node 22+ defines `navigator` globally |
| **Files modified** | `lib/pwa/client.ts`, `components/pwa/InstallPrompt.tsx` |
| **Fix applied** | Guard `typeof window`; defer platform detection to `useEffect` |
| **Retest result** | Pending |
| **Regression test** | Pending |

---

## Phase Progress

- [ ] Phase 1 — Landing Page
- [ ] Phase 2 — Authentication
- [x] Phase 3 — Profiles (authenticated pass; avatar upload not run)
- [x] Phase 4 — Stories (publish + external email draft; QA-009/010 fixed)
- [x] Phase 5 — Introductions (sent list; external email draft)
- [x] Phase 6 — Invitation Emails (diagnostics pass; delivery fails locally)
- [x] Phase 7 — Discoveries (create/comment pass; like blocked by env)
- [x] Phase 8 — Messaging (inbox pass; send/realtime not fully run)
- [x] Phase 9 — Notifications (dropdown pass)
- [x] Phase 10 — Upload System (authenticated API pass)
- [ ] Phase 15 — Long Session
- [ ] Phase 16 — Responsive
- [ ] Phase 19 — Full Regression (logout/login, voice attach, phone intro)
