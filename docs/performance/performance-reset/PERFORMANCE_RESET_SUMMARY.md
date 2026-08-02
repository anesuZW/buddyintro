# Performance Reset Summary

**Sprint:** BuddyIntro Performance Reset — Full End-to-End Investigation  
**Date:** 2026-07-31  
**Mode:** READ-ONLY (no optimisations, no business-logic changes)

---

## Verdict

The application feels slow because **Supabase network round-trips dominate**, not because SQL is slow or because Story loaders were left unmerged.

After Sprints 2–4, `/home` Prisma work dropped **~25 → ~15** queries and warm TTFB improved **6.1 s → 2.3 s**. That is real progress — and still far from a &lt;1.5 s budget while each query costs **~300–450 ms** of pooler RTT from this workstation to **us-east-1**.

Sprint 5 did **not** ship a unified Story architecture; Sprint 5A correctly chose **Option B**.

---

## TOP 3 bottlenecks

| # | Bottleneck | Evidence | Projected impact if fixed |
| --- | --- | --- | --- |
| **1** | **Postgres pooler RTT × ~15 queries** | Live SELECT 1 p50 **328 ms**; EXPLAIN SQL **&lt;0.2 ms**; ~15 `/home` ops | **Largest** — toward &lt;500 ms DB wait if RTT ≤50 ms |
| **2** | **Middleware Supabase `getUser`** | Live **555–1033 ms**/request; landing TTFB **2570 ms** | **~0.5–1.0 s** per navigation |
| **3** | **Outlier Story/graph arms** | Mutual authors **4898 ms**, StoryTag **4600 ms**, recommendations **3651 ms** (hist) | **1–4 s** off slow Suspense arms |

---

## Live session findings (2026-07-31)

| Finding | Detail |
| --- | --- |
| Schema drift | `users.preferred_language` **missing** → all Main routes **HTTP 500** |
| Pooler | connect 2693 ms; SELECT 1 avg 335 ms |
| Auth dedupe | Still working (`duplicateAuth=no`, route getUser 0 ms) |
| Landing | FCP 2712 ms; almost all wait is TTFB |
| Dev assets | `main-app.js` 5.88 MB decoded / 1.31 MB transfer (dev only) |

Authenticated CWV and a fresh successful Prisma timeline **could not** be captured until schema is aligned. Historical `2afc354d` + Sprint 3 warm TTFB remain the best successful `/home` evidence.

---

## Deliverables

All under `docs/performance/performance-reset/`:

| Doc | Phase |
| --- | --- |
| `REQUEST_ARCHITECTURE.md` | 1 |
| `SERVER_TIMELINE.md` | 2 |
| `DATABASE_BREAKDOWN.md` | 3 |
| `REACT_PROFILE.md` | 4 |
| `BROWSER_PROFILE.md` | 5 |
| `NETWORK_PROFILE.md` | 6 |
| `ASSET_PROFILE.md` | 7 |
| `QUERY_TIMELINE.md` | 8 |
| `HISTORICAL_COMPARISON.md` | 9 |
| `ROOT_CAUSE_ANALYSIS.md` | 10 |
| `PERFORMANCE_BUDGET.md` | 11 |
| `OPTIMISATION_ROADMAP.md` | 12 |
| `PERFORMANCE_RESET_SUMMARY.md` | this |
| `artifacts/*` | raw JSON + RTT probe |

---

## Millisecond accounting (warm `/home`, model)

| Bucket | Approx |
| --- | --- |
| Middleware Auth | 500–800 ms |
| User session Prisma | 300–600 ms |
| Parallel Suspense DB arms | 1,500–4,000+ ms (max arm) |
| Render / stream / hydrate | 200–500 ms |
| **Observed warm TTFB** | **2,344 ms** (Sprint 3) |
| **Full ready (dev)** | often **higher** than TTFB |

Cold `next dev` compile adds **multi-second** noise — excluded from product budgets.

---

## What not to do next

- Another blind query-count / unified Story mega-loader sprint  
- Optimise indexes hoping SQL was slow  
- Treat `next dev` cold TTFB as production truth  

## What to do next

1. Fix schema drift (measurement unblocker)  
2. Re-baseline warm **production** `/home`  
3. Prioritise **RTT / region / local DB** and **auth middleware latency** over further loader merges  

This folder is the **single source of truth** for future performance work until superseded by a new measured reset.
