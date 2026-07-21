# BuddyIntro — Full Development Audit Report

**Date:** 2026-07-21  
**Scope:** Windows-first production readiness (Next.js 14, PWA, Supabase, PM2 standalone)

---

## 1. Architecture Summary

| Layer | Status | Notes |
|-------|--------|-------|
| App Router + i18n | ✅ Fixed | Locale routing applies to pages only; `/api/*` bypasses `next-intl` |
| Middleware | ✅ Fixed | Session refresh on API; JSON 401 instead of login redirect |
| API routes (76) | ✅ Fixed | All use `requireUserApi()` / `requireAdminApi()` — no page redirects |
| PWA / Service Worker | ✅ Validated | 65/65 runtime checks pass |
| Supabase auth | ✅ OK | Trusted headers from middleware; server/client separation intact |
| CSP / Security | ✅ Fixed | `wss://*.supabase.co` added for Realtime |
| Standalone + PM2 | ✅ OK | `ecosystem.config.js` → `server.js`; added `npm run start:standalone` |
| Build | ✅ Pass | Zero TS errors; one ESLint warning (NotificationBell deps) |

---

## 2. Critical Bugs Found & Fixed

### BUG-1: API routes localized and redirected to login (CRITICAL)

**Symptom:** `fetch("/api/discoveries")` returned HTML login page (200 after redirect) instead of JSON 401.  
**Cause:** `intlMiddleware` ran on `/api/*`; `updateSession` redirected unauthenticated API calls to `/login`.  
**Fix:**
- `middleware.ts` — early return for `/api/*` skipping locale middleware
- `lib/supabase/middleware.ts` — return `401 JSON` for unauthenticated API requests
- `lib/auth.ts` — added `requireUserApi()` returning JSON errors
- Migrated 40 API route handlers from `requireUser()` → `requireUserApi()`

### BUG-2: CSP blocked Supabase Realtime WebSockets

**Symptom:** `useRealtimeMessages` / `useRealtimeNotifications` would fail CSP `connect-src`.  
**Fix:** `lib/security.ts` — added `wss://*.supabase.co wss://*.supabase.in`

### BUG-3: PWA Web Share Target blocked by auth middleware

**Symptom:** `/api/share/target` redirected to login before storing share draft.  
**Fix:** Added `/api/share/target` to `AUTH_PUBLIC_PATH_PREFIXES`

### BUG-4: PM2 / audit server mismatch with standalone output

**Symptom:** `next start` warning; audit server not matching production deploy.  
**Fix:** `scripts/lib/audit-server.js` prefers `.next/standalone/server.js` with static/public copy; falls back to `next start`

---

## 3. Files Modified

### Core architecture
- `middleware.ts`
- `lib/supabase/middleware.ts`
- `lib/middleware-public-paths.ts`
- `lib/auth.ts`
- `lib/security.ts`

### API routes (40 files)
- All `app/api/**/route.ts` using `requireUser()` or `requireAdmin()`

### Tooling & tests
- `scripts/audit-api-json.js` (new)
- `scripts/migrate-api-auth.js` (new)
- `scripts/audit-release.js`
- `scripts/lib/audit-server.js`
- `tests/production-certification.test.ts`
- `tests/audit-release.test.ts`
- `package.json` — `audit:api`, `start:standalone`

---

## 4. Validation Results

```bash
npm run build                    # ✅ Success (0 TS errors)
npm run certify:production       # ✅ 56/56 tests
npm run audit:release -- --skip-health  # ✅ PASSED
  - PWA runtime: 65/65
  - API JSON smoke: 9/9 endpoints return JSON 401
  - Lighthouse: performance 82%, a11y 96%, SEO 100%
```

### Browser smoke (localhost:3000)
- ✅ `/login` — renders, no console errors observed
- ✅ `/signup` — renders, language switcher present
- ⚠ Authenticated journeys (stories, messages, admin) require test credentials — not automated in this pass

### API endpoints verified (unauthenticated → JSON 401)
- `/api/discoveries`, `/api/posts`, `/api/stories`, `/api/messages`, `/api/profile`
- `/api/analytics/track`, `/api/introductions`, `/api/feed`, `/api/notifications`

---

## 5. Remaining Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Prisma `EPERM` on Windows during `prisma generate` while dev server running | Low | Stop dev server before build; client already generated |
| `lib/metrics.ts` uses Node APIs in Edge middleware import chain | Low | Build warning only; consider splitting edge-safe metrics |
| NotificationBell `useEffect` missing dependency | Low | ESLint warning; no runtime impact observed |
| Full authenticated E2E not automated | Medium | Manual smoke with test account before deploy |
| `/en/api/*` invalid paths may 307 redirect (not a real API route) | Info | Clients must use `/api/*` only |

---

## 6. Recommended Production Deployment (Ubuntu / InterServer / PM2)

```bash
# 1. Build locally (Windows or CI)
npm ci
npm run build

# 2. Package standalone (existing deploy pipeline)
npm run deploy:build   # or deploy-package.js flow

# 3. On VPS — extract to APP_ROOT, set env
export APP_ROOT=/home/buddyintro/app/current
export NODE_ENV=production
export PORT=3000

# 4. PM2 (from standalone directory)
cd $APP_ROOT
pm2 start ecosystem.config.js
pm2 save

# 5. Nginx reverse proxy → localhost:3000
# proxy_pass http://127.0.0.1:3000;
# proxy_http_version 1.1;
# proxy_set_header Upgrade $http_upgrade;  # for websockets

# 6. Pre-deploy certification
npm run audit:release
npm run health -- --url=https://your-domain.com
```

---

## 7. One-Command Certification

```bash
npm run build
npm run audit:release
```

Individual audits:
- `npm run audit:pwa` — PWA runtime (SW, manifest, cache)
- `npm run audit:api` — API JSON contract
- `npm run audit:lighthouse` — Performance / a11y / SEO
- `npm run certify:production` — Static architecture tests

See also: [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)
