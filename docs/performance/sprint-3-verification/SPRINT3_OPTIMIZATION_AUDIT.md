# Sprint 3 Optimization Audit

**Generated:** 2026-07-26T18:05:00.000Z

---

## Optimization 1 — Consolidated home StoryTag scans

| Field | Detail |
| --- | --- |
| **File** | `services/home-dashboard.ts`, `lib/home-story-context.ts` |
| **Function** | `getHomeStoryContext`, `buildHomeStoryContextFromRows` |
| **Original** | 4× parallel `StoryTag.findMany` (feed ids, co-tag ids, 2× suggestion rows with `take:20`) |
| **Current** | 2× `StoryTag.findMany` (full authored scan + full tagged scan) → in-memory derivation |
| **Purpose** | Single authoritative tag scan per request; dedupe downstream duplicate queries |
| **Expected improvement** | StoryTag.findMany 10 → 2 on `/home`; −8 round trips |
| **Measured improvement** | **RUNTIME VERIFIED:** 2× StoryTag.findMany on request `2afc354d` (612ms + 4,600ms) |
| **Status** | ✅ Functioning |
| **Evidence** | Git diff, ACTUAL_PRISMA_TRACE.md, server log |

---

## Optimization 2 — Trust stats context bypass

| Field | Detail |
| --- | --- |
| **File** | `services/trust-network.ts`, `services/home-dashboard.ts` |
| **Function** | `getTrustNetworkStats(userId, statsCtx?)` |
| **Original** | 2× `StoryTag.count` + 2× `StoryTag.findMany` (distinct) on every home stats load |
| **Current** | When `statsCtx` passed: use precomputed counts/ids; 0 StoryTag ops |
| **Purpose** | Eliminate redundant tag aggregates already computed in home context |
| **Expected improvement** | −4 StoryTag ops on `/home` |
| **Measured improvement** | **RUNTIME VERIFIED:** 0× StoryTag.count in trace; trust stats load uses 2× Story.findMany only |
| **Status** | ✅ Functioning |
| **Evidence** | Git diff, ACTUAL_PRISMA_TRACE.md, unit tests |

---

## Optimization 3 — Visibility prefetch bypass

| Field | Detail |
| --- | --- |
| **File** | `lib/story-visibility.ts`, `services/stories.ts` |
| **Function** | `filterStoriesByVisibilityGate(..., prefetch?)`, `getStoryBarForViewer` |
| **Original** | 2× `StoryTag.findMany` per visibility filter (co-tag + ever-introduced) |
| **Current** | Reuse `HomeVisibilityPrefetch` sets from home context |
| **Purpose** | Remove duplicate co-tag/ever-introduced scans on story bar path |
| **Expected improvement** | −2 StoryTag.findMany on `/home` |
| **Measured improvement** | **RUNTIME VERIFIED:** No StoryTag ops between story bar Story.findMany and feed queries |
| **Status** | ✅ Functioning |
| **Evidence** | Git diff, call graph, runtime trace |

---

## Optimization 4 — React request cache on home context

| Field | Detail |
| --- | --- |
| **File** | `services/home-dashboard.ts` |
| **Function** | `getHomeStoryContext` wrapped in `cache()` |
| **Original** | Context rebuilt per Suspense branch (3× potential) |
| **Current** | Single execution shared across stats, secondary, feed loaders |
| **Purpose** | Dedupe 2-scan context across parallel Suspense boundaries |
| **Expected improvement** | 2 scans instead of 6 (3 branches × 2) |
| **Measured improvement** | **RUNTIME VERIFIED:** Exactly 2 StoryTag.findMany total per request |
| **Status** | ✅ Functioning |
| **Evidence** | Runtime trace, Sprint 2 accepted React cache behaviour |

---

## Optimization 5 — Feed context passthrough (unchanged wiring, consolidated source)

| Field | Detail |
| --- | --- |
| **File** | `services/feed.ts`, `services/home-dashboard.ts` |
| **Function** | `getMutualTagFeed(viewerId, limit, ctx?)` |
| **Original** | Without ctx: +2 StoryTag.findMany inside feed loader |
| **Current** | `feedCtx` from home context; feed skips tag scans |
| **Purpose** | Avoid re-fetching tag ids already in consolidated scan |
| **Expected improvement** | −2 StoryTag.findMany on `/home` when ctx passed |
| **Measured improvement** | **RUNTIME VERIFIED:** No additional StoryTag ops in feed segment |
| **Status** | ✅ Functioning |
| **Evidence** | Git diff, runtime trace |

---

## Out of scope (not Sprint 3 optimizations)

| Change | File | Note |
| --- | --- | --- |
| Email delivery refactor | `services/stories.ts` | Unrelated to home pipeline |
| Story.findMany consolidation | — | Deferred Sprint 4 (still 5 on `/home`) |

---

## Total query impact

| Metric | Sprint 2 baseline | Sprint 3 (static) | Sprint 3 (runtime) |
| --- | --- | --- | --- |
| StoryTag.findMany | 10 | 2 | **2** ✅ |
| StoryTag.count | 2 | 0 | **0** ✅ |
| Total Prisma (est.) | 25 | 17 | **~16–18** ✅ |
| Reduction | — | 32% | **~28–36%** ✅ |

**Evidence:** `docs/performance/sprint-3/artifacts/baseline-static.json`, ACTUAL_PRISMA_TRACE.md
