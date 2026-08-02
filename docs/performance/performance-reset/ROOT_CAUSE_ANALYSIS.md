# Root Cause Analysis

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31

---

## Executive finding

BuddyIntro feels slow primarily because **every authenticated request pays hundreds of milliseconds of network wait to Supabase (Auth + Postgres pooler in us-east-1), multiplied across ~10–15 necessary Prisma round-trips**, even after sprints removed duplicates. SQL execution and Prisma overhead are **not** the problem. Further Story-loader consolidation has **diminishing returns** (Sprint 5A).

A separate **current outage mode** (schema drift) makes the app fail with 500s — that is correctness/infra alignment, not a latency optimization.

---

## Ranked bottlenecks

| Rank | Bottleneck | Abs. time (typical warm) | % of slow feel | Likelihood | Confidence |
| --- | --- | --- | --- | --- | --- |
| **1** | **Supabase Postgres pooler RTT** (~300–450 ms/query × ~15 queries; wall ~2–5 s with parallelism) | 2–5+ s | **45–60%** | Certain | **High** |
| **2** | **Supabase Auth `getUser` in middleware** | 0.5–1.0 s / navigation | **15–25%** | Certain | **High** |
| **3** | **Critical-path / outlier queries** (mutual-author Story, heavy StoryTag, recommendations UserConnection — hist 3.6–4.9 s) | 1–5 s on slow arm | **15–25%** | High when present | **Medium–High** |
| 4 | Blocking SSR on `/discoveries` & `/profile` (no page Suspense) | +0.5–2 s to first content | 5–10% | High | Medium |
| 5 | Dev cold compile (`next dev`) | 1–6+ s first hit | Session-dependent | Certain in dev | High |
| 6 | Client bundles / hydration (esp. discoveries, StoryUploader) | 0.1–0.5 s prod; more in dev | 5% | Medium | Medium |
| 7 | React render CPU | &lt;200 ms typical after data | &lt;5% | Low as primary | Medium |
| 8 | Schema drift 500s (live now) | Hard failure | Blocks measurement | Certain live | **High** |

---

## TOP 3 (for future work)

### 1. Pooler RTT × remaining queries

- **Evidence:** Live SELECT 1 p50 **328 ms**; EXPLAIN SQL **&lt;0.2 ms**; `/home` still ~15 Prisma ops.
- **Projected impact if fixed:** Moving DB near app or cutting effective RTT to ~40–50 ms → warm `/home` DB wall from ~seconds to **&lt;1 s** (Sprint targets assumed this).
- **Why sprints weren’t enough:** Removing 10 queries saved ~3 s (observed 6.1→2.3 s TTFB) but **15 × 335 ms** remains large.

### 2. Middleware Auth network

- **Evidence:** Live middleware getUser **555–1033 ms** even when route auth is deduped.
- **Projected impact:** Caching/session strategies or edge-local auth validation could reclaim **~0.5–1.0 s per navigation** (design must preserve security — not implemented here).
- **Note:** Landing `/` also pays this (TTFB 2.57 s).

### 3. Slow critical-path Story/graph arms

- **Evidence:** Mutual authors Story **4,898 ms**; StoryTag B **4,600 ms**; recommendations connection **3,651 ms** on `2afc354d`.
- **Projected impact:** Bringing outliers to RTT floor (~350–700 ms) could cut **perceived feed/recommendations readiness by 1–4 s** without reducing query count.
- **Sprint 5A:** Merging all Story queries is **not** the fix; targeting outliers + parallelism visibility is.

---

## Rejected primary causes

| Hypothesis | Verdict |
| --- | --- |
| Slow SQL / missing indexes as main cost | **Rejected** — EXPLAIN &lt;1 ms |
| Prisma ORM tax | **Rejected** — Sprint 1 negligible |
| Missing unified Story mega-loader | **Rejected** — Sprint 5A Option B |
| Huge production JS as main `/home` issue | **Rejected** — FLJS ~110 KB; TTFB dominates |
| Duplicate auth still present | **Rejected** — `duplicateAuth=no` live + hist |

---

## Percentage contribution sketch (warm `/home` ~2.3–9 s experience)

```
Pooler wait on business queries ████████████████████░░░░  ~50%
Auth middleware RTT             ████████░░░░░░░░░░░░░░░░  ~20%
Outlier query inflation         ██████░░░░░░░░░░░░░░░░░░  ~15%
Streaming/SSR gaps + serialize  ███░░░░░░░░░░░░░░░░░░░░░  ~10%
Assets / hydrate                ██░░░░░░░░░░░░░░░░░░░░░░  ~5%
```

Exact % varies by cold/warm and whether outlier queries spike.
