# RC1 Test Report — BuddyIntro (buddyintro.com)

**Role:** QA Lead  
**Date:** 2026-08-02  
**Scope:** TEST ONLY — no code changes  
**Environment:** https://buddyintro.com (build `0.1.3`, commit `87edda06…`, branch `main`)  
**Method:** Public walkthrough (Prompt 1) + authenticated matrix with demo seed account  
**Account used:** `user1@friendintro.com` (seed/QA account from `prisma/seed-demo-users.ts`, `scripts/qa-test-login.js`, prior RC docs) — password verified via Supabase + browser login

## Executive summary

Public auth shell issues from Prompt 1 remain (no password reset; silent auth failures; Redis degraded). **Authenticated product paths largely pass** on production with the demo QA account: home, stories (create/upload/play/tag/delete/expiry field), discoveries (like/comment/bookmark), introductions, messaging, notifications API, profile edit, logout/re-login, PWA assets while signed in, mobile layout, slow-network load, and offline banner recovery.

## Access limitations

| System | Access |
|--------|--------|
| Browser console / Network (CDP) | Partial — Performance entries + instrumented `fetch` |
| Next.js / PM2 / Prisma server logs | **Not available** from this workstation |
| Authenticated user session | **Available** — demo QA account |

---

## Account discovery

| Source | Account | Result |
|--------|---------|--------|
| `scripts/qa-test-login.js`, `prisma/seed-demo-users.ts`, `docs/qa/RC2_REPORT.md` | `user1@friendintro.com` / `123456` | **Valid on production Supabase** — browser login → `/home` |
| Same seed set | `user2`…`user10@friendintro.com` | Not needed after user1 success |
| Simulation seeds | `sim-*@simulation.buddyintro.test` | Skipped (local simulation) |

No credentials requested from the operator.

---

## Workflow results (authenticated)

| Workflow | Result | Evidence |
|----------|--------|----------|
| Login (valid demo) | **PASS** | Sign in → `/home` (~200 ms after submit settle); badges/notifications visible |
| Home feed | **PASS** | Stats + recent intros; story ring for `anesugozo` |
| Stories list API | **PASS** | `GET /api/stories` 200; image story with `expiresAt` + tags |
| Story creation | **PASS** | `POST /api/stories` **201**; story id `6aca7398-…`; tagged `anesugozo` |
| Photo upload | **PASS** | `POST /api/media/upload` kind=`image` → **200** + `/uploads/images/…png` (~1.3s) |
| Video upload | **PASS** | `POST /api/media/upload` kind=`video` → **200** + `/uploads/videos/….webm` |
| Story playback | **PASS** | `/stories/view/{id}` shows player (Back/Close) + tagged user link |
| Story deletion | **PASS** (API) / **PARTIAL** (UI) | `DELETE /api/stories/{id}` → `{ok:true}`; subsequent GET **404**. No Delete control visible in player UI |
| Story expiry | **PASS** (field) | Created story `expiresAt` ≈ +24h (`2026-08-03T12:39:45Z`). Live clock expiry not waited |
| Story tagging | **PASS** | Create with `tags:[{kind:'user', userId: anesugozo}]`; player shows tagged user |
| Create-story UI | **PASS** (shell) | `/create-story` 4-step “New Introduction” wizard loads (search / invite) |
| Discoveries feed | **PASS** | Feed + composer; posts from network visible |
| Likes | **PASS** | UI like → `POST …/like` (~1.5s); count 1→2 |
| Comments | **PASS** | Comment panel + `…/comments`; count 1→2 |
| Bookmarks | **PASS** | `POST …/bookmark` → `{"bookmarked":true}` **200** |
| Introductions | **PASS** | `/introductions` hub + detail `/introductions/{id}` |
| Messaging | **PASS** | Inbox with `anesugozo`; send “RC auth QA ping” → composer cleared; text in thread |
| Notifications | **PASS** | Page filters render; `GET /api/notifications` **200**, 5 items (intro/trust/message types) |
| Profile editing | **PASS** | Display name → “Alex Rivera QA”; `POST/PUT /api/profile` ~2.3s; h1 updated |
| Avatar upload | **PARTIAL** | Profile picture file input present; image upload API proven (same media pipeline). File-picker UX not driven |
| Logout / Login persistence | **PASS** | Log out → `/login`; re-login → `/home` with updated “AR” avatar initials |
| PWA while authenticated | **PASS** (assets) | SW **activated** at `/sw.js`; manifest 200, `start_url:"/home"`; install prompt not completed |
| Mobile responsiveness | **PASS** | 390×844 Emulation; home + bottom nav usable |
| Slow network | **PASS** | ~400ms latency / throttled; discoveries still rendered |
| Offline recovery | **PASS** | Banner: “You're offline — changes will sync when reconnected”; cleared after online |

---

## Workflow results (public — carried forward)

| Workflow | Result |
|----------|--------|
| Landing / legal | **PASS** |
| Login / signup pages | **PASS** (render) |
| Invalid login / failed signup UX | **FAIL** — no durable errors |
| Password reset | **FAIL** — missing |
| Health | **degraded** (Redis) |

---

## Infrastructure probe (`GET /api/health`) — rechecked while authenticated

```json
{
  "status": "degraded",
  "database": "healthy",
  "supabase": "healthy",
  "redis": "degraded",
  "storage": "healthy",
  "queue": "healthy",
  "worker": "healthy",
  "buildVersion": "0.1.3"
}
```

---

## Issues observed during authenticated pass

1. **Bottom nav click interception** — Profile “Log out” click intercepted by fixed bottom nav until scroll-into-view (**Medium** UX).  
2. **Story delete UI missing** — DELETE API works; player exposes no Delete control (**Medium** / product gap).  
3. **Discovery action a11y** — Like/comment/bookmark buttons lack `aria-label` in production DOM (repo source has labels; deploy may differ or labels not exposed) (**Low**).  
4. Redis still **degraded** (**High** ops — unchanged).

---

## Coverage still limited

- Full UI create-story wizard end-to-end (media via wizard file picker)  
- True 24h expiry clock  
- Push notification permission / delivery on device  
- PM2 / Prisma server log correlation  
- Realtime message delivery to second client  
- Onboarding for brand-new signup (demo account already onboarded)

---

## Artifacts

Authenticated browser session on production; demo account from repo seed docs. Temp session dump files should not be committed.
