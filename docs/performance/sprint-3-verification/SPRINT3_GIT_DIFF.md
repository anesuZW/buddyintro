# Sprint 3 Git Diff Verification

**Generated:** 2026-07-26T18:05:00.000Z  
**Git commit (HEAD):** `87edda065bda93cf7c7dba6f74e2c263a133cb29`  
**Sprint 2 checkpoint:** `checkpoint/sprint-2-auth-start` → `87edda0`  
**Sprint 3 checkpoint:** `checkpoint/sprint-3-home-start` → `87edda0` (same commit)  
**Diff basis:** Working tree vs `checkpoint/sprint-3-home-start`  
**Evidence:** Git diff (STATIC ANALYSIS)

---

## Scope note

Sprint 3 changes are **uncommitted** on branch `performance-recovery-sprint`. HEAD equals both sprint checkpoints; all Sprint 3 work appears in the working tree diff from `checkpoint/sprint-3-home-start`.

Verification is limited to **Sprint 3 home pipeline files** only. Other modified files in the working tree (email delivery, upload, deployment docs) are **out of Sprint 3 scope** and excluded below.

---

## Sprint 3 files modified

| File | Status | Lines changed (approx.) | Sprint 3 scope |
| --- | --- | --- | --- |
| `lib/home-story-context.ts` | **Added** | +116 | ✅ Core |
| `services/home-dashboard.ts` | Modified | −69 / +52 net | ✅ Core |
| `services/trust-network.ts` | Modified | −33 / +54 net | ✅ Core |
| `lib/story-visibility.ts` | Modified | +8 import, refactor prefetch branch | ✅ Core |
| `services/stories.ts` | Modified | Mixed | ⚠️ Partial (home visibility only) |
| `tests/home-story-context.test.ts` | **Added** | +67 | ✅ Tests |

---

## File-by-file diff record

### 1. `lib/home-story-context.ts` (NEW)

| Item | Detail |
| --- | --- |
| **Functions** | `buildHomeStoryContextFromRows()` |
| **Types** | `HomeVisibilityPrefetch`, `TrustNetworkStatsContext`, `HomeStoryContext` |
| **Lines** | 1–116 (entire file) |
| **Purpose** | Derive feed context, suggestion rows, visibility prefetch, and trust stats from two in-memory tag scans — replaces four DB queries plus downstream duplicate StoryTag operations |

---

### 2. `services/home-dashboard.ts`

| Function | Lines modified | Purpose |
| --- | --- | --- |
| `getHomeStoryContext` | 21–53 → 28–51 | Replace 4× `StoryTag.findMany` with 2× broader scans + `buildHomeStoryContextFromRows()` |
| `loadHomeDashboardStats` | 78–79 | Pass `ctx.trustStats` to `getTrustNetworkStats` |
| `loadHomeDashboardFeed` | 95–99 | Pass `visibilityPrefetch` to `getStoryBarForViewer` |
| `loadHomeDashboardData` | 105–111 | Same trust + visibility wiring |
| `HOME_DASHBOARD_QUERY_ESTIMATES` | 116–119 | Update benchmark estimates for docs |

**Removed:** Inline derivation of `feedCtx`, `suggestionsCtx`, `introducerAuthorIds` from four parallel queries.

---

### 3. `services/trust-network.ts`

| Function | Lines modified | Purpose |
| --- | --- | --- |
| `getTrustNetworkStats` | 6–97 | Add optional `statsCtx?: TrustNetworkStatsContext`; when provided, skip 2× `StoryTag.count` + 2× `StoryTag.findMany` |

**Preserved:** `Story.findMany` (recent sent/received), `UserConnection.findMany`, mutual-count loop.

---

### 4. `lib/story-visibility.ts`

| Function | Lines modified | Purpose |
| --- | --- | --- |
| `filterStoriesByVisibilityGate` | 31–75 | Add optional `prefetch?: HomeVisibilityPrefetch`; when provided, skip 2× `StoryTag.findMany` co-tag / ever-introduced scans |

**Preserved:** Visibility gate filter logic unchanged.

---

### 5. `services/stories.ts` (Sprint 3 subset only)

| Function | Lines modified | Purpose |
| --- | --- | --- |
| `getVisibleStories` | 273–307 | Accept `visibilityPrefetch`; pass to `filterStoriesByVisibilityGate` |
| `getStoryBarForViewer` | 313–316 | Accept `visibilityPrefetch` in opts |

**Out of scope (same file, not Sprint 3):** `createStoryWithTags` email delivery refactor (~lines 37–270).

---

### 6. `tests/home-story-context.test.ts` (NEW)

| Test | Purpose |
| --- | --- |
| `introducedByMeCount` includes null `taggedUserId` on published stories | Trust count parity |
| `uniqueIntroducerCount` dedupes by author id | Trust stat parity |
| `everIntroducedAuthorIds` includes expired stories | Visibility prefetch parity |

---

## Files NOT modified by Sprint 3 (confirmed unchanged in scope)

- `services/introduction-suggestions.ts` — algorithm unchanged; receives pre-built context
- `services/trust-recommendations.ts` — unchanged
- `services/feed.ts` — unchanged; consumes `MutualTagFeedContext`
- `lib/auth.ts` — Sprint 2 auth dedupe (accepted fact)
- `services/layout-badges.ts` — Sprint 2 badge dedupe (accepted fact)

---

## Reproducibility

```powershell
git diff checkpoint/sprint-3-home-start -- lib/home-story-context.ts services/home-dashboard.ts services/trust-network.ts lib/story-visibility.ts services/stories.ts tests/home-story-context.test.ts
```
