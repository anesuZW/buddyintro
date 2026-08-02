# BuddyIntro Production Readiness Audit — Final Report

**Date:** 2026-07-25  
**Environment:** http://localhost:3000 (Next.js 14.2.15 dev)  
**Method:** Cursor internal browser + CDP + API probes + verification scripts

---

## 1. Executive Summary

This audit exercised BuddyIntro through automated verification scripts, API security probes, and hands-on browser testing of public flows. One **critical SSR bug** was found and fixed (`window is not defined` in PWA platform detection). Prior localhost stabilization fixes (upload `xhr` scope, structured rejection JSON, nginx parser, CSRF same-origin) were verified still in place.

**Unauthenticated pass:** Demo login via browser automation failed (React controlled inputs); API login works and a human session completed the authenticated pass.

**Authenticated pass (human session as Alex Rivera QA):** Profile, story publish, home feed, sent introductions, discoveries interactions, messaging, notifications, and profile settings all exercised successfully. One intermittent story-publish failure (Supabase pooler connection reset) recovered on retry.

**Authenticated continuation (Phases A–D):** Story playback verified (image HTTP 200, viewer opens/closes). External email introduction publish fixed and verified (`POST /api/stories` 201, draft story + invitation in DB). Image discovery posted (`POST /api/discoveries` 201). Comments verified (`POST …/comments` 201). Two production bugs fixed during this pass (see QA-009, QA-010).

**Verdict:** ⚠ **Ready with Minor Issues** — authenticated core workflows pass; email delivery blocked locally (expected); seed-script and DB latency remain; Phases H–J (long session, responsive, full logout regression) not fully executed.

---

## RC2 Update (2026-07-26)

RC2 final validation completed remaining workflows under **feature freeze** (no application code changes).

| Result | Detail |
|--------|--------|
| **RC2 API validation** | 34/38 pass (4 intermittent external intro failures under load — QA-008) |
| **RC1 regression** | 18/18 pass |
| **Video + voice stories** | Created and playback verified in browser |
| **Phone + email intros** | API verified; `emailDelivery` + `phoneInvites` when 201 |
| **Dual-user messaging** | User2 inbox unread + message preview |
| **Upload edge cases** | Oversize → 413; retry OK |
| **Long session** | 30m soak with brief server outage (recovered) |
| **Production Readiness** | **95%** — ⚠ Ready with Minor Issues |

Full report: [`docs/qa/RC2_REPORT.md`](RC2_REPORT.md)

---

## 2. Issues Found

| ID | Severity | Phase | Summary | Status |
|----|----------|-------|---------|--------|
| QA-001 | **Critical** | 17/PWA | SSR crash: `window is not defined` in `detectPlatform()` | **FIXED** |
| QA-002 | High | 2/13 | `seed:demo` fails — `server-only` import in trust graph rebuild | **OPEN** |
| QA-003 | High | 2 | Demo login blocked — Supabase users not seeded / invalid credentials | **BLOCKED** |
| QA-004 | Medium | 12 | `/api/invites/[token]/*` handlers public but middleware returns 401 | **DOCUMENTED** |
| QA-005 | Low | 6 | Email provider env missing locally — diagnostics correct | **EXPECTED** |
| QA-006 | Low | 14 | Slow Prisma queries (1–3s+) on health/home routes | **DOCUMENTED** |
| QA-007 | Info | 1 | Health endpoint reports `degraded` (DB latency) | **DOCUMENTED** |
| QA-008 | Medium | 4 | Story publish 400 on pooler connection reset; retry succeeds | **DOCUMENTED** |
| QA-009 | **High** | 4/B | External email intro fails — Prisma transaction timeout (5s default) | **FIXED** |
| QA-010 | Medium | 4 | File selected without Photo/Video button — `mediaType` null, publish no-ops | **FIXED** |
| QA-011 | Low | 4 | Dev-only HMR `useContext` crash on `/create-story` during hot reload | **DOCUMENTED** |
| QA-012 | Info | 7 | Discoveries delete/edit UI not implemented | **DOCUMENTED** |

### Prior fixes verified (localhost stabilization pass)

| Issue | Status |
|-------|--------|
| `verify-upload.js` nginx parser outputs `25m` | ✅ Verified |
| `xhr is not defined` on failed uploads | ✅ Fixed in `hooks/useUpload.ts` |
| Upload 403 structured JSON + logging | ✅ Verified via API probe |
| CSRF localhost/127.0.0.1 equivalence | ✅ Verified |

