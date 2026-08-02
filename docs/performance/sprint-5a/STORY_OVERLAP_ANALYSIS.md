# Story Query Overlap Analysis

**Generated:** 2026-07-27  
**Scope:** GET `/home` — four remaining `Story.findMany` operations

---

## Query matrix

| ID | Caller | Primary filter | Status | Expires | Visibility | Select shape | Take |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Q1 | Trust sent | `userId=viewer` | published | — | — | Narrow | 5 |
| Q2 | Trust received | `tags→viewer` | published | — | — | Narrow | 5 |
| Q3 | Visible pool | viewer OR introducers | mixed/published | > now | Gate | Full+tags | ∞ |
| Q4 | Mutual authors | tag overlap | **any** | — | — | userId | distinct |

---

## Pairwise overlap

| Pair | Dataset overlap | Qa subset of Qb? | Same ordering? | Merge safe? |
| --- | --- | --- | --- | --- |
| Q1 ↔ Q2 | Low (~5 rows each, different predicates) | No | Both `createdAt desc` but independent top-5 | **No** — need 5+5 not 10 combined |
| Q1 ↔ Q3 | Partial — viewer published in pool | Q1 ⊂ potential pool rows | Yes for viewer subset | **Risky** — pool unbounded; Q1 needs exactly 5 published by viewer |
| Q2 ↔ Q3 | Partial — received stories may appear in pool if from introducer | Partial | Yes per row | **Risky** — pool filtered by expires+visibility; Q2 includes expired? No — Q2 published only, pool requires expires |
| Q3 ↔ Q4 | **Low** | No — Q4 includes non-expired, non-visible, any-status authors | No | **No** |
| Q1 ↔ Q4 | None | No | — | No |
| Q2 ↔ Q4 | Low | No | — | No |

---

## Sprint 4 co-tag overlap (resolved)

| Before | After |
| --- | --- |
| Feed co-tag `Story.findMany` overlapped ~90% with visible pool for co-tag authors | **Projection** from Q3 via `pickCoTagFeedStories` |
| **Evidence** | Same filters when co-tag ⊂ introducer authors |

---

## Percentage overlap estimates (typical demo user)

| Comparison | Est. overlap | Label |
| --- | --- | --- |
| Q3 rows ∩ Q1 rows | ~100% of Q1 (5 rows) | STATIC ANALYSIS |
| Q3 rows ∩ Q2 rows | 40–80% | HYPOTHESIS |
| Q4 author IDs ∩ Q3 author IDs | 30–60% | HYPOTHESIS |
| Q4 stories ∩ Q3 stories | Not applicable (Q4 is author IDs only) | — |

---

## Projection differences

| Consumer | Needs tags? | Needs category? | Needs media proxy? |
| --- | --- | --- | --- |
| Trust cards | No | No | No |
| Story bar | Yes | No | Yes (`withProxiedMedia`) |
| Feed co-tag | Yes | No | No (pre-proxy rows) |
| Mutual authors | No | No | No |

A unified fetch would require **full includes for all consumers** or multiple projection passes — increasing memory and CPU.

---

## Ordering conflicts

| Consumer | Sort key |
| --- | --- |
| Q1, Q2 | Global `createdAt desc`, take 5 |
| Q3 | Global `createdAt desc`, unbounded |
| Story bar groups | Per-author grouping, viewer first |
| Feed merge | Cross-type with Posts by `createdAt` |
| Q4 | N/A (distinct userIds) |

Single DB `orderBy` cannot produce story-bar group ordering without in-memory regroup (already done).

---

## Conclusion

**Only resolved overlap:** co-tag feed ⊂ visible pool (Sprint 4).  
**Remaining four queries serve structurally distinct predicates** — not subsets of one another.
