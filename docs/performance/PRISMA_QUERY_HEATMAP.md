# Prisma Query Heatmap

**Generated:** 2026-07-26T06:37:26.870Z  
**Scale:** P95 latency (isolated benchmark, 2 runs)

---

## P95 Heatmap (ASCII)

```
SELECT 1                                   ██████████████████████████████████░░░░░░ 603ms p95
AdminSettings.findUnique                   ██████████████████████████████████░░░░░░ 615ms p95
User.findUnique                            ███████████████████████████████████░░░░░ 625ms p95
Story.count                                ██████████████████████████████████░░░░░░ 610ms p95
Story.findMany (published, take 20)        █████████████████████████████████░░░░░░░ 592ms p95
StoryTag.findMany (tagged user)            █████████████████████████████████████░░░ 658ms p95
DiscoveriesPost.findMany (network feed)    ████████████████████████████████████████ 713ms p95
SharedIntroducerRelationship.findMany      ██████████████████████████████████░░░░░░ 614ms p95
Notification.count (unread)                ████████████████████████████████████░░░░ 643ms p95
Message.count (unread inbox)               ████████████████████████████████████████ 716ms p95
AnalyticsEvent.count (24h)                 ████████████████████████████████████░░░░ 641ms p95
UserConnection.findMany (1st degree)       ████████████████████████████████████░░░░ 649ms p95
```

---

## By Page (Estimated Query Density)

| Page | Query heat | Primary models |
|------|------------|----------------|
| /home | ████████████ HIGH | StoryTag, Story, UserConnection, Notification, Message |
| /discoveries | ██████████ HIGH | DiscoveriesPost, SharedIntroducerRelationship, UserConnection |
| /profile | ████████ MED-HIGH | AnalyticsEvent, UserConnection, StoryTag |
| /messages | ██████ MED | Message, User |
| /create-story | ███ LOW | AdminSettings, Story |

---

## Repeated Operations Heat

| Operation | Pages affected | Severity |
|-----------|----------------|----------|
| AdminSettings.findUnique | All authenticated | Low (cached) |
| User.findUnique | All authenticated | Low (cached) |
| StoryTag.findMany | /home, /profile | **High** |
| getLayoutBadges counts | All (layout) | Medium |
