# Query Timeline

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31

---

## Capture status

| Capture | Result |
| --- | --- |
| Live 2026-07-31 authenticated `/home` | **FAILED** — P2022 `preferred_language` before dashboard queries |
| Historical 2026-07-26 `/home` `2afc354d` | **SUCCESS** — primary timeline below |
| Sprint 4 expected delta | Story.findMany 5→4; UserConnection 2→1 (static / unit verified; HTTP not re-proven) |

Instrumentation records model, operation, duration. SQL text and row counts remain **UNVERIFIED** without code changes (forbidden this sprint).

---

## Timeline — GET `/home` request `2afc354d` (200)

Source: `docs/performance/sprint-3-verification/ACTUAL_PRISMA_TRACE.md`  
Cold compile inflated wall clock; **relative order and per-query durations are RUNTIME VERIFIED**.

| # | Rel. | Model | Op | Caller (mapped) | Duration ms | Parallel group |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | T+0.7s | User | findUnique | `getCurrentUser` | 2,538 | Auth |
| 2 | T+0.7s | User | findUnique | layout/parallel auth | 6,639 | Auth |
| 3 | T+29s | AdminSettings | findUnique | admin settings / badges | 607 | G1 badges+context |
| 4 | T+29s | StoryTag | findMany | `getHomeStoryContext` A | 612 | G1 |
| 5 | T+29s | Message | count | layout badges | 596 | G1 |
| 6 | T+29s | Notification | count | unread | 604 | G1 |
| 7 | T+29s | Story | count | intro badge | 2,755 | G1 |
| 8 | T+29s | StoryTag | findMany | `getHomeStoryContext` B | 4,600 | G1 |
| 9 | T+30s | Story | findMany | trust recent sent | 682 | G2 trust |
| 10 | T+30s | Story | findMany | trust recent received | 687 | G2 trust |
| 11 | T+30s | SharedIntroducerRelationship | groupBy | suggestions | 693 | G2 secondary |
| 12 | T+30s | Story | findMany | visible / story bar | 624 | G2 feed |
| 13 | T+30s | Post | findMany | mutual feed | 624 | G2 feed |
| 14 | T+30s | Story | findMany | co-tag stories (**removed Sprint 4**) | 1,310 | G2 feed |
| 15 | T+30s | UserConnection | findFirst | materialization | 646 | G2 graph |
| 16 | T+30s | UserConnection | findMany | trust mutual sum | 677 | G2 graph |
| 17 | T+31s | UserConnection | findMany | recommendations | 3,651 | G2 secondary |
| 18 | T+31s | Story | findMany | mutual authors | 4,898 | G2 feed |

### Aggregates (`2afc354d`)

| Metric | Value |
| --- | --- |
| StoryTag.findMany | 2 |
| Story.findMany | **5** (pre–Sprint 4) |
| UserConnection.findMany | 2 |
| Approx Prisma ops | ~18 |
| middlewareGetUser | 795 ms |
| Auth prisma sum | 6,653 ms |
| duplicateAuth | no |
| HTTP TTFB / total | 43,395 / 52,696 ms |

---

## Expected post–Sprint 4 timeline (static)

Same as above with:

- **Omit** row #14 co-tag Story.findMany (projected from visible pool)
- Collapse UserConnection findMany paths toward **1** shared `getHomeUserConnections`
- Story.findMany count **4**

Not re-captured live this session.

---

## Live 2026-07-31 — failed `/home` `a96991ce`

| Timestamp | Event | Duration |
| --- | --- | --- |
| start | middleware getUserNetwork | 555 ms |
| +compile | `/[locale]/home` | 4,300 ms |
| auth | User.findUnique | **error P2022** |
| end | HTTP 500 | TTFB 13,519 ms |

No Story/recommendation queries executed.

---

## Parallel group legend

| Group | Members | Notes |
| --- | --- | --- |
| Auth | User finds | Must finish before Main children |
| G1 | StoryTags, badges, AdminSettings | Early after auth; StoryTag B can dominate |
| G2 | Trust stories, feed, graph, recommendations | Suspense-parallel; wall ≈ max(arm) |