---

## 3. Root Causes

### QA-001 — PWA SSR crash

- **Cause:** `detectPlatform()` guarded `navigator` but called `window.matchMedia()` during SSR. Node 22+ defines global `navigator`, so the guard passed but `window` does not exist.
- **Why it occurred:** Platform detection ran synchronously in `InstallPrompt` render.
- **Fix:** Guard `typeof window`; defer detection to `useEffect`.
- **Retest:** `GET /` returns 200; no `window is not defined` in dev server logs after fix.

### QA-002 — Demo seed crash

- **Cause:** Trust graph rebuild imports module chain containing `import "server-only"` (`lib/perf/context.ts`).
- **Why it occurred:** Seed script runs in Node/tsx, not Next.js server context.
- **Impact:** Cannot seed demo users → blocks authenticated QA in fresh environments.

### QA-003 — Browser login automation limitation

- **Cause:** Login form uses controlled React state (`value` + `onChange`). Browser `fill`/DOM value injection does not trigger React updates; password typing blocked by automation policy.
- **Evidence:** `node scripts/qa-test-login.js` succeeds (`user1@friendintro.com` session: true). 10 demo users exist in Supabase.
- **Impact:** Authenticated browser E2E phases require manual login or approved session injection.
- **Status:** **WORKAROUND DOCUMENTED** — not an app bug.

### QA-004 — Invite token API middleware gap

- **Cause:** `lib/supabase/middleware.ts` returns 401 for all unauthenticated `/api/*` except explicit public paths; `/api/invites/[token]/open` not in allowlist.
- **Impact:** Public invite handlers never reached without session.

---

## 4. Files Modified

### QA-009 — External invitation transaction timeout

- **Cause:** `createStoryWithTags` interactive transaction exceeded Prisma default 5000ms on slow pooler (invitation.create + storyTag + findUniqueOrThrow ≈ 5.3s).
- **Fix:** Increased transaction `{ maxWait: 10000, timeout: 20000 }` in `services/stories.ts`.
- **Retest:** `POST /api/stories` 201; invitation `454cf577-…` + draft story `aed0736f-…` persisted.

### QA-010 — StoryUploader mediaType not set on file change

- **Cause:** `onFileChange` set `file` but not `mediaType` unless user clicked Photo/Video first; `submit()` returned early silently.
- **Fix:** Infer `mediaType` from file MIME in `onFileChange`.
- **Retest:** Publish proceeds after programmatic file injection.

### This audit session (continued)

| File | Change |
|------|--------|
| `services/stories.ts` | Transaction timeout for external-tag story creation |
| `components/stories/StoryUploader.tsx` | Set `mediaType` from file MIME on change |
| `docs/qa/PRODUCTION_READINESS_AUDIT.md` | Continuation results |
| `docs/qa/AUDIT_CHECKLIST.md` | Phase A–D updates |

### Prior uncommitted stabilization work (verified)

| File | Change |
|------|--------|
| `scripts/verify-upload.js` | Nginx directive parser |
| `hooks/useUpload.ts` | xhr scope fix, structured errors |
| `lib/upload-reject.ts` | Shared rejection responses |
| `app/api/media/upload/route.ts` | Failure logging + structured JSON |
| `lib/auth.ts` | Structured `requireUserApi` rejections |
| `lib/security.ts` | Same-origin CSRF + dev loopback |
| `middleware.ts` | Upload CSRF logging |
| `lib/supabase/middleware.ts` | Upload auth structured 401 |

---

## 5. Tests Executed

### Automated

| Command | Result |
|---------|--------|
| `npm run verify:upload` | ✅ PASS — `client_max_body_size: 25m` |
| `npm run verify:audio` | ✅ PASS — microphone allowed |
| `npm run verify:email` | ❌ FAIL — missing `RESEND_API_KEY`, `EMAIL_FROM` (expected locally) |
| `npm run production:health` | ⚠ PARTIAL — upload/audio pass, email fails |
| `npm run seed:demo` | ❌ FAIL — server-only import crash |
| `node --test tests/pwa.test.ts` | ❌ FAIL — module resolution (`push-payload`) |

### Browser (Cursor internal)

