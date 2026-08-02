# Cache Strategy

**Sprint:** Performance Optimization Planning (READ-ONLY)  
**Generated:** 2026-07-26  
**Sources:** DUPLICATE_QUERY_MATRIX, PRIORITIZED_OPTIMIZATION_PLAN, DATABASE_QUERY_TRACE

---

## Principles

1. **Request-scoped first** — React `cache()` dedupes within one RSC render tree; zero staleness risk.
2. **Cross-request second** — `unstable_cache()` only for read-heavy, rarely mutated data with explicit tags.
3. **Never cache mutations** — writes bypass all caches; invalidate by tag or TTL.
4. **Behaviour equivalence** — cached path must return identical data to uncached path for same inputs.

---

## Already Implemented ✓

| Service | Mechanism | File | Status |
|---------|-----------|------|--------|
| `getCurrentUser` | React `cache()` | `lib/auth.ts` | **DONE** — SAFE |
| `getAdminSettings` | React `cache()` | `services/admin.ts` | **DONE** — SAFE |
| `getLayoutBadges` | React `cache(user)` | `services/layout-badges.ts` | **DONE** — SAFE |
| `getHomeStoryContext` | React `cache(userId)` | `services/home-dashboard.ts` | **DONE** — SAFE |
| `loadHomeDashboardStats/Feed/Secondary` | React `cache(userId)` | `services/home-dashboard.ts` | **DONE** — SAFE |
| `listIntroductionCategoriesCached` | React `cache()` + 5min module | `lib/perf-cache.ts` | **DONE** — SAFE |
| `getCachedTrustRecommendations` | In-memory Map, 5min TTL | `lib/perf-cache.ts` | **DONE** — MEDIUM |

---

## Recommended — Not Implemented

### React cache() — Request Scoped

| Target | Key | Tag | Rationale | Queries saved |
|--------|-----|-----|-----------|---------------|
| `getDiscoveriesNetworkAuthorIds` | `viewerId` | **SAFE** | Called once per feed; stable within request | 1 on discoveries |
| `listBlockedUserIds` | `viewerId` | **SAFE** | Same viewer for feed + filters | 1 on discoveries |
| `notificationService.getPreferences` | `userId` | **SAFE** | Profile page single user | 0–1 |
| `getIntroductionExpiryFilter` | none | **SAFE** | Derived from AdminSettings (already cached) | 0 |
| `getViewerNetworkContext` (new) | `viewerId` | **SAFE** | Combines network IDs + connections for feed + recs | 1–2 |
| `filterDiscoveryAuthorIds` result | `viewerId+hash(authors)` | **MEDIUM** | Must invalidate if verification status changes mid-request (unlikely) | 0–1 |

### unstable_cache() — Cross-Request Server Cache

| Target | Key | TTL | Tags | Tag | Rationale |
|--------|-----|-----|------|-----|-----------|
| `getAdminSettings` | `admin-settings` | 60s | `admin-settings` | **MEDIUM** | Single row; admin updates rare; React cache already covers request |
| `listIntroductionCategories` | `activeOnly` | 300s | `categories` | **SAFE** | Module cache exists; migrate to unstable_cache for multi-instance |
| `getTrustProfilesBulk` | `viewerId:authorHash` | 60s | `trust:${viewerId}` | **MEDIUM** | Stale trust scores up to 60s; acceptable for feed enrichment |
| `getConnectionReasonsBulk` | `viewerId:authorHash` | 60s | `graph:${viewerId}` | **MEDIUM** | Same as above |
| `getDiscoveriesNetworkAuthorIds` | `viewerId` | 120s | `network:${viewerId}` | **RISKY** | Network changes on new introductions; TTL must be short + invalidation on story publish |
| Introduction graph edges | `global` | 300s | `graph` | **RISKY** | Must invalidate on story publish/delete |

### In-Memory / Module Memoization

| Target | Scope | Tag | Notes |
|--------|-------|-----|-------|
| `getCachedTrustRecommendations` | Process | **MEDIUM** | Already exists; extend invalidation hooks on connection rebuild |
| Pooler RTT rolling average | Process | **SAFE** | For adaptive timeout logging only — not business data |

### Request-Scoped Memo (AsyncLocalStorage)

| Target | Tag | Rationale |
|--------|-----|-----------|
| Phase2 `prismaQueries` bucket | **SAFE** | Already exists for profiling |
| Shared `AdminSettings` reference passed via context | **SAFE** | Alternative to unstable_cache for settings |

---

## Risk Classification Guide

| Level | Definition | Example |
|-------|------------|---------|
| **SAFE** | Pure read; key is user/session scoped; stale ≤ 1 request impossible or harmless | `getCurrentUser`, `listBlockedUserIds` cache |
| **MEDIUM** | Cross-request staleness possible; bounded TTL; admin can tolerate delay | Trust enrichment 60s cache |
| **RISKY** | Staleness affects trust/safety decisions; requires event invalidation | Network author list without invalidation |

---

## Invalidation Events (Required for MEDIUM/RISKY)

| Event | Invalidate |
|-------|------------|
| Story published | `network:${viewerId}`, `trust:*`, `graph:*` for all tagged users |
| Story deleted/expired | Same |
| User blocked/unblocked | `network:${viewerId}`, `blocks:${viewerId}` |
| Admin settings update | `admin-settings` |
| Category CRUD | `categories` |
| Connection rebuild job | `trust:*`, `graph:*` |

---

## Anti-Patterns to Avoid

| Pattern | Why |
|---------|-----|
| Global cache of user-specific feed | Wrong user's data |
| Cache `getConversationList` cross-request | Messages must be realtime |
| Cache auth session in unstable_cache | Security |
| Long TTL on verification gates | Unverified user may gain access incorrectly |

---

## Implementation Notes (Next Sprint)

### SAFE: `getDiscoveriesNetworkAuthorIds`

```typescript
// Proposed shape — NOT implemented
export const getDiscoveriesNetworkAuthorIdsCached = cache(
  async (viewerId: string) => getDiscoveriesNetworkAuthorIds(viewerId)
);
```

**Measure:** discoveries query count −1.

### MEDIUM: Trust enrichment unstable_cache

```typescript
// Proposed shape — NOT implemented
unstable_cache(
  () => getTrustProfilesBulk(viewerId, authorIds),
  [`trust-profiles`, viewerId, hash(authorIds)],
  { revalidate: 60, tags: [`trust:${viewerId}`] }
);
```

**Measure:** repeated discoveries scroll within 60s −N bulk queries.

---

## Cache vs Query Reduction Priority

| Approach | When to prefer |
|----------|--------------|
| Query consolidation | Same data fetched with different shapes (StoryTag on /home) |
| React cache() | Same function called from layout + page + siblings |
| unstable_cache() | Identical cross-user read-heavy compute (categories, admin settings) |
| Async deferral | Write-heavy non-render paths (analytics) |

---

## Verification

| Cache type | Test |
|------------|------|
| React cache() | Two call sites in one request → one Prisma query in `[PROFILE]` |
| unstable_cache() | Second request within TTL → 0 DB queries; after revalidate → 1 |
| Invalidation | Publish story → next request misses cache |
