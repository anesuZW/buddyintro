# Message Context Optimizations

Generated: 2026-06-22  
Target: Message Context Prisma **243ms → under 100ms** at 500 users (warm production)

## Result

| Metric | Before | After | Target |
| ------ | ------ | ----- | ------ |
| Prisma (500 users, warm) | **243ms** | **68ms** | ≤100ms ✓ |
| Server handler (500 users, warm) | 253ms | **49ms** | — |
| TTFB (500 users, warm) | 496ms | 321ms | auth-bound |

Measured: `docs/.production-benchmark.json` (2026-06-22, `sim-0@simulation.buddyintro.test`, port 3010, 5 warm runs)

---

## Changes

### 1. Materialized graph fast path (`lib/conversation-graph-fast.ts`) — **P0**

**Problem:** `getConversationGraphContext` called `buildGraphIndex()` → `loadIntroductionEdges()` loading **all** published `StoryTag` rows.

**Fix:** When `user_connections` is materialized, use `getConversationGraphContextFromStore`:

| Data | Source | Query pattern |
| ---- | ------ | ------------- |
| Mutual introducers | `shared_introducer_relationships` | Indexed pair lookup |
| Direct introductions | `story_tags` | OR filter (viewer↔other only) |
| Path chain | `user_connections` BFS | Batched degree-1 neighbor queries (max 4 levels) |
| Connection depth | `user_connections` | Single `findUnique` |
| Related intros | `story_tags` | `story.userId IN (introducerIds)` |
| Evidence | `stories` | `id IN (≤6 story ids)` |

**Business logic:** Unchanged response shape; same mutual/path/reason semantics when materialized graph matches introduction edges.

### 2. Route access dedup (`app/api/messages/[userId]/context/route.ts`, `services/chat-context.ts`) — **P1**

**Problem:** `canAccessChatContext` + `getChatContextPayload` each probed messages/context.

**Fix:** Access check moved into `getChatContextPayload` (block check → context → message thread → messaging gate). Route calls payload once.

### 3. Trust profile preload (`services/trust-profile.ts`, `services/chat-context.ts`) — **P1**

**Problem:** `getTrustProfile` re-fetched `SharedIntroducerRelationship` after graph already loaded mutual introducers.

**Fix:** Optional `preloaded.sharedIntroducerCount` + `preloaded.sharedIntroducers` from graph mutual list; skips duplicate pair query and count fallback.

### 4. Shared reason helpers (`lib/introduction-graph-reason.ts`) — **P2**

Extracted `buildReasonFromEvidence` / `reasonTextForDepth` for reuse by fast path without duplicating reason logic.

### 5. BFS neighbor batching (`lib/conversation-graph-fast.ts`) — **P2**

**Problem:** Per-node `userConnection` queries during path BFS.

**Fix:** `getMaterializedNeighborsBatch(frontier)` — 2 queries per BFS level.

### 6. `getConversationGraphContext` dispatch (`lib/introduction-graph.ts`) — **P0**

```typescript
if (await isUserConnectionsMaterialized()) {
  return getConversationGraphContextFromStore(viewerId, otherUserId);
}
// fallback: full index (dev / empty graph)
```

---

## Files modified

| File | Change |
| ---- | ------ |
| `lib/conversation-graph-fast.ts` | **New** — materialized fast path |
| `lib/introduction-graph-reason.ts` | **New** — shared reason builders |
| `lib/introduction-graph.ts` | Dispatch to fast path; import reason helpers |
| `services/chat-context.ts` | Access merge; trust preload |
| `services/trust-profile.ts` | Preloaded shared introducers |
| `lib/access-control.ts` | Split `canAccessChatContextWhenNoThread` |
| `app/api/messages/[userId]/context/route.ts` | Remove duplicate access call |

---

## Query count (after, 500 users warm sample)

| Query | Count |
| ----- | ----- |
| `User.findUnique` | 1–2 (auth + trust) |
| `AdminSettings.findUnique` | 1 |
| `ConversationContext.findUnique` | 1 |
| `SharedIntroducerRelationship.findMany` | 1 (pair) |
| `StoryTag.findMany` | 1–2 (scoped) |
| `userConnection.findMany` | 2–8 (BFS batches) |
| `Story.findMany` | 0–1 (evidence subset) |
| **Full tag scan** | **0** |

---

## Remaining opportunities (not implemented)

| Priority | Item | Est. impact |
| -------- | ---- | ----------- |
| P2 | Cache pair graph bundle in Redis (multi-instance) | Medium |
| P3 | Further merge `User.findUnique` for trust + auth | Low |
| P3 | Trim graph JSON payload for mobile clients | Low |

---

*Reproduce: `npm run build && npm run profile:production -- --skip-build --port=3010 --email=sim-0@simulation.buddyintro.test --password=SimPass123!`*
