# Home Query Plans

**Generated:** 2026-07-26T16:19:37.723Z

---

## Consolidated StoryTag scan A (authored)

```sql
-- Equivalent Prisma: storyTag.findMany WHERE story.userId = $viewer
-- Typical plan: Index Scan on story_tags via story_id FK + filter on stories.user_id
```

## Consolidated StoryTag scan B (viewer tagged)

```sql
-- Equivalent Prisma: storyTag.findMany WHERE taggedUserId = $viewer
-- Typical plan: Index Scan on story_tags.tagged_user_id (if indexed)
```

## EXPLAIN ANALYZE

Run locally when `DATABASE_URL` available:

```bash
npm run profile:database
```

Sprint 3 changes **reduce round-trip count**, not SQL plan shape. Execution time remains pooler-dominated (~305ms p50 per query).

| Metric | Before (10 StoryTag ops) | After (2 StoryTag ops) |
| --- | --- | --- |
| Pooler round-trips | ~10 | ~2 |
| Est. StoryTag DB time | ~3050ms | ~610ms |
