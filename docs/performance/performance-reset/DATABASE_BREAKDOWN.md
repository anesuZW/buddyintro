# Database Breakdown

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31

---

## Live pooler probe (2026-07-31)

Artifact: `artifacts/pooler-rtt.json`

| Metric | Value |
| --- | --- |
| Connect | **2,693 ms** |
| SELECT 1 samples | 348, 311, 328, 354, 302, 416, 289 |
| min / avg / p50 / p95 / max | 289 / **335** / **328** / **416** / 416 |
| Host | `aws-1-us-east-1.pooler.supabase.com:5432` |
| `users.preferred_language` column | **false** (schema drift) |

**Interpretation:** A no-op round-trip costs ~300–420 ms from this workstation. That floor appears on nearly every Prisma call.

---

## SQL execution vs network wait

From Sprint 1 EXPLAIN ANALYZE (`.profile-data.json`):

| Query | Prisma wall (avg) | EXPLAIN execution | Network share |
| --- | --- | --- | --- |
| SELECT 1 | 455 ms | n/a | ~100% |
| AdminSettings.findUnique | 455 ms | **0.066 ms** | ~100% |
| User.findUnique | 469 ms | **0.052 ms** | ~100% |
| Story.findMany take 20 | 439 ms | **0.178 ms** | ~100% |
| StoryTag.findMany | 485 ms | **0.049 ms** | ~100% |
| DiscoveriesPost.findMany | 510 ms | **0.047 ms** | ~100% |

**Verdict (proven):** SQL engine time is **sub-millisecond to low milliseconds**. Observed Prisma durations are **Supabase pooler RTT + wait**, not query plan cost.

Prisma client overhead was previously measured as **negligible** vs RTT (Sprint 1).

---

## `/home` query inventory (post Sprint 4 static + Sprint 3 runtime)

| Model.Operation | Count (S4 est.) | Role |
| --- | --- | --- |
| StoryTag.findMany | 2 | Home story context |
| Story.findMany | **4** | Trust recent×2, visible pool, mutual authors |
| Story.count | 1 | Layout intro badge |
| UserConnection.findMany | 1 | Graph |
| UserConnection.findFirst | 1 | Materialization probe |
| SharedIntroducerRelationship.groupBy | 1 | Suggestions |
| Post.findMany | 1 | Mutual feed |
| Notification.count | 1 | Badges |
| Message.count | 1 | Badges |
| AdminSettings.findUnique | 1 | Expiry / settings |
| User.findUnique | 1 | Auth (cached) |
| **Total Prisma** | **~15** | Down from 25 pre-Sprint 3 |

---

## Aggregate timing model (warm, p50 RTT = 335 ms)

| Mode | Formula | Estimate |
| --- | --- | --- |
| Fully sequential 15 queries | 15 × 335 | **~5,025 ms** DB wall |
| Ideal infinite parallelism | max(single query) | **~400–5,000 ms** (depends on slowest) |
| Observed reality | Suspense groups + dependencies | Warm TTFB **2.3 s**; full readiness often longer |

Historical slow queries on successful `/home` (`2afc354d`):

| Query | Duration | Class |
| --- | --- | --- |
| Story.findMany mutual authors | **4,898 ms** | Outlier (>> RTT floor) — payload/plan/contention |
| StoryTag.findMany (scan B) | **4,600 ms** | Outlier |
| UserConnection.findMany recommendations | **3,651 ms** | Outlier |
| Story.count badges | **2,755 ms** | Outlier |
| Typical findMany | 600–700 ms | ~2× RTT floor (includes include/joins) |

**Outliers > 2× RTT** warrant separate investigation (row volume, sequential scans under load, pooler queuing) — still not “slow SQL” in EXPLAIN on warm small datasets.

---

## Parallel vs sequential groups (`/home`)

**Sequential dependencies**

1. Middleware Auth → trusted headers  
2. `requireUser` User.findUnique  
3. `getHomeRequestBundle` StoryTag context **before** consumers that need tag IDs  
4. Visible story pool **before** story-bar / co-tag projection (Sprint 4)

**Parallel groups (Suspense / Promise.all)**

- Layout badges || page branches
- Within bundle: connections || visible stories (after/with tags)
- Stats recent Story×2 || Secondary recommendations || Feed Post + mutual Story

---

## Time waiting for Supabase vs executing SQL

| Bucket | Share of Prisma duration | Confidence |
| --- | --- | --- |
| Network / pooler wait | **≥95%** typical query | High (EXPLAIN vs wall) |
| SQL execution | **&lt;1%** typical | High |
| Prisma serialize / JS | Small | Medium (Sprint 1) |
| Pooler queue / cold connect | Spikes (connect 2.7 s live) | High |

---

## Live session limitation

`profile:database` aborted: Prisma Client selects `preferred_language` which is absent remotely. Fresh EXPLAIN suite **not re-run** this session; Sprint 1 plans remain valid for relative SQL cost. Live SELECT 1 RTT **re-confirmed**.
