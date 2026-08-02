# Historical Comparison

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31

---

## Important environment splits

Do **not** mix these baselines:

| Era | Environment | Characteristic |
| --- | --- | --- |
| June SSR docs | Local / faster DB path | `/home` warm ~400 ms |
| July Sprint 1–5A | Supabase **us-east-1 pooler** from workstation | RTT ~300–450 ms/query |
| 2026-07-31 reset | Same pooler + **schema drift 500s** | Auth/middleware only |

All sprint comparisons below are **pooler-era** unless noted.

---

## `/home` query count

| Stage | StoryTag.findMany | Story.findMany | UserConnection | Total Prisma (approx) |
| --- | --- | --- | --- | --- |
| Pre-Sprint 2/3 | ~10 | 5 | 2+ | **~25** |
| Sprint 2 | (auth dedupe) | 5 | 2+ | ~16–18 est. |
| Sprint 3 | **2** | 5 | 2 | **17** |
| Sprint 4 | 2 | **4** | **1** | **~15** |
| Sprint 5A | 2 | 4 | 1 | ~15 (no code change) |
| Sprint 5 “unified loader” | — | — | — | **Not shipped** (Option B) |

---

## `/home` TTFB / total

| Stage | TTFB | Total | Notes |
| --- | --- | --- | --- |
| Original audit (Jun, broken pooler) | up to **207,649** | — | Timeouts |
| Sprint 2 warm | **6,103** | 12,591 | Auth report |
| Sprint 3 warm | **2,344** | 9,246 | Best measured warm |
| Sprint 3 cold verify | 43,395 | 52,696 | Compile dominated |
| Sprint 4 / 5A live | — | — | HTTP often blocked |
| Reset 2026-07-31 | 13,519 | 13,524 | **500** schema drift |

**App-level query reduction worked** (25→15, warm TTFB 6.1s→2.3s). Absolute feel remains slow because **RTT × remaining queries** still seconds.

---

## Database time

| Metric | Sprint 1 | Sprint 2 est. | Sprint 3/4 |
| --- | --- | --- | --- |
| SELECT 1 / RTT p50 | ~305–455 ms | same class | **335 ms** live reset |
| EXPLAIN SQL | &lt;1 ms | &lt;1 ms | unchanged |
| Est. `/home` DB sequential | ~8,190 ms @25q | ~4,900 ms | ~5,025 ms @15×335 |

---

## Auth

| Metric | Before Sprint 2 | After Sprint 2 | Reset live |
| --- | --- | --- | --- |
| duplicateAuth | yes risk | **no** | **no** |
| middleware getUser | present | present | 573–1033 ms |
| route getUser | duplicate | **0 ms** headers | **0 ms** |

---

## Render / memory / CPU / bundles

| Metric | Evidence across sprints |
| --- | --- | --- |
| RSC structure | `/home` Suspense added/kept; discoveries/profile still blocking |
| Memory | Sprint 2 client heap Δ ~1 MB — not primary |
| CPU | Marginal vs DB wait |
| Bundle FLJS | `/home` ~110 KB; `/discoveries` ~221 KB — stable docs |
| Dev main-app.js | 5.88 MB decoded (reset measurement) — dev only |

---

## What improved vs what did not

| Improved (measured) | Did not materially change |
| --- | --- | --- |
| Duplicate auth | Pooler geography / RTT floor |
| StoryTag 10→2 | SQL plan cost (already tiny) |
| Story 5→4, connections 2→1 | Need for ~15 round-trips of business data |
| Warm TTFB 6.1→2.3 s | Perception vs local-Postgres ~400 ms era |

---

## Sprint 5 narrative correction

Prompt assumed “Sprint 5 introduced a unified Story loading architecture.”  
Evidence: Sprint 5A **rejected** full unification (**Option B**). Only optional narrow trust merge (5B) was proposed and **deferred**.
