# FriendIntro Platform Stability Audit

**Date:** 2026-05-24  
**Scope:** All API routes, Prisma services, graph layer, notifications, analytics  
**Method:** Static analysis (`npm run audit:performance`), manual route review, schema index audit

---

## Executive Summary

| Severity | Count | Top risk |
|----------|-------|----------|
| CRITICAL | 3 | Unbounded message inbox load; full-graph rebuild cost; no rate limiting |
| WARNING | 14 | N+1 trust enrichment on discoveries/messages; unbounded introductions |
| INFO | 20 | Missing explicit `take` on secondary queries |

The platform is **stable at early beta scale** (<5k users, <100k messages) but has **three production blockers** before 100k+ users: message inbox query, trust profile N+1 on feed enrichment, and absent API rate limits.

---

## 1. Slowest Endpoints (estimated latency under load)

| Rank | Endpoint | Service path | Est. queries | Primary bottleneck |
|------|----------|--------------|--------------|-------------------|
| 1 | `GET /api/discoveries` | `getDiscoveriesFeed` | 15–60+ | N+1 `getTrustProfilesBulk` + `getConnectionReasonsBulk` + category filter |
| 2 | `GET /messages` (page SSR) | `getConversationList` | 1 + N + 2 | Loads **all** user messages; dedupes in JS |
| 3 | `GET /api/messages/[userId]` (SSR chat) | `getConversation` | 1 unbounded | Full thread history, no limit |
| 4 | `GET /api/introductions` | `getIntroductionsForUser` | 2+ | Unbounded `story.findMany` with nested includes |
| 5 | `GET /home` (SSR) | `getMutualTagFeed` + suggestions | 6–400+ | Feed OK at 50; suggestions O(n²) shared count queries |
| 6 | `GET /api/admin/analytics` | `queryMetrics` | 25+ parallel | Heavy but admin-only; acceptable with caching |
| 7 | `GET /api/messages/[userId]/context` | `getChatContextPayload` | 5–15 | Graph rebuild via `loadIntroductionEdges` |
| 8 | `POST /api/stories` | `createStoryWithTags` + graph refresh | 10+ sync | Trust graph refresh (queued when flag on) |

---

## 2. Largest Queries (rows scanned / memory)

| Query | Location | Growth | Risk |
|-------|----------|--------|------|
| `message.findMany WHERE sender OR receiver` | `getConversationList` | O(all messages) | **CRITICAL** |
| `message.findMany` full thread | `getConversation` | O(thread length) | **HIGH** |
| `story.findMany` all introductions for user | `getIntroductionsForUser` | O(introductions received) | **HIGH** |
| `storyTag.findMany` published tags | `loadIntroductionEdges` | O(all introductions) | **MEDIUM** (cached per request) |
| `userConnection.deleteMany` + full BFS | `rebuildUserConnections` | O(users × edges) | **CRITICAL** if sync |
| `userId IN (networkIds)` | `getDiscoveriesFeed` | O(network size) | **MEDIUM** at depth 4 |
| `user.findMany` all users | admin broadcast | O(users) | **MEDIUM** (admin only) |

---

## 3. Most Frequently Called Services

| Service | Called from | Calls/session (typical) |
|---------|-------------|-------------------------|
| `getAdminSettings` | Nearly every API route | 5–15 (uncached per request) |
| `getTrustProfile` / `getTrustProfilesBulk` | Discoveries, messages, search | 1–20 per page |
| `getConnectionReason` / bulk | Discoveries enrichment | 1–10 per feed load |
| `analyticsService.track` | All write paths | Fire-and-forget |
| `notificationService.create` | Messages, stories, discoveries | Per event |
| `loadIntroductionEdges` | Graph/reason paths | 1–3 per enriched page |
| `listBlockedUserIds` | Discoveries, introductions, search | 1–3 per page |

**Recommendation:** Cache `getAdminSettings` per request (React `cache()` or module-level TTL 30s).

---

## 4. N+1 Query Patterns

| Pattern | File | Impact |
|---------|------|--------|
| `Promise.all(ids.map(getTrustProfile))` | `trust-profile.ts` | 3–5 queries × N authors |
| `getConnectionReasonsBulk` per author | `introduction-graph.ts` | Graph work × N |
| `viewerSharesCategoryWithAuthor` per post | `category-visibility.ts` | 2 queries × N posts |
| `getSharedIntroducerCount` nested loop | `introduction-suggestions.ts` | Up to 400 queries |
| `filterDiscoveryAuthorIds` async map | `verification-gates.ts` | N count queries when gates on |
| `shouldDeliver` triple fetch | `notification-service.ts` | 2 queries per notification (acceptable) |

---

## 5. Missing / Weak Indexes

### Existing (good coverage)
- `messages(sender_id, receiver_id, created_at)` composite ✓
- `notifications(user_id, is_read, created_at)` ✓
- `user_connections(source_user_id, degree)` ✓
- `analytics_events(event_type, created_at)` ✓

### Recommended additions
| Index | Table | Reason |
|-------|-------|--------|
| `(tagged_user_id, story_id)` | `story_tags` | Introductions list filter by tagged user |
| `(status, created_at DESC)` | `stories` | Paginated introductions by recency |
| `(receiver_id, read_at)` partial WHERE read_at IS NULL | `messages` | Unread count aggregation |
| `(user_id, created_at DESC)` | `discoveries_posts` | Feed already has visibility index; reinforce user timeline |
| `(user_id, created_at DESC)` | `analytics_events` | User insights pagination |

---

## 6. Duplicate Database Calls

