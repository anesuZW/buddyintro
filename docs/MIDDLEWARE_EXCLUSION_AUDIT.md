# Middleware Exclusion Audit

Generated: 2026-06-23

---

## How auth middleware works

1. **`middleware.ts`** matcher decides which paths invoke middleware.
2. **`lib/supabase/middleware.ts`** always calls `supabase.auth.getUser()` (~250ms RTT) **before** checking `isPublic`.
3. `isPublic` only skips **redirect to login** — it does **not** skip auth work.

Therefore paths must be **excluded from the matcher** to truly bypass auth.

---

## Required paths

| Path | Purpose | Before fix | After fix |
| ---- | ------- | ---------- | --------- |
| `/manifest.webmanifest` | PWA manifest (`app/manifest.ts`) | **Matched** — paid auth on install | **Excluded** |
| `/offline` | PWA offline fallback (`app/offline/page.tsx`) | **Matched** | **Excluded** |
| `/icons/*` | PWA icons (`public/icons/*.svg`) | **Matched** | **Excluded** |
| `/api/health` | Load balancer / uptime probe | **Matched** — ~250ms auth tax | **Excluded** |

---

## Fix applied

`middleware.ts` matcher updated:

```typescript
"/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|offline|icons/|api/public|api/health).*)"
```

Previously excluded: `_next/static`, `_next/image`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `api/public`.

---

## Verification checklist

| Check | Expected |
| ----- | -------- |
| `GET /manifest.webmanifest` | 200, no `x-auth-profile-middleware-ms` header |
| `GET /offline` | 200 HTML, no auth redirect |
| `GET /icons/icon-512.svg` | 200 static asset |
| `GET /api/health` | JSON `{ status: ... }`, no Supabase auth round-trip |

Run locally:

```bash
curl -sI http://localhost:3000/manifest.webmanifest | findstr /i "HTTP x-auth"
curl -sI http://localhost:3000/offline | findstr /i "HTTP location"
curl -sI http://localhost:3000/icons/icon-512.svg | findstr /i "HTTP"
curl -s http://localhost:3000/api/health
```

---

## Related public routes (still in middleware)

These remain authenticated at middleware layer but use `isPublic` for redirect only:

- `/` landing
- `/privacy`, `/terms`, `/cookies`
- `/invite/*`, `/invite-preview/*`

**Not changed** — intentional for marketing/invite flows that still call `getUser()` today. **P1 post-launch:** exclude landing from matcher or use JWT cache.

---

## Launch impact

**Fixed** — PWA install/offline/icons and health probes no longer pay auth latency or fail when unauthenticated.
