# Prioritized Optimization Plan

**Generated:** 2026-07-26T06:37:26.870Z  
**⚠️ READ-ONLY SPRINT — Nothing implemented**

---

## Priority 1 — Infrastructure (Biggest gain)

| Action | Expected gain | Effort |
|--------|---------------|--------|
| Use regional pooler / reduce RTT | 70–90% page DB time | Ops |
| Set `connection_limit` + monitor pool saturation | Fewer 3s spikes | Config |
| Separate DIRECT_URL to non-pooler for migrations/EXPLAIN | Accurate DBA tooling | Config |

---

## Priority 2 — Query count reduction

| Action | Expected gain | Effort |
|--------|---------------|--------|
| Consolidate home StoryTag scans into 1–2 queries | −4 RTT on /home | Medium |
| Paginate messages inbox | Prevents unbounded growth | Medium |
| Pass `settingsOverride` everywhere AdminSettings needed | −0 RTT (already cached) | Low |
| Batch discovery trust enrichment (already bulk — verify OR clause size) | Stable at scale | Low |

---

## Priority 3 — Caching (Recommendations Only)

| Target | Mechanism | Status | Priority |
| --- | --- | --- | --- |
| getAdminSettings | React cache() | already cached | done |
| getCurrentUser | React cache() | already cached | done |
| getLayoutBadges | React cache(userId) | already cached | done |
| getHomeStoryContext | React cache(userId) | already cached | done |
| getDiscoveriesNetworkAuthorIds | React cache(viewerId) | recommend | high |
| listBlockedUserIds | React cache(viewerId) | recommend | medium |
| getTrustProfilesBulk | unstable_cache 60s per viewer+authorSet hash | recommend | medium |
| Introduction graph edges | unstable_cache + background refresh | recommend | high |
| NotificationPreferences | React cache(userId) | recommend | low |
| AnalyticsEvent.create | async queue (not blocking SSR) | recommend | high |

---

## Estimated Impact (No Changes Made)

| Scenario | Home est. Prisma time |
|----------|----------------------|
| Current (18 queries × 455ms) | ~8190ms |
| Fix pooler only (50ms RTT) | ~900ms |
| Halve query count | ~4095ms |
| Both | ~700ms |

---

## Analytics

Move AnalyticsEvent.create to fire-and-forget queue; keep insights on profile async

Blocking paths: [{"path":"/profile","call":"analyticsService.queryUserInsights","blocking":true},{"path":"POST /api/analytics","call":"AnalyticsEvent.create","blocking":"sync write"}]
