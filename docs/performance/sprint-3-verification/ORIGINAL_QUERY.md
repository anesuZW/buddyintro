# Original Query — slice(0,20) Replacement Audit

**Generated:** 2026-07-26T18:05:00.000Z  
**Evidence:** Git diff vs `checkpoint/sprint-3-home-start` (STATIC ANALYSIS)

Sprint 3 replaced two Prisma `take: 20` queries inside `getHomeStoryContext` with in-memory `slice(0, 20)` after full tag scans.

---

## Replacement A — `introducedByViewer`

| Field | Value |
| --- | --- |
| **File** | `services/home-dashboard.ts` (pre-Sprint 3) |
| **Function** | `getHomeStoryContext` |
| **Operation** | `prisma.storyTag.findMany` |

### Original query

```typescript
prisma.storyTag.findMany({
  where: {
    story: { userId, status: "published" },
    taggedUserId: { not: null },
  },
  select: {
    taggedUserId: true,
    taggedUser: { select: { id: true, name: true, profilePicture: true } },
    story: { select: { category: { select: { name: true } } } },
  },
  take: 20,
})
```

| Property | Value |
| --- | --- |
| **Filters** | `story.userId = viewer`, `story.status = published`, `taggedUserId IS NOT NULL` |
| **Includes** | `taggedUser`, `story.category` |
| **orderBy** | **None** |
| **Distinct** | **None** |
| **Cursor** | **None** |
| **Skip** | **None** |
| **take** | **20** |

---

## Replacement B — `introducedToViewer`

| Field | Value |
| --- | --- |
| **File** | `services/home-dashboard.ts` (pre-Sprint 3) |
| **Function** | `getHomeStoryContext` |
| **Operation** | `prisma.storyTag.findMany` |

### Original query

```typescript
prisma.storyTag.findMany({
  where: {
    taggedUserId: userId,
    story: { status: "published" },
  },
  select: {
    story: {
      select: {
        userId: true,
        user: { select: { id: true, name: true, profilePicture: true } },
        category: { select: { name: true } },
      },
    },
  },
  take: 20,
})
```

| Property | Value |
| --- | --- |
| **Filters** | `taggedUserId = viewer`, `story.status = published` |
| **Includes** | `story.user`, `story.category` |
| **orderBy** | **None** |
| **Distinct** | **None** |
| **Cursor** | **None** |
| **Skip** | **None** |
| **take** | **20** |

---

## Fallback path (unchanged)

`services/introduction-suggestions.ts` still uses identical `take: 20` queries when called **without** context (non-home paths):

```50:81:services/introduction-suggestions.ts
      prisma.storyTag.findMany({ ... take: 20 }),
      prisma.storyTag.findMany({ ... take: 20 }),
```

---

## Related original queries removed (not slice replacements)

These were eliminated on `/home` via context passing, not replaced by `slice`:

| Operation | Original caller | Count removed |
| --- | --- | --- |
| `StoryTag.count` | `getTrustNetworkStats` | 2 |
| `StoryTag.findMany` (distinct) | `getTrustNetworkStats` | 2 |
| `StoryTag.findMany` (visibility) | `filterStoriesByVisibilityGate` | 2 |
| `StoryTag.findMany` (feed ids) | `getHomeStoryContext` | 2 (merged into scans) |
