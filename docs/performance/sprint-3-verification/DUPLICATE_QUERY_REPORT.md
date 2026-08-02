# Duplicate Query Report — GET /home

**Generated:** 2026-07-26T18:05:00.000Z  
**Evidence:** RUNTIME VERIFIED (request `2afc354d`) + STATIC ANALYSIS

---

## StoryTag.findMany

| Duplicate? | Count | Evidence |
| --- | --- | --- |
| **No** | 2 (scan A + scan B) | Each distinct purpose; React `cache()` prevents re-execution |

No remaining duplicate StoryTag queries on `/home`. Sprint 3 target achieved.

---

## StoryTag.count

| Duplicate? | Count |
| --- | --- |
| **No** | 0 |

Eliminated from trust stats path.

---

## Story.findMany

| # | Duration | Caller | Exec count | Necessary? |
| --- | --- | --- | --- | --- |
| 1 | 682ms | `getTrustNetworkStats` recentSent | 1 | Yes — trust cards |
| 2 | 687ms | `getTrustNetworkStats` recentReceived | 1 | Yes — trust cards |
| 3 | 624ms | `getVisibleStories` / story bar | 1 | Yes — story bar pool |
| 4 | 1,310ms | `getMutualTagFeed` co-tag stories | 1 | Yes — feed content |
| 5 | 4,898ms | `getMutualTagFeed` mutual authors | 1 | Yes — feed discovery |

**Duplication:** None — five **distinct** queries. Consolidation deferred to Sprint 4.

---

## Story.count

| Caller | Count | Necessary? |
| --- | --- | --- |
| `getLayoutBadges` | 1 | Yes — intro badge |

No duplicate.

---

## UserConnection.findMany

| Caller | Duration | Count | Necessary? |
| --- | --- | --- | --- |
| `getTrustNetworkStats` | 677ms | 1 | Yes — mutual connection sum |
| `computeTrustRecommendations` | 3,651ms | 1 | Yes — recommendation cards |

**Duplication:** Same model, different data needs — **necessary** unless unified loader (future sprint).

---

## UserConnection.findFirst

| Caller | Count | Reason |
| --- | --- | --- |
| `isUserConnectionsMaterialized` | 1 | Graph materialization probe |

Not a duplicate of findMany.

---

## SharedIntroducerRelationship

| Operation | Caller | Count |
| --- | --- | --- |
| groupBy | `getIntroductionSuggestions` | 1 |

No findMany duplicate on home.

---

## Post.findMany

| Caller | Count | Necessary? |
| --- | --- | --- |
| `getMutualTagFeed` | 1 | Yes |

---

## Notification.count / Message.count

| Operation | Caller | Count | Sprint 2 dedupe |
| --- | --- | --- | --- |
| Notification.count | layout badges | 1 | Cached ✅ |
| Message.count | layout badges | 1 | Cached ✅ |

No duplicates within request.

---

## User.findUnique (auth path)

| Count | Duration | Reason |
| --- | --- | --- |
| 2 | 2,538ms + 6,639ms | Parallel layout + page auth segments |

**Note:** Supabase `getUser` deduped (`getUserCalls=1`). Two Prisma user lookups remain — pre-existing, not Sprint 3 scope.

---

## Eliminated duplicates (Sprint 3)

| Previously duplicated | Now |
| --- | --- |
| 4× getHomeStoryContext StoryTag | 2× (cached) |
| 2× visibility StoryTag | 0 (prefetch) |
| 4× trust StoryTag | 0 (statsCtx) |
| 2× feed StoryTag (without ctx) | 0 (ctx passed) |
