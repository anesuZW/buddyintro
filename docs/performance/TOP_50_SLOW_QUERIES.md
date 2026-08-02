# Top 50 Slowest Queries

**Generated:** 2026-07-26T06:37:26.870Z  
**Source:** Isolated Prisma benchmarks (×2 runs each)

---

| Rank | Query | Avg (ms) | P95 (ms) | Prisma key |
| --- | --- | --- | --- | --- |
| 1 | Message.count (unread inbox) | 499 | 716 | Message.count |
| 2 | DiscoveriesPost.findMany (network feed) | 510 | 713 | DiscoveriesPost.findMany |
| 3 | StoryTag.findMany (tagged user) | 485 | 658 | StoryTag.findMany |
| 4 | UserConnection.findMany (1st degree) | 528 | 649 | UserConnection.findMany |
| 5 | Notification.count (unread) | 476 | 643 | Notification.count |
| 6 | AnalyticsEvent.count (24h) | 459 | 641 | AnalyticsEvent.count |
| 7 | User.findUnique | 469 | 625 | User.findUnique |
| 8 | AdminSettings.findUnique | 455 | 615 | AdminSettings.findUnique |
| 9 | SharedIntroducerRelationship.findMany | 447 | 614 | SharedIntroducerRelationship.findMany |
| 10 | Story.count | 459 | 610 | Story.count |
| 11 | SELECT 1 | 455 | 603 | raw.queryRaw |
| 12 | Story.findMany (published, take 20) | 439 | 592 | Story.findMany |

---

## User-Reported Slow Logs (Reference)

| Query | Reported ms | Source |
| --- | --- | --- |
| Story.findMany | 3328 | user observation / [prisma:slow] |
| StoryTag.findMany | 4341 | user observation |
| User.findUnique | 2567 | user observation |
| DiscoveriesPost.findMany | 2450 | user observation |
| SharedIntroducerRelationship.findMany | 2956 | user observation |
| AdminSettings.findUnique | 2768 | user observation |
| Notification.count | 1140 | user observation |
| Message.count | 953 | user observation |

---

## Interpretation

Rankings reflect **pooler RTT** first. True SQL outliers would show high EXPLAIN execution time — see [EXECUTION_PLAN_SUMMARY.md](./EXECUTION_PLAN_SUMMARY.md).
