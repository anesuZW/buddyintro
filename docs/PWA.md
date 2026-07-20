# BuddyIntro PWA & Web Push

Production Progressive Web App architecture for BuddyIntro (Next.js 14 standalone + Nginx).

## Overview

| Layer | Location |
|-------|----------|
| Manifest | `app/manifest.ts` → `/manifest.webmanifest` |
| Service worker | `scripts/pwa/sw-source.js` → `public/sw.js` (Workbox) |
| Registration | `components/pwa/PwaProviders.tsx` + `ServiceWorkerProvider.tsx` |
| IndexedDB | `lib/pwa/db.ts` (via `idb`) |
| Push delivery | `services/notifications/push-service.ts` |
| Push queue | BullMQ `push-notifications` + `scripts/push-worker.ts` |
| Subscriptions | `push_subscriptions` table + `/api/push/*` |

## Build pipeline

```bash
npm run build
# prisma generate → generate-pwa-icons → next build → build-sw → write-build-version
```

Icons: `npm run generate:pwa-icons`  
Service worker only: `npm run build:sw` (after `next build` for full precache)

## Cache strategy

| Resource | Strategy |
|----------|----------|
| JS / CSS / fonts | StaleWhileRevalidate |
| Icons / images / uploads | CacheFirst |
| GET `/api/*` (non-auth) | NetworkFirst (5 min TTL) |
| Auth/session API | NetworkOnly |
| POST `/api/*` | NetworkOnly + BackgroundSync retry |
| Navigation | NetworkFirst → `/offline.html` fallback |

Auth responses are never cached.

## Web Push flow

1. Client calls `GET /api/push/subscribe` for VAPID public key.
2. User grants permission → `POST /api/push/subscribe` stores subscription (+ device metadata).
3. Notification created → `notificationService.create()` → `enqueuePushNotification()`.
4. With `REDIS_URL`: job queued on `push-notifications`; `push-worker` delivers via `web-push`.
5. Without Redis: inline delivery (same code path, no queue).
6. Stale subscriptions (410/404) are deleted automatically.

### VAPID keys

```bash
npx web-push generate-vapid-keys
```

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:support@buddyintro.com
```

### Notification types

Per-category toggles live in `notification_preferences` (introduction, invitation, discovery, message, trust, verification) plus global push/email/in-app switches. Payload actions are built in `lib/pwa/push-payload.ts` (Reply, View Story, Accept, Open Discoveries, Dismiss).

## API routes

| Route | Purpose |
|-------|---------|
| `GET/POST/DELETE /api/push/subscribe` | VAPID key, subscribe, unsubscribe |
| `POST /api/push/unsubscribe` | Disable subscription |
| `POST /api/push/test` | Send test push to current user |
| `POST /api/push/send` | Admin send (requires admin) |
| `GET/PATCH /api/push/preferences` | Notification preferences |

Legacy: `/api/notifications/push` remains supported.

## Offline

- Static fallback: `public/offline.html` + `app/[locale]/offline/page.tsx`
- Draft stories & queued uploads: IndexedDB (`lib/pwa/db.ts`)
- Failed POSTs: Background Sync + `lib/pwa/offline-queue.ts`
- Online reconnect triggers queue flush

## Deployment (PM2)

```bash
pm2 start ecosystem.config.js
# Includes buddyintro-push-worker when REDIS_URL is set
```

Nginx must serve `/sw.js`, `/workbox/*`, `/icons/*`, `/manifest.webmanifest` without auth. Middleware excludes these paths.

Ensure `Cache-Control: no-cache` on `/sw.js` (set in `next.config.js` headers).

## Browser support

| Browser | Install | Push | Background sync |
|---------|---------|------|-------------------|
| Chrome Android | ✅ | ✅ | ✅ |
| Chrome Desktop | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ |
| Samsung Internet | ✅ | ✅ | Partial |
| Safari iOS 16.4+ | Add to Home Screen | ✅ (installed PWA) | ❌ (visibility refresh fallback) |
| Firefox | Limited install | ✅ Desktop | Partial |

iOS install instructions shown via `InstallPrompt` (Share → Add to Home Screen).

## Troubleshooting

| Issue | Check |
|-------|-------|
| No push | VAPID keys, `enablePushNotifications` pref, admin setting |
| SW not updating | Hard refresh; verify `/sw.js` not cached by CDN |
| 410 subscriptions | Normal — expired endpoints auto-removed |
| Queue not processing | `REDIS_URL`, `npm run push-worker`, PM2 logs |

## Future improvements

- Web Push encryption for payload fields
- Push batching per user digest
- Locale-specific push copy from `preferredLanguage`
- Periodic sync for feed cache on Chromium
