# Performance Budget

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31  
**Target environment:** Warm production build, DB RTT ≤50 ms (co-located or local), authenticated median user.

---

## Ideal `/home` budget

| Stage | Budget | Current evidence (pooler workstation) |
| --- | --- | --- |
| Middleware (incl. Auth) | **&lt;50 ms** | 500–1,000 ms |
| Authentication User row | **&lt;200 ms** | ~300–600 ms typical; spikes higher |
| Database wait (all Prisma) | **&lt;500 ms** | ~2–5+ s wall |
| Business logic (CPU) | **&lt;150 ms** | Not primary today |
| React RSC render | **&lt;200 ms** | Secondary |
| Streaming overhead | **&lt;50 ms** | Unknown precisely |
| Hydration | **&lt;300 ms** | Landing ~200 ms after TTFB |
| **Total Home interactive** | **&lt;1.5 s** | Warm TTFB 2.3 s; full ready often higher |

---

## Route budgets

| Route | TTFB | Time-to-meaningful-content | Notes |
| --- | --- | --- | --- |
| `/` | &lt;200 ms | &lt;500 ms | Should not pay full remote getUser if avoidable |
| `/home` | &lt;800 ms | &lt;1.5 s | Streamed panels OK if shell &lt;800 ms |
| `/discoveries` | &lt;800 ms | &lt;1.8 s | Prefer Suspense split |
| `/messages` | &lt;400 ms shell | &lt;1.0 s inbox | API budget separate |
| `/profile` | &lt;800 ms | &lt;1.5 s | |

---

## Database budgets

| Metric | Budget |
| --- | --- |
| Pooler/DB RTT p50 | **≤50 ms** |
| Pooler/DB RTT p95 | **≤100 ms** |
| SQL execution per query | ≤5 ms |
| Prisma queries `/home` | ≤15 (already ~15) — prefer latency over further cuts |
| Any single query wall | ≤200 ms |

---

## Asset budgets (production)

| Asset | Budget |
| --- | --- |
| `/home` First Load JS | ≤150 KB |
| `/discoveries` First Load JS | ≤200 KB |
| Fonts total | ≤100 KB |
| LCP image (if any) | ≤200 KB |

---

## Gate rules for future sprints

1. No optimization without before/after measurement on **warm production** or warm prod-like build.
2. Query-count reductions that do not improve TTFB/time-to-content by **≥200 ms** are **not** success.
3. Schema must match Prisma Client before any authenticated benchmark is accepted.
4. Cold `next dev` compiles are **out of budget** — label separately.