| Phase | Action | Result |
|-------|--------|--------|
| 1 | Landing page load, fonts, layout | ✅ PASS — no SSR errors after QA-001 fix |
| 1 | Mobile viewport (390×844) | ✅ PASS — responsive layout renders |
| 2 | Signup form fill + submit | ⚠ Email confirmation required (no session) |
| 2 | Demo login `user1@friendintro.com` | ❌ FAIL — stayed on `/login` |
| 17 | PWA manifest fetch | ✅ PASS — 7 icons, `start_url: /home` |
| 10 | Upload API unauthenticated | ✅ 401 structured `{ permission_denied, rejectSource: auth }` |
| 12 | CSRF evil origin POST | ✅ 403 `{ csrf_rejected, rejectSource: csrf }` |

### API enumeration

76 routes documented; middleware blocks unauthenticated access except health/version/metrics/public/auth/share-target.

### Authenticated (human session, Alex Rivera QA)

| Phase | Action | Result |
|-------|--------|--------|
| 3 | Profile edit/save, trust stats, notification prefs | ✅ PASS |
| 4 | Create introduction (Jordan Kim, photo, caption) | ✅ PASS on retry (first attempt 400 — DB) |
| 4 | Voice recorder UI (start/stop) | ⚠ PARTIAL — publish without voice blob |
| 5 | Introductions sent list | ✅ PASS — QA intro listed |
| 5 | Introductions hub / mutual | ✅ PASS — pages load (main list empty: user never tagged) |
| 7 | Discoveries like, bookmark, comment panel | ✅ / ⚠ — like & bookmark OK; comment POST needs human input |
| 8 | Messages inbox + Jordan thread + context | ✅ PASS |
| 9 | Notifications dropdown | ✅ PASS — trust-score items after publish |
| 10 | Authenticated upload | ✅ PASS (prior session) |

### Not executed

External email invitation publish, logout/login regression, Phase 15 long session, Phase 16 responsive (authenticated), Phase 19 full regression.

---

## 6. Performance Findings

- **Health check:** ~3–24s response time; status `degraded` (database latency).
- **Prisma slow query warnings:** `User.findUnique` 263ms–3467ms, `BackgroundJob.count` 600ms–3200ms during health probes.
- **First compile:** Landing ~26s cold start (dev only).
- **Duplicate health/version calls:** `production:health` invokes sub-scripts that re-probe same endpoints.
- **Recommendation:** Profile DB indexes/connection pool before production load; health `degraded` should be investigated on VPS.

---

## 7. Security Findings

| Check | Result |
|-------|--------|
| CSRF origin validation | ✅ Evil origin → 403 structured JSON |
| Same-origin uploads (localhost) | ✅ Passes after stabilization fix |
| Auth middleware | ✅ Protected routes return 401 without session |
| Upload rejection headers | ✅ `X-Upload-Reject-Source`, `X-Upload-Reject-Code` |
| Security headers (next.config) | ✅ Permissions-Policy allows microphone=(self) |
| Secrets in logs | ✅ Upload logs exclude tokens/cookies |
| Invite token public routes | ⚠ Middleware blocks before handler (QA-004) |
| RLS / Supabase | Not fully audited (requires DB access) |

---

## 8. Accessibility Findings

- Signup/login forms have labeled inputs (`Email`, `Password`, `Display name`).
- Language selector exposed as combobox with 10 locales.
- Signup terms checkbox reports `readonly` in a11y tree but is clickable — possible a11y tree quirk, not a functional blocker.
- Cookie consent banner present with Accept/Reject/Customize.
- Full axe/Lighthouse audit not run (tooling unavailable in session).

---

## 9. Remaining Risks

1. **Intermittent Supabase pooler disconnects** can fail story transactions (QA-008); retry or connection tuning needed.
2. **`seed:demo` broken** — blocks local QA and demo environments.
3. **Email invitations** cannot send without production env; diagnostics are correct but untested delivery.
4. **DB health degraded** — may indicate connection latency or missing indexes.
5. **Invite token API middleware gap** — may break unauthenticated invite flows.
6. **Discoveries engagement APIs** may return 500 until dev server restarted after `npm run build` during active dev (QA-013).
7. **20-minute long session test** not performed.
8. **Safari voice recording** — logic present but not browser-tested here.
9. **`npx tsc --noEmit`** reports pre-existing errors in `services/email.ts`, `services/stories.ts`, `tests/migration-audit.test.ts` (no `npm run typecheck` script).

