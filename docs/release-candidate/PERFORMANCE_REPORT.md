# PERFORMANCE_REPORT — RC-1 Validation

**Date:** 2026-07-31  
**Server:** `next start` production, ports 3060–3063  
**Artifacts:** `artifacts/smoke-pages-apis.json`, Phase 3 speed report

---

## Executive take

Frontend bundles from Phase 3 are healthy (shared FLJS ~87.7 kB; discoveries ~165 kB). **Perceived speed is dominated by Supabase pooler RTT** from this workstation (often 800 ms–5 s per query). When the pooler is reachable, authenticated HTML TTFB is ~1–4 s; when unreachable, shells now degrade to Service Unavailable (~5 s) instead of crashing.

---

## Measured (authenticated smoke, healthy-enough window on :3060)

| Page / API | Status | TTFB |
| --- | --- | --- |
| `/home` | 200 | 3451 ms |
| `/discoveries` | 200 | 2440 ms |
| `/messages` | 200 | 1080 ms |
| `/profile` | 200 | 4048 ms |
| `/create-story` | 200 | 1001 ms |
| `/api/feed` | 200 | 2976 ms |
| `/api/discoveries` | 200 | 3222 ms |
| `/api/health` | 200 degraded | ~816–3600 ms DB latency |
| `/manifest.webmanifest` | 200 | 39 ms |
| `/sw.js` | 200 | 11 ms |

## Outage window (:3063)

| Route | Status | Notes |
| --- | --- | --- |
| `/home`…`/profile` | **200** | Service Unavailable shell (~5 s) — post RC3-002 |
| POST `/api/discoveries` | **500** empty | Pooler down — RC3-004 remains |

## Client / CWV (Phase 3 login Lighthouse, desktop)

| Metric | Value |
| --- | --- |
| Performance | 95 |
| LCP | 2.73 s |
| TTFB | 68 ms (login SSG/shell) |
| TBT | 0 ms |
| CLS | 0.033 |

## User-perceived slow items

1. **Every authenticated navigation** waits on pooler (primary)  
2. **Profile / discoveries** heavier SSR fan-out  
3. **Mutations during outage** hang ~5 s then fail  

## Recommendation

Ship app fixes; for production UX &lt;1.5 s, app must run **near the DB** (or use a lower-latency pooler path). Do not chase further JS cuts until TTFB &lt;800 ms warm.
