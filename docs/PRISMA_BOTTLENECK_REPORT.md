# Prisma Bottleneck Report

Generated: 2026-06-23T07:18:42.260Z

Dataset: 1000-user simulation · Warm sequential profiling per route

---

## Route profiles (warm median)

### message context

| Metric | Value |
| ------ | ----- |
| Path | `/api/messages/[userId]/context` |
| Warm runs | 0 |
| Median total | 569 ms |
| Median auth | 529 ms |
| Median Prisma | 84 ms |
| Query count | 0 |

**Top queries**

| Query | Count | Total ms | Avg ms |
| --- | --- | --- | --- |

**Issues:** Derived from baseline load test (warm sequential profiling unavailable)

### discoveries

| Metric | Value |
| ------ | ----- |
| Path | `/discoveries` |
| Warm runs | 0 |
| Median total | 576 ms |
| Median auth | 531 ms |
| Median Prisma | 0 ms |
| Query count | 0 |

**Top queries**

| Query | Count | Total ms | Avg ms |
| --- | --- | --- | --- |

**Issues:** Derived from baseline load test (warm sequential profiling unavailable)

### home feed

| Metric | Value |
| ------ | ----- |
| Path | `/home` |
| Warm runs | 0 |
| Median total | 565 ms |
| Median auth | 529 ms |
| Median Prisma | 0 ms |
| Query count | 0 |

**Top queries**

| Query | Count | Total ms | Avg ms |
| --- | --- | --- | --- |

**Issues:** Derived from baseline load test (warm sequential profiling unavailable)

### profile

| Metric | Value |
| ------ | ----- |
| Path | `/profile` |
| Warm runs | 0 |
| Median total | 578 ms |
| Median auth | 540 ms |
| Median Prisma | 0 ms |
| Query count | 0 |

**Top queries**

| Query | Count | Total ms | Avg ms |
| --- | --- | --- | --- |

**Issues:** Derived from baseline load test (warm sequential profiling unavailable)


---

## Cross-route findings

| Pattern | Impact | Recommendation |
| ------- | ------ | -------------- |
| Middleware auth ~250ms every request | Dominates TTFB | JWT local verify or session cache (P0) |
| Message context graph queries | Highest Prisma ms under load | Keep materialized `user_connections` path; avoid StoryTag scans |
| Discoveries trust enrichment | N parallel trust lookups | Batch `getTrustProfilesBulk` into single query |
| Category visibility | Per-post queries | Precompute viewer category edges |
| Introduction suggestions | O(n²) shared counts | Batch count query |

---

## Static audit findings

- services/trust-profile.ts — N parallel getTrustProfile per discoveries author
- lib/category-visibility.ts — per-post category visibility queries
- services/introduction-suggestions.ts — O(n²) shared introducer counts
- services/messages.ts — unbounded conversation history load
- lib/introduction-graph.ts — full StoryTag scan on graph rebuild (mitigated by user_connections fast path)

---

## Index recommendations

1. `user_connections(source_user_id, target_user_id)` — graph / trust hot path
2. `messages(sender_id, receiver_id, created_at DESC)` — inbox + context
3. `discoveries(author_id, created_at DESC)` — feed pagination
4. `story_tags(story_id, user_id)` — introduction graph (prefer materialized edges)
5. Partial index on `users(email)` where simulation flag if used in bulk auth pool

*Raw: `docs/.load-investigation-results.json` → `prisma`*
