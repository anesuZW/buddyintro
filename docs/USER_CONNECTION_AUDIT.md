# UserConnection Query Audit

Generated: 2026-06-23  
Dataset: **1,000 simulation users**, **999,177** materialized `user_connections` rows

## Executive summary

**Status: PASS** — All hot-path queries now complete in **<500ms** (most in **1–10ms**).

The prior **65–70s** / heap exhaustion issue was caused by unbounded `userConnection.findMany()` in `refreshConnectionTrustScores` loading the entire table with `targetUser` includes.

## Before vs after

| Query | Route | Before | After | Fix |
| ----- | ----- | ------ | ----- | --- |
| `refreshConnectionTrustScores` | Story publish job | **65,000–70,000ms** (full table + include) | **10ms** (1-user incremental batch) | Cursor pagination (500/batch), separate user lookup |
| `getNetworkUserIdsFromConnections` | `/discoveries` SSR | Unbounded | **4ms** (96 rows) | `take: 2500` cap |
| `connectionsAtDegree` | `/introductions/network` | Unbounded | **1ms** (77 rows) | `take: 500` cap |
| `getTrustProfilesBulk` | Discoveries trust | OK with `in` filter | **5ms** | Already bounded by author list |
| `resetUserTrustScore` | Admin trust-risk | N+1 find + update loop | **<50ms** (updateMany) | Two `updateMany` calls |
| `trust-recommendations` | `/api/trust/recommendations` | **2ms** | **2ms** | Already `take: 12` |

Full benchmark artifact: `docs/.user-connection-benchmark.json`

## Query inventory

| Location | Purpose | Limit |
| -------- | ------- | ----- |
| `lib/shared-introducers.ts` | Trust score refresh | Batch 500, optional source filter |
| `services/introduction-graph-builder.ts` | Network IDs, degree listing | 2500 / 500 |
| `services/trust-abuse.ts` | Admin score reset | updateMany |
| `services/trust-profile.ts` | Bulk trust profiles | `in` clause on visible users |
| `lib/conversation-graph-fast.ts` | Message graph neighbors | `in` batch by frontier |
| `services/trust-recommendations.ts` | Recommendations | `take: 12` |
| `services/introductions.ts` | Introduction list | `take: 30` |

## Index recommendations

Existing indexes (adequate for current queries):

```sql
-- prisma/schema.prisma
@@index([sourceUserId, degree])
@@unique([sourceUserId, targetUserId])
@@index([targetUserId])
```

**No new migration required** — caps + batching eliminate full-table scans.

Optional future index (only if admin analytics queries grow):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_connections_source_degree_trust
  ON user_connections (source_user_id, degree, trust_score DESC);
```

## Query plan notes

- Incremental refresh uses `WHERE source_user_id IN (...)` — index seek on `(sourceUserId, degree)`
- Network ID query uses `(sourceUserId, degree)` range filter + `LIMIT 2500`
- Cursor pagination on `id ASC` avoids OFFSET cost on large tables

## Verification

```bash
npm run benchmark:user-connections
# Expect allPass: true, all queries <= 500ms
```
