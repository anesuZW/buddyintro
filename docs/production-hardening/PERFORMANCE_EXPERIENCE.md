# PERFORMANCE_EXPERIENCE

## Measured (:3070, authed smoke)

| Route | TTFB / duration |
| --- | --- |
| `/api/health` | ~4.0 s (DB probe ~3.3 s) |
| `/api/feed` | ~5.7 s |
| `/api/discoveries` GET | ~4.7 s |
| Discovery POST | ~4–5 s → **201** |
| Upload PNG | ~3.4 s → **200** |
| `/home` HTML | ~4.1 s → **200** |
| `/sw.js` | 26 ms |
| Manifest | 110 ms |

## Client budgets (from Phase 3)

Shared First Load JS **~87.7 kB**; Lighthouse login Perf **95** (prior).

## Action taken this phase

No experimental FE optimizations. Hardening focused on **failure UX** under the same latency profile. Meaningful speed gains require hosting near the database.
