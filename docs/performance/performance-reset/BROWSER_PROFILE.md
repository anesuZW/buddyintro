# Browser Profile

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31  
**Artifact:** `artifacts/browser-landing-2026-07-31.json`

---

## Scope limitation

Authenticated routes returned **HTTP 500** (schema drift: `users.preferred_language`). Browser Core Web Vitals for `/home`, `/discoveries`, `/messages`, `/profile` could **not** be measured this session.

Landing `/` was measured via CDP Navigation Timing + Resource Timing on `http://localhost:3010/`.

---

## Landing `/` (live, next dev)

| Metric | Value | Notes |
| --- | --- | --- |
| TTFB | **2,570 ms** | Includes middleware Supabase `getUser` |
| FCP | **2,712 ms** | ≈ TTFB + 142 ms |
| FP | 2,712 ms | Same as FCP |
| LCP | **null** | No LCP entry observed (cookie modal / text hero) |
| CLS | Not instrumented | Manual observation: cookie banner may shift |
| DCL | 2,688 ms | |
| load | 2,916 ms | |
| Hydration window | ~FCP→load (~200 ms) | Rough; not React-profiler precise |

**Reading:** On the public page, **server TTFB dominates**. Client paint follows almost immediately after HTML arrives. The app “feels slow” here because of **middleware auth RTT**, not large DOM work.

---

## Historical authenticated page times (HTTP capture, not CWV)

| Page | Status | TTFB | Total | When |
| --- | --- | --- | --- | --- |
| `/home` warm | 200 | **2,344** | 9,246 | Sprint 3 |
| `/home` cold | 200 | 43,395 | 52,696 | 2026-07-26 |
| `/discoveries` | 200 | 20,565 | 20,579 | cold cluster |
| `/messages` | 200 | 4,998 | 6,417 | cold cluster |
| `/profile` | 200 | 9,898 | 9,914 | cold cluster |
| Sprint 2 `/home` | 200 | 6,103 | 12,591 | post-auth opt |

Live 2026-07-31 authenticated captures are **500s** — excluded from performance baselines.

---

## Largest network requests (landing, transfer size)

| Resource | Transfer | Decoded | Duration |
| --- | --- | --- | --- |
| `main-app.js` (dev) | **1.31 MB** | 5.88 MB | 190 ms |
| `[locale]/layout.js` | 352 KB | 1.47 MB | 72 ms |
| Inter woff2 | 48 KB | 47 KB | 80 ms |
| `[locale]/page.js` | 43 KB | 206 KB | 35 ms |
| `app-pages-internals.js` | 31 KB | 130 KB | 31 ms |
| `layout.css` | 9 KB | 48 KB | 17 ms |

**Dev caveat:** Uncompressed/dev bundles are **not** production First Load JS. Documented production FLJS: `/home` ~110 KB, `/discoveries` ~221 KB (`docs/PERFORMANCE_AUDIT.md`).

---

## Hydration risk areas (authenticated, static analysis)

| Island | Route | Risk |
| --- | --- | --- |
| StoryBar + FeedList | `/home` | Media-capable UI |
| TrustRecommendationsPanel | home, discoveries, profile | Shared |
| DiscoveriesFeed + Composer | `/discoveries` | Client pagination |
| MessagesInboxClient | `/messages` | Entire inbox client-fetched |
| StoryUploader (lazy chunk) | create-story | Dev chunk **2.1 MB** on disk |

---

## CLS / images

- No multi-MB marketing images on landing.
- Cookie consent overlay present (potential CLS contributor).
- Story/media UX depends on `/api/media` redirects (historical 1.8–5.8 s API times when pooler stressed) — not re-measured live.
