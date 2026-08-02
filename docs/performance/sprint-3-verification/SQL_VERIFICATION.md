# SQL Verification — Sprint 3 Modified Queries

**Generated:** 2026-07-26T18:05:00.000Z  
**Evidence:** HISTORICAL DATA from `docs/performance/.profile-data.json` EXPLAIN ANALYZE (2026-07-26)  
**Live re-run:** **BLOCKED** — `profile:database` connection audit failed intermittently (pooler); dev-server queries succeeded

---

## Scope

Sprint 3 **did not change SQL text** for unchanged query paths. It **removed** queries and **broadened** two StoryTag scans (removed `take:20`, removed separate filters). No Prisma schema changes for Sprint 3 home pipeline.

---

## Query A — StoryTag scan (viewer-authored) — NEW SHAPE

| Field | Before (suggestion query) | After (consolidated scan A) |
| --- | --- | --- |
| **Filter** | `story.userId = X AND status=published AND taggedUserId NOT NULL` | `story.userId = X` (all statuses) |
| **LIMIT** | `take: 20` | **None** (full scan) |
| **orderBy** | None | None |

### After plan (representative — HISTORICAL)

From `StoryTag.findMany (tagged_user_id)` template in `.profile-data.json`:

| Metric | Value |
| --- | --- |
| Planning time | 0.576 ms |
| Execution time | 0.049 ms (DB-local; pooler adds ~300–600ms) |
| Actual rows | 1 (test user subset) |
| Scan type | Seq Scan on `story_tags` |
| Indexes used | None (seq scan) |
| Bitmap / nested loop / hash | None |

**Interpretation:** SQL execution is fast locally; observed 612ms runtime = pooler RTT dominated (established fact).

---

## Query B — StoryTag scan (viewer-tagged) — NEW SHAPE

| Field | Before | After |
| --- | --- | --- |
| **Filter** | `taggedUserId = X AND story.status = published` | `taggedUserId = X` (all statuses) |
| **LIMIT** | `take: 20` | **None** |

**Runtime:** 4,600ms on request `2afc354d` — larger row set + pooler latency.

**Before vs after plan:** Same seq-scan pattern expected; after fetches more rows in one round trip vs prior LIMIT 20.

---

## Removed queries — visibility prefetch (2× StoryTag.findMany)

| Field | Before | After |
| --- | --- | --- |
| **Execution** | 2 queries per `filterStoriesByVisibilityGate` | **0** on home (in-memory sets) |
| **Plan** | Seq scan + filter on `tagged_user_id` / join | Not executed |

**Impact:** −2 round trips; no plan change (queries eliminated).

---

## Removed queries — trust stats (2× count + 2× findMany)

| Operation | Before plan type | After |
| --- | --- | --- |
| `StoryTag.count` ×2 | Aggregate seq scan | **Not executed** on home |
| `StoryTag.findMany distinct` ×2 | Seq scan + distinct | **Not executed** on home |

---

## Unchanged queries — Story.findMany (5×)

Historical plan (`Story.findMany published`):

| Metric | Value |
| --- | --- |
| Planning time | 0.495 ms |
| Execution time | 0.178 ms |
| Actual rows | 20 |
| Scan | Seq Scan + Sort (`created_at DESC`) |
| Indexes | None on status filter |

Sprint 3 did not modify these SQL shapes.

---

## Summary table

| Query group | Before plans | After plans | SQL change |
| --- | --- | --- | --- |
| Home StoryTag scans | 4× LIMIT 20 / filtered | 2× full scan | **Yes** — broader filters, no LIMIT |
| Visibility StoryTag | 2× per request | 0 on home | **Removed** |
| Trust StoryTag | 4× per request | 0 on home | **Removed** |
| Story.findMany | 5× unchanged | 5× unchanged | **No** |
| Layout counts | 3× unchanged | 3× unchanged | **No** |

---

## Live EXPLAIN status

| Item | Status |
| --- | --- |
| Re-run EXPLAIN on consolidated Scan A/B | **BLOCKED** (script PrismaClient connection failure) |
| Historical EXPLAIN validity | Valid for seq-scan/index patterns; row counts differ for full scans |

See `RUNTIME_LIMITATIONS.md`.
