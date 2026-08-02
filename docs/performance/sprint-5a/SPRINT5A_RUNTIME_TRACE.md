# Sprint 5A Runtime Trace

**Generated:** 2026-07-27  
**Status:** **BLOCKED** — dev server not running

---

## Expected `/home` Story trace (Sprint 4, static)

| Order | Model.Operation | Caller | Est. duration |
| --- | --- | --- | --- |
| 1 | Story.findMany | `getTrustNetworkStats` recentSent | ~682 ms |
| 2 | Story.findMany | `getTrustNetworkStats` recentReceived | ~687 ms |
| 3 | Story.findMany | `getHomeVisibleStoryRows` | ~624–4,600 ms |
| 4 | Story.findMany | `getMutualTagFeed` mutual authors | ~4,898 ms |
| — | *(none)* | Feed co-tag via `pickCoTagFeedStories` | 0 ms DB |

**Story.findMany count: 4**

Reference: Sprint 3 verification `home-trace-capture.json` (request `2afc354d`), adjusted for Sprint 4 (−1 co-tag query).

---

## Re-run instructions

```powershell
$env:PROFILE_PRODUCTION='1'; npm run dev -- -p 3000
npm run sprint:4-validation -- --base=http://localhost:3000
```

Capture server `[prisma:slow]` log lines for Story operations.

---

## Phase 5 implementation

**No code changes in Sprint 5A.** Low-risk optimizations already applied in Sprint 4; no additional evidence-backed merges identified.
