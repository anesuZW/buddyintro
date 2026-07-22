# BuddyIntro RC1 — Pre-Deployment Release Checklist

Run **one command** to certify a release candidate:

```bash
npm run build
npm run audit:release -- --skip-health
```

Individual audit steps (for debugging):

| Command | Purpose |
|---------|---------|
| `npm run certify:production` | Static PWA, middleware, security, deployment checks |
| `npm run audit:pwa` | Runtime HTTP + headless Chrome SW/cache/manifest validation |
| `npm run audit:lighthouse` | Lighthouse CI (performance, a11y, SEO, best-practice audits) |
| `npm run health` | Full environment + API health (requires `.env`) |

## Prerequisites

- [ ] `npm run build` completed successfully
- [ ] `.env` / `.env.local` configured (for health check)
- [ ] Port `3000` free (or pass `--url=http://127.0.0.1:PORT`)
- [ ] Google Chrome installed (for Lighthouse + browser PWA audit)

## Automated gates (`audit:release`)

### 1. Build integrity
- [ ] `.next/standalone/server.js` exists
- [ ] `.next/BUILD_ID` present
- [ ] `public/sw.js` built with Workbox precache
- [ ] `public/workbox/workbox-sw.js` present
- [ ] `.next/standalone/build/version.json` + `.next/standalone/deployment/build.json` written (repo-root copies are gitignored)

### 2. Static certification (`certify:production`)
- [ ] Middleware excludes SW, manifest, icons, uploads, `_next/static`
- [ ] Auth middleware uses shared public path list
- [ ] Manifest defines shortcuts, screenshots, share_target, protocol_handlers, launch_handler, maskable icons
- [ ] Push API routes + worker scripts present
- [ ] CSP, frame denial, SW cache headers configured

### 3. PWA runtime (`audit:pwa`)
- [ ] `/sw.js` → 200, `no-cache`, not auth-gated
- [ ] `/manifest.webmanifest` → valid JSON with all installability fields
- [ ] `/offline.html`, icons, favicon, browserconfig → 200
- [ ] Built SW contains: skipWaiting, clients.claim, navigationPreload, BackgroundSync, notification handlers
- [ ] Headless Chrome: SW registers, Cache Storage populated, manifest linked, SKIP_WAITING accepted

### 4. Lighthouse CI (`audit:lighthouse`)
- [ ] Performance ≥ 75% (warn threshold on localhost)
- [ ] Accessibility ≥ 88%
- [ ] SEO ≥ 88%
- [ ] Best practices: no console errors, valid doctype, no geolocation/notification on load, no deprecations
- [ ] PWA validated separately by `audit:pwa` (Lighthouse 12+ removed PWA category)

### 5. Health
- [ ] `/api/health` returns healthy
- [ ] Database + Supabase connectivity verified

## Manual smoke (recommended post-audit)

- [ ] Install PWA on Chrome Desktop (Add to apps)
- [ ] Add to Home Screen on Android / iOS Safari
- [ ] Toggle offline → navigate → offline fallback shown
- [ ] Enable push notifications → receive test notification → tap opens correct page
- [ ] App badge reflects unread notification count
- [ ] SW update prompt appears after new deploy

## Database (production only)

- [ ] Run `scripts/sql/verify-migrations-0001-0008.sql` against production (read-only)
- [ ] `npm run prisma:deploy` on server after backup

## Deploy

```bash
npm run deploy:v3          # or your production deploy script
npm run health -- --url=https://your-domain.com
```

## Flags

```bash
npm run audit:release -- --skip-lighthouse    # Skip Lighthouse (faster CI)
npm run audit:pwa -- --no-browser             # HTTP-only PWA checks
npm run audit:pwa -- --url=https://staging.example.com
```
