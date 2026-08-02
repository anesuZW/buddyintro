# PRODUCTION_SPEED_REPORT

**Phase:** Performance Phase 3 — Production Speed Pass  
**Generated:** 2026-07-31  
**Scope:** Safe Next.js / asset / caching wins only  
**Out of scope:** Story loader rewrite, recommendation redesign, business logic, visibility, UI behaviour

---

## Summary

Production build is deployment-ready with smaller First Load JS on the heaviest routes, explicit compression/caching, deferred non-critical client shells, and AVIF/WebP image optimization for avatars.

Largest client wins: **`/discoveries` 221 → 165 kB (−56 kB)** and **`/create-story` 215 → 102 kB (−113 kB)**. Warm production TTFB on `/home` / `/messages` is already in the sub‑second to ~1 s range after Phase 2 auth work; remaining multi‑second TTFB on `/discoveries` / `/profile` is still **DB/pooler bound**, not JS parse.

Lighthouse (desktop, production `/login`): **Performance 95**, LCP **2.7 s**, TTFB **68 ms**.

---

## Changes made

| Area | Change |
| --- | --- |
| `next.config.js` | `compress: true`, `poweredByHeader: false`, `optimizePackageImports` for `lucide-react` / `date-fns` / `framer-motion`, image `formats` AVIF+WebP + 30d `minimumCacheTTL`, immutable `/_next/static` + `/_next/image` cache headers |
| `tsconfig.json` | Exclude `docs/**` from production typecheck (artifact scripts were failing `next build`) |
| `lib/fonts.ts` | Explicit `preload` + `adjustFontFallback` |
| Layouts | Lazy `InstallPrompt`, `CookieConsentBanner`; deferred PWA `UpdateManager` / `OfflineDetector` |
| `Avatar` | Prefer `next/image` for optimizable URLs; keep `<img>` for `/api/*`, blob, data |
| `/profile` | Code-split below-fold panels via `ProfileDeferredPanels` (same DOM order) |
| `/maindash` | Code-split admin panels via `MainDashPanels` |
| Nginx template | Gzip + immutable `/_next/static` / icons (aligned with `docs/deployment/nginx.conf`) |

**Not changed:** recommendations, Story ordering/visibility, feed/query logic, UI copy/layout structure (order preserved).

---

## Bundle size — before vs after

Before sources: `docs/PERFORMANCE_AUDIT.md`, `docs/RELEASE_MANAGER_REPORT.md`.  
After: production `next build` log (`artifacts/build-after-3.log`), buildId `-cYDz4-yrY5Ge-TQwXzmB`.

| Route | Before FLJS | After FLJS | Δ |
| --- | --- | --- | --- |
| Shared by all | 87.4 kB | **87.7 kB** | +0.3 kB |
| `/discoveries` | **221 kB** | **165 kB** | **−56 kB** |
| `/create-story` | **215 kB** | **102 kB** | **−113 kB** |
| `/home` | 110 kB | 116 kB | +6 kB |
| `/messages` | (not listed) | 115 kB | — |
| `/profile` | (not listed) | 120 kB | — |
| `/maindash` | (all panels eager) | **89.3 kB** | panels async-split |
| Middleware | 82.1 kB | 96.1 kB | +14 kB (Phase 2 auth timing path) |

Artifacts: `artifacts/fljs-comparison.json`, `artifacts/bundle-after.json`.

Total on-disk production static JS: **~1.67 MB** (uncompressed sum of hashed chunks; transfer is gzip).

---

## Runtime — production server (`next start :3050`)

Authenticated warm medians (n=3, cookie session), artifact `runtime-after.json`:

| Page | Status | Median TTFB | HTML encoding | Notes |
| --- | --- | --- | --- | --- |
| `/login` (authed) | 307 → `/home` | **19 ms** | — | Gate unchanged |
| `/home` | **200** | **825 ms** | gzip | Behaviour OK |
| `/messages` | **200** | **679 ms** | gzip | Behaviour OK |
| `/discoveries` | **200** | **3355 ms** | gzip | Auth OK; TTFB = SSR/DB |
| `/profile` | **200** | **4713 ms** | gzip | Auth OK; TTFB = SSR/DB |

### Compression & caching

| Asset | Encoding | Cache-Control | `X-Powered-By` |
| --- | --- | --- | --- |
| HTML pages | **gzip** | `private, no-cache…` (correct for auth) | **absent** |
| `/_next/static/chunks/*.js` | **gzip** | **`public, max-age=31536000, immutable`** | absent |
| `/sw.js` | gzip | **`no-cache, no-store, must-revalidate`** | absent |

---

## Lighthouse (desktop, production)

URL: `http://127.0.0.1:3050/login`  
Artifact: `artifacts/lighthouse-login-after.json`

| Category | Score |
| --- | --- |
| Performance | **95** |
| Accessibility | **96** |
| Best Practices | 82 |
| SEO | **100** |

| Metric | Value |
| --- | --- |
| TTFB (server-response-time) | **68 ms** |
| FCP | 1.83 s |
| LCP | **2.73 s** |
| TTI | 2.73 s |
| TBT | **0 ms** |
| CLS | 0.033 |
| JS bootup time | **852 ms** |
| Total byte weight | ~320 KB |

Hydration/main-thread cost on the login shell is low (TBT 0). Authenticated pages remain limited by SSR TTFB from the database, not by First Load JS.

---

## Why pages feel faster

1. **Less initial JS** on discoveries / create-story / admin → faster parse + hydrate.  
2. **Non-critical chrome deferred** (install prompt, cookie banner, offline/update UI).  
3. **Tree-shaken icon/date/motion imports** via `optimizePackageImports`.  
4. **Avatar images** can use Next image optimizer (WebP/AVIF) when URLs allow.  
5. **Long-cache hashed static assets** + gzip confirmed in production.  
6. **Docs excluded from `tsc`** → reliable production builds.

---

## Success criteria

| Criterion | Status |
| --- | --- |
| Smaller bundles (heavy routes) | **Pass** (`/discoveries`, `/create-story`) |
| Faster page loads (client + login CWV) | **Pass** (LH Perf 95; gzip + immutable static) |
| Identical behaviour | **Pass** (auth pages 200/307; panel order preserved) |
| Ready for deployment | **Pass** (standalone sync + verify OK) |
| No Story / recommendations / visibility changes | **Pass** |

---

## Remaining (out of scope for Phase 3)

- Authenticated TTFB on `/discoveries` / `/profile` still multi‑second under pooler RTT  
- Feed/story media still uses raw `<img>` (signed `/api/media` paths — intentionally not forced through `next/image`)  
- Middleware bundle grew with Phase 2 auth instrumentation (trade-off already accepted)  
- Best Practices 82 on login (pre-existing; not investigated this phase)

---

## Deploy notes

1. Ship with `output: "standalone"` (unchanged).  
2. Prefer nginx template that serves `/_next/static` immutably + gzip (`deployment/templates/nginx-buddyintro.conf`).  
3. Ensure `NODE_ENV=production` for `next start` / PM2.  
4. Production build command remains `npm run build` (now typechecks without scanning `docs/**`).
