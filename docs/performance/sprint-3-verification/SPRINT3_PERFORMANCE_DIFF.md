# Sprint 3 Performance Diff — /home

**Generated:** 2026-07-26T18:05:00.000Z

---

## Benchmark methodology

Same as Sprint 2: authenticated GET `/home` as `user1@friendintro.com`, dev/profiling server, headers + server slow-query log.

| Field | Sprint 2 baseline | Sprint 3 session A (warm) | Sprint 3 verification (cold) |
| --- | --- | --- | --- |
| **Source** | `baseline-static.json` | `sprint-3/artifacts/after.json` | `capture-http-profile` 2026-07-26T18:02Z |
| **Git** | `87edda0` | uncommitted | `87edda0` |
| **Port** | 3000 | 3002 | 3010 |
| **Cold compile** | No | No | **Yes (28.8s)** |

**Warning:** Cold-compile capture is **not** comparable to warm Sprint 2/3 sessions.

---

## HTTP metrics

| Metric | Sprint 2 | Sprint 3 warm | Sprint 3 cold (this audit) |
| --- | --- | --- | --- |
| TTFB | 6,103 ms | 2,344 ms | **43,395 ms** |
| Total | 12,591 ms | 9,246 ms | **52,696 ms** |
| Status | 200 | 200 | **200** |
| Middleware auth | 446 ms | — | **795 ms** |

Use **Sprint 3 warm** for indicative HTTP improvement; use **query counts** for definitive Sprint 3 gain.

---

## Prisma query metrics (RUNTIME VERIFIED — request `2afc354d`)

| Metric | Sprint 2 (static) | Sprint 3 (runtime) |
| --- | --- | --- |
| Total Prisma ops | 25 | **~16–18** |
| StoryTag.findMany | 10 | **2** |
| StoryTag.count | 2 | **0** |
| Story.findMany | 5 | **5** |
| DB time (slow log sum) | — | **~29s** (pooler-inflated, parallel) |

---

## Pooler / infrastructure (established facts)

| Metric | Value | Evidence |
| --- | --- | --- |
| SELECT 1 p95 | 3,109 ms (this session) | `check-db-latency` |
| SELECT 1 avg | 587 ms | `check-db-latency` |
| Pooler wait | Dominates per-query latency | Sprint 1 accepted |

---

## Render / CPU / memory

| Metric | Status |
| --- | --- |
| CPU | **UNVERIFIED** — dev compile dominated cold capture |
| Memory | **UNVERIFIED** — `/api/bench/runtime` returned 401 without session |
| Render time | **UNVERIFIED** — no RSC segment breakdown captured |
| Network time | Included in TTFB |

---

## Query latency (RUNTIME VERIFIED)

| Metric | Value |
| --- | --- |
| Average query latency (slow log, 18 ops) | ~1,622 ms |
| Slowest query | Story.findMany **4,898 ms** (mutual authors) |
| Slowest StoryTag | findMany **4,600 ms** (scan B) |

---

## Commands executed

```powershell
$env:PROFILE_PRODUCTION='1'; $env:AUTH_PROFILE='1'; npm run dev -- -p 3010
npx tsx scripts/capture-http-profile.ts --base=http://localhost:3010
npm run check-db-latency
```

---

## Conclusion

Sprint 3 achieved **measurable query reduction** (32%, StoryTag −80%). End-to-end HTTP improvement **not proven** in controlled A/B this audit; warm Sprint 3 session showed faster TTFB/total than Sprint 2 baseline.
