# Engineering Priority Matrix

**Sprint:** Performance Optimization Planning (READ-ONLY)  
**Generated:** 2026-07-26

---

## Scoring Legend

| Impact | Definition |
|--------|------------|
| **Very High** | >60% page DB time reduction OR prevents production outage at scale |
| **High** | 25–60% page DB time OR >2 queries saved on hot path |
| **Medium** | 10–25% OR 1 query saved |
| **Low** | <10% OR cosmetic |

| Effort | Definition |
|--------|------------|
| **Small** | ≤2 days, 1–2 files |
| **Medium** | 3–7 days, cross-service |
| **Large** | >1 week, architectural |

---

## P0 — Must Fix Immediately

| ID | Item | Effort | Impact | Queries saved | Latency | Rationale |
|----|------|--------|--------|---------------|---------|-----------|
| P0-1 | **Supabase connection config** — separate DIRECT_URL, add `pgbouncer=true`, `connection_limit`, same-region deploy | Medium | **Very High** | 0 | **−91% RTT** | 95% of slowness; no app change helps without this |
| P0-2 | **Measurement harness locked** — production build + PROFILE headers + automated before/after | Small | **Very High** | 0 | Enables proof | Without metrics, optimizations unverifiable |
| P0-3 | **Consolidate home StoryTag queries** — 4→1 in `getHomeStoryContext` | Medium | **Very High** | **4–5** | **−2.3s** @455ms | Highest query duplication in codebase |

---

## P1 — Large Gains

| ID | Item | Effort | Impact | Queries saved | Latency | Rationale |
|----|------|--------|--------|---------------|---------|-----------|
| P1-1 | **Consolidate home Story.findMany** — trust stats + feed overlap | Medium | **High** | **2–3** | **−1.4s** | Second hotspot on /home |
| P1-2 | **Cache discoveries network + blocks** — React cache on network IDs | Small | **High** | **2** | **−910ms** | discoveries page pipeline |
| P1-3 | **Defer AnalyticsEvent.create on SSR** — story viewer + fire-and-forget | Small | **High** | **1–2** | **−455–910ms** | Blocking writes on read path |
| P1-4 | **Auth header trust path** — eliminate Supabase getUser fallback | Small | **High** | 0 | **−450–700ms** | Auth 662–2303ms observed |
| P1-5 | **Shared viewer network context** — dedupe UserConnection.findMany | Medium | **High** | **1–2** | **−455–910ms** | discoveries + recommendations |
| P1-6 | **Pass homeStoryContext to trust stats** — avoid duplicate StoryTag in getTrustNetworkStats | Small | **High** | **2** | **−910ms** | Overlap documented in QUERY_TRACE |

---

## P2 — Medium Gains

| ID | Item | Effort | Impact | Queries saved | Latency | Rationale |
|----|------|--------|--------|---------------|---------|-----------|
| P2-1 | **Profile insights async** — Suspense client fetch for analytics | Medium | **Medium** | **2–4** | **−910–1820ms** | Profile page blocking aggregations |
| P2-2 | **NotificationPreferences React cache** | Small | **Medium** | **0–1** | **−455ms** | Profile settings panels |
| P2-3 | **Trust enrichment unstable_cache 60s** | Medium | **Medium** | 0* | **−455ms** repeat views | *Same query count; saves repeat RTT on scroll |
| P2-4 | **getTrustProfilesBulk OR → JOIN rewrite** | Medium | **Medium** | 0 | Scale stability | OR explosion at author count >20 |
| P2-5 | **Introduction suggestions bulk shared counts** — verify batch path always used | Small | **Medium** | **0–400** worst case | Prevents regression |
| P2-6 | **Select projection audit** — trim storyInclude fields on list paths | Medium | **Medium** | 0 | **−serialize** | Less data over pooler |

---

## P3 — Nice to Have

| ID | Item | Effort | Impact | Queries saved | Latency | Rationale |
|----|------|--------|--------|---------------|---------|-----------|
| P3-1 | **Index: story_tags(tagged_user_id, story_id)** | Small | **Low** now | 0 | **−0.05ms SQL** | Seq scan at 71 rows; matters at 100k+ |
| P3-2 | **Index: stories(status, created_at)** | Small | **Low** now | 0 | **−0.1ms SQL** | Future scale |
| P3-3 | **Remove unused indexes** (20 at idx_scan=0) | Small | **Low** | 0 | Write amp | Housekeeping |
| P3-4 | **Migrate categories cache to unstable_cache** | Small | **Low** | 0 | Multi-instance | Module cache breaks on PM2 cluster |
| P3-5 | **Badge/inbox count unification** | Medium | **Low** | **1** | **−455ms** | Minor duplication |

---

## Matrix View

```
Impact ↑
Very High │ P0-1  P0-3          P1-1  P1-3
          │ P0-2                P1-2  P1-4
High      │                     P1-5  P1-6
          │
Medium    │           P2-1  P2-3  P2-4
          │           P2-2  P2-5  P2-6
Low       │ P3-1  P3-2  P3-3  P3-4  P3-5
          └────────────────────────────────→ Effort
            Small    Medium         Large
```

---

## Risk vs Reward

| Item | Reward | Risk if deferred |
|------|--------|------------------|
| P0-1 Pooler | −91% RTT | Every other optimization masked / wasted |
| P0-3 StoryTag | −4 queries/home | Home remains unusable on localhost |
| P1-3 Analytics defer | −2 RTT viewer | SSR blocked on write latency spikes |
| P2-3 unstable_cache | Repeat view speed | Stale trust data if invalidation wrong — tag **MEDIUM** |

---

## Out of Scope for Priority Matrix

- UI redesign
- Feed algorithm changes
- Feature removal
- Business rule changes
