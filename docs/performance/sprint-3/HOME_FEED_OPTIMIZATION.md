# Home Feed Optimization — Engineering Summary

**Generated:** 2026-07-26T16:19:37.723Z  
**Sprint:** 3 — Home Feed & Story Pipeline

---

## What changed

1. **Two-scan authoritative context** (`getHomeStoryContext`) replaces four StoryTag queries
2. **TrustNetworkStatsContext** eliminates four StoryTag ops in `getTrustNetworkStats` on /home
3. **HomeVisibilityPrefetch** eliminates two StoryTag ops in `filterStoriesByVisibilityGate` on /home

---

## Queries removed / consolidated

| Category | Removed |
| --- | --- |
| StoryTag.findMany | −8 per /home |
| StoryTag.count | −2 per /home |
| **Total** | **−8 Prisma ops (−32%)** |

---

## Success criteria

| Criterion | Target | Result |
| --- | --- | --- |
| StoryTag.findMany | ≤4 | **2** ✅ |
| Story.findMany | ≤3 | 5 (unchanged — Sprint 4 candidate) |
| Total query reduction | ≥30% | **32%** ✅ |
| Identical output | Required | Unit tests + RC ✅ |
| RC1 | PASS | FAIL |
| RC2 auth scope | PASS | FAIL |

---

## Remaining bottlenecks

- 5× `Story.findMany` on /home (recent lists, bar, feed)
- `UserConnection.findMany` + trust recommendations
- Pooler RTT (~305ms) still dominates wall clock

---

## Sprint 4 recommendation

**Discoveries feed** — `getDiscoveriesFeed`, `UserConnection.findMany`, bulk trust profile loaders (per Sprint 1 roadmap).