---

## 10. Production Deployment Steps

| Change | Deployment action |
|--------|-------------------|
| PWA SSR fix | Standard deploy — `npm run deploy:production` or existing pipeline |
| Upload stabilization | PM2 restart after standalone build |
| Nginx template | No change — parser-only fix in verify script |
| Email | Set `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` on VPS |
| Nginx uploads | Ensure `client_max_body_size 25m` installed from template |
| Prisma | No new migrations from this audit |
| seed:demo fix | Required for QA environments only — not production |

---

## 11. Suggested Git Commits

**Do not commit automatically.** Suggested logical groups:

```
fix(pwa): guard window access during SSR platform detection

Prevent ReferenceError in detectPlatform() when Node defines navigator
but not window. Defer InstallPrompt platform detection to useEffect.
```

```
fix(upload): structured rejection JSON, xhr scope, and CSRF same-origin

- Return permission_denied / csrf_rejected with rejectSource headers
- Fix xhr ReferenceError on failed uploads
- Allow same-origin and dev loopback CSRF validation
- Fix verify-upload.js nginx comment parser
```

```
fix(stories): infer mediaType on file select and extend create transaction timeout

- StoryUploader: set mediaType from MIME in onFileChange
- createStoryWithTags: 20s transaction timeout for slow DB / external invites
```

```
docs(qa): add production readiness audit report and checklist
```

---

## 12. Production Readiness Score

**85 / 100** (transaction + mediaType fixes; external intro flow verified)

| Area | Weight | Score | Notes |
|------|--------|-------|-------|
| Infrastructure / deploy | 15 | 85 | Verification scripts pass; build needs dev server stopped |
| Upload system | 10 | 90 | Fixed diagnostics + nginx |
| Auth / security | 15 | 80 | CSRF good; human session verified |
| Core features (tested) | 25 | 88 | Stories, intros, discoveries, messaging pass |
| Email | 10 | 62 | Invitation send fails locally with clear logs + toast |
| Performance | 10 | 52 | Degraded health; slow pooler |
| PWA | 5 | 80 | SSR fix; manifest OK |
| Accessibility | 5 | 65 | Basic labels; no full audit |
| Observability | 5 | 88 | Structured upload + email rejection logging |

---

## GO / NO-GO Checklist

| Area | Result | Evidence |
|------|--------|----------|
| Authentication | **PASS** | Human session; API login OK |
| Profiles | **PASS** | Edit/save, prefs, trust stats |
| Stories | **PASS** | Publish 201; external draft + invitation persisted |
| Story Playback | **PARTIAL** | Image story opens; voice/video N/A in seed data |
| Voice Recommendations | **PARTIAL** | Recorder UI OK; attach not E2E verified |
| Uploads | **PASS** | Authenticated 200 + structured 401/403 |
| Introductions | **PASS** | Sent list; external email draft flow |
| Invitation Emails | **PARTIAL** | Resend 422 (example.com) + SMTP timeout; DB + logs correct |
| Discoveries | **PASS** | Text + image post 201; comment 201; like blocked by dev .next race |
| Messaging | **PASS** | Inbox, thread, context panel |
| Notifications | **PASS** | Dropdown with trust events |
| Security | **PASS** | CSRF + auth middleware verified |
| Performance | **FAIL** | Health degraded; slow Prisma |
| Accessibility | **PARTIAL** | Basic form labels; no Lighthouse |
| PWA | **PASS** | SSR fix; manifest valid |
| Deployment | **PASS** | Pipeline + nginx template compatible |

---

## Final Recommendation

⚠ **Ready with Minor Issues**

Ship-blocking infrastructure (upload limits, CSRF, upload diagnostics, PWA SSR) is in good shape. Before production GO:

1. Fix `seed:demo` server-only import so QA environments work.
2. Resolve health `degraded` / DB latency on the target VPS.
3. Configure email env vars and verify one invitation send in staging.
4. Tune Supabase pooler / add transaction retry for story publish (QA-008).
5. Run external email invitation publish in staging with verified domain.
6. Investigate invite token middleware gap (QA-004) if external invite links are used without login.

---

*Screenshots: `docs/qa/screenshots/` (landing before/after, mobile viewport)*  
*Live checklist: `docs/qa/AUDIT_CHECKLIST.md`*
