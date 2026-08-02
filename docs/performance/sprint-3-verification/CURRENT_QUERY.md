# Current Query — slice(0,20) Replacement Audit

**Generated:** 2026-07-26T18:05:00.000Z  
**Evidence:** Source inspection (STATIC ANALYSIS)

---

## Consolidated DB scans (replace four prior StoryTag queries)

### Scan A — viewer-authored tags

| Field | Value |
| --- | --- |
| **File** | `services/home-dashboard.ts` |
| **Function** | `getHomeStoryContext` |

```typescript
prisma.storyTag.findMany({
  where: { story: { userId } },
  select: {
    taggedUserId: true,
    taggedUser: { select: { id: true, name: true, profilePicture: true } },
    story: { select: { status: true, category: { select: { name: true } } } },
  },
})
```

No `take`, no `orderBy`.

### Scan B — viewer-tagged tags

```typescript
prisma.storyTag.findMany({
  where: { taggedUserId: userId },
  select: {
    storyId: true,
    story: {
      select: {
        userId: true,
        status: true,
        user: { select: { id: true, name: true, profilePicture: true } },
        category: { select: { name: true } },
      },
    },
  },
})
```

No `take`, no `orderBy`.

---

## In-memory derivation — `buildHomeStoryContextFromRows`

| Field | Value |
| --- | --- |
| **File** | `lib/home-story-context.ts` |
| **Function** | `buildHomeStoryContextFromRows` |

### `introducedByViewer` (replaces take:20 query A)

| Property | Value |
| --- | --- |
| **Input collection** | `publishedAuthored = viewerAuthoredTags.filter(t => t.taggedUserId && t.story.status === "published")` |
| **Source** | Scan A rows |
| **Already sorted** | **No** — array order = Prisma return order (undefined without orderBy) |
| **Duplicates removed** | **No** — all published authored tags retained before slice |
| **Selection** | `publishedAuthored.slice(0, 20).map(...)` |

### `introducedToViewer` (replaces take:20 query B)

| Property | Value |
| --- | --- |
| **Input collection** | `publishedTagged = viewerTaggedTags.filter(t => t.story.status === "published")` |
| **Source** | Scan B rows |
| **Already sorted** | **No** |
| **Duplicates removed** | **No** — multiple tags from same author allowed |
| **Selection** | `publishedTagged.slice(0, 20).map(...)` |

---

## Downstream consumers (unchanged algorithms)

| Consumer | Input from context |
| --- | --- |
| `getIntroductionSuggestions(userId, 3, ctx.suggestionsCtx)` | `introducedByViewer`, `introducedToViewer` arrays |
| `getMutualTagFeed(..., ctx.feedCtx)` | `myTaggedUserIds`, `coTagAuthorIds` |
| `getStoryBarForViewer(..., { visibilityPrefetch })` | `coTagAuthorIds`, `everIntroducedAuthorIds` sets |
| `getTrustNetworkStats(userId, ctx.trustStats)` | Precomputed counts and target ids |
