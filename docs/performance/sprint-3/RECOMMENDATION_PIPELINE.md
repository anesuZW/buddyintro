# Recommendation Pipeline Audit

**Generated:** 2026-07-26T16:19:37.723Z

---

## getIntroductionSuggestions

- Receives `IntroductionSuggestionsContext` from home context (no extra StoryTag queries)
- Still runs `SharedIntroducerRelationship.groupBy` for pair filtering — **unchanged algorithm**

## getTrustRecommendations

- Still uses `getCachedTrustRecommendations` (5min compute cache — pre-existing)
- Still runs `UserConnection.findMany` + optional `SharedIntroducerRelationship.findMany`
- **No overlap removed** — different data from home tag scans

## getMutualTagFeed

- Receives `MutualTagFeedContext` from home context — **unchanged since Sprint 2**
- Story/Post findMany for feed assembly — unchanged