| Duplication | Locations |
|-------------|-----------|
| `getAdminSettings()` | Called independently in gate + service + route (same request) |
| Block list fetch | discoveries + separate moderation checks |
| User verification fields | Fetched in gate check and again in trust profile |
| `loadIntroductionEdges` + `loadIntroductionAdjacency` | Parallel graph loaders scanning same tags |
| Unread count | Notifications API: list + separate count (acceptable) |

---

## 7. Memory Leaks

No classic JS memory leaks detected. **Effective memory risks:**

| Risk | Cause |
|------|-------|
| Unbounded arrays | Full message history, full introductions list loaded into SSR props |
| Large `IN (...)` clauses | Network author IDs passed to Prisma (thousands of UUIDs) |
| In-memory rate limit Map | Grows with unique users (mitigated by TTL eviction) |

---

## 8. Inefficient Graph Traversals

| Traversal | Complexity | When run |
|-----------|------------|----------|
| BFS 4-hop from every user | O(U × E) | `rebuildUserConnections` |
| BFS per user incremental | O(E) per affected user | After publish (acceptable) |
| Live BFS fallback | O(E) | When `user_connections` empty |
| Shared introducer rebuild | O(introducers × n²) | Trust graph rebuild |
| `getConnectionReason` | O(edges) per pair | Discoveries bulk |

**Mitigation in place:** `scheduleTrustGraphRefresh` queues when `enableBackgroundJobs` on.  
**Gap:** Live BFS still used when materialized graph missing.

---

## 9. Pagination Status (pre-fix)

| Resource | Paginated? | Default limit | Gap |
|----------|------------|---------------|-----|
| Notifications | ✓ cursor | 20 | UI has load-more; OK |
| Discoveries | ✓ cursor | **10** | Should be 20 per spec |
| Messages (inbox) | ✗ | ALL | **CRITICAL** |
| Messages (thread) | ✗ | ALL | **CRITICAL** |
| Introductions | ✗ | ALL | **HIGH** |
| Analytics events | ✗ | ALL (admin aggregates only) | **MEDIUM** |
| Feed | partial | 50 | Exceeds 20 default spec |
| Invites list | ✗ | ALL | **LOW** |

---

## 10. Rate Limiting Status (pre-fix)

**None implemented.** All POST routes accept unlimited requests per authenticated user.

High-abuse surfaces:
- `POST /api/messages` — spam / harassment
- `POST /api/stories` — introduction flooding
- `POST /api/discoveries` — discovery spam
- `POST /api/invites` — invite bombing

---

## 11. Loading / Error UI Status (pre-fix)

| Surface | Loading | Error |
|---------|---------|-------|
| Notifications | ✓ | ✗ silent fail |
| Discoveries feed | ✓ skeleton | ✗ no error state |
| Introductions list | ✓ | ✗ no error state |
| Messages inbox | SSR only | ✗ |
| Admin analytics | ✓ | ✗ |
| Trust recommendations | ✓ (hidden) | ✗ |

---

## 12. Test Coverage (pre-fix)

**Zero automated tests.** All trust/discovery/graph logic is untested in CI.

---

## 13. Remediation Plan (implemented in follow-up commit)

1. Add `lib/pagination.ts` — `DEFAULT_PAGE_SIZE = 20`
2. Add `lib/rate-limit.ts` — in-memory sliding window (swappable)
3. Migration `202610_stability_indexes` — composite indexes
4. Paginate messages inbox + threads + introductions
5. Batch `getTrustProfilesBulk` (eliminate N+1)
6. Cap discoveries/feed defaults at 20
7. Add admin analytics events pagination endpoint
8. Add loading/error states to list components
9. Add Vitest unit tests for trust, gates, graph, notifications
10. Wire rate limits on messages, stories, discoveries, invites POST

---

## 14. API Route Inventory (55 routes)

All routes reviewed. Highest-risk unbounded reads:

- `GET /api/stories` → `getVisibleStories` (bounded by expiry, not count)
- `GET /api/introductions` → unbounded
- `GET /api/invites` → unbounded
- `GET /api/network` → bounded by degree
- `GET /api/feed` → limit 50

Write paths without rate limits: all POST/PATCH on user-generated content.

---

## 15. Remediation Applied (2026-05-24)

| Item | Status |
|------|--------|
| Audit report | ✓ `docs/PLATFORM_STABILITY_AUDIT.md` |
| Default page size 20 | ✓ `lib/pagination.ts` |
| Messages inbox pagination | ✓ SQL `DISTINCT ON` + `GET /api/messages` |
| Message thread pagination | ✓ cursor on `getConversation` (20 default) |
| Introductions pagination | ✓ per-tab cursor via `GET /api/introductions?group=` |
| Discoveries default 20 | ✓ was 10, now 20 |
| Notifications pagination | ✓ already 20; added error states |
| Analytics events pagination | ✓ `GET /api/admin/analytics/events` |
| Invites list pagination | ✓ cursor, max 20 |
| Rate limiting | ✓ `lib/rate-limit.ts` on messages/stories/discoveries/invites POST |
| N+1 fix trust bulk | ✓ batched `getTrustProfilesBulk` |
| DB indexes | ✓ migration `202610_stability_indexes` |
| Loading/error UI | ✓ `ListState` + messages/discoveries/introductions/notifications |
| Unit tests | ✓ `tests/*.test.ts` (trust, gates, graph BFS, notifications) |

**Still recommended (future):** batch `getConnectionReasonsBulk`, batch category visibility filter, Redis rate limiter, cache `getAdminSettings` per request.

*Re-run `npm run audit:performance` after fixes.*
