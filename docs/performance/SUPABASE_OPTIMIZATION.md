# Supabase Optimization Plan

**Sprint:** Performance Optimization Planning (READ-ONLY)  
**Generated:** 2026-07-26  
**Sources:** CONNECTION_AUDIT, DATABASE_PERFORMANCE_PROFILE, EXECUTION_PLAN_SUMMARY

---

## Latency Attribution

Based on isolated benchmarks and EXPLAIN ANALYZE (profiling sprint):

| Layer | Measured | Share of Prisma-reported time | Notes |
|-------|----------|-------------------------------|-------|
| **Pooler RTT** | SELECT 1 avg **455ms**, p95 **603ms**, spikes **3074ms** | **~95%** | Dominant factor |
| **PostgreSQL execution** | **0.05–0.18ms** per query | **<1%** | Not the bottleneck today |
| **Query planning** | **0.3–0.8ms** | **<1%** | Cold plan cache on pooler |
| **Supabase Auth** | **450–2300ms** per page (HTTP capture) | **5–15%** of wall time | Middleware + getUser fallback |
| **Prisma ORM** | Extension overhead ~2× `performance.now()` | **<2%** | Disabled in prod unless PROFILE_* |
| **Network (client ↔ app)** | Not measured separately | N/A | VPS deployment reduces vs localhost→us-east-1 |
| **Transactions** | Rare in read paths | **0%** on profiled pages | Writes use `$transaction` on create-story only |

### Formula

```
Perceived query time ≈ pooler_RTT + sql_execution + prisma_overhead
                     ≈ 455ms + 0.1ms + 2ms
                     ≈ 457ms

Page DB time ≈ query_count × pooler_RTT   (parallelism reduces wall time, not billable RTT)
```

---

## Current Configuration Issues

| Issue | Evidence | Impact |
|-------|----------|--------|
| `DIRECT_URL` = pooler host | CONNECTION_AUDIT | Migrations/EXPLAIN share pooler latency |
| No `pgbouncer=true` in DATABASE_URL | CONNECTION_AUDIT | Suboptimal Prisma + pooler interaction |
| No `connection_limit` param | CONNECTION_AUDIT | Pool exhaustion under concurrency |
| Dev machine → us-east-1 pooler | 455ms SELECT 1 | Inflates localhost measurements |
| 10× parallel SELECT 1 p95 **2733ms** | CONNECTION_AUDIT | Queueing under burst |

---

## Scenario Modeling

### Baseline (today)

| Page | Queries | RTT | Est. DB time |
|------|---------|-----|--------------|
| /home | 18 | 455ms | **8,190ms** |
| /discoveries | 12 | 455ms | **5,460ms** |
| /profile | 10 | 455ms | **4,550ms** |

### Scenario A: Pooler RTT → 40ms (no query reduction)

| Page | Queries | RTT | Est. DB time | vs baseline |
|------|---------|-----|--------------|-------------|
| /home | 18 | 40ms | **720ms** | **−91%** |
| /discoveries | 12 | 40ms | **480ms** | **−91%** |
| /profile | 10 | 40ms | **400ms** | **−91%** |

**How to achieve 40ms RTT:**
- Deploy app server in **same region** as Supabase project (aws-1-us-east-1)
- Use **Supavisor transaction mode** with correct connection string params
- Set `connection_limit=10` per instance; scale horizontally
- Monitor `pg_stat_activity` client_wait (observed **20** waiting)

### Scenario B: Query reduction only (keep 455ms RTT)

| Page | Queries | RTT | Est. DB time | vs baseline |
|------|---------|-----|--------------|-------------|
| /home | 10 | 455ms | **4,550ms** | **−44%** |
| /discoveries | 8 | 455ms | **3,640ms** | **−33%** |

### Scenario C: Both (target state)

| Page | Queries | RTT | Est. DB time | vs baseline |
|------|---------|-----|--------------|-------------|
| /home | 10 | 40ms | **400ms** | **−95%** |
| /discoveries | 8 | 40ms | **320ms** | **−94%** |
| /profile | 7 | 40ms | **280ms** | **−94%** |

---

## DIRECT_URL vs Pooler Strategy

**DO NOT IMPLEMENT — planning only**

| Workload | Connection | Rationale |
|----------|------------|-----------|
| **SSR read queries (all pages)** | **Pooler** (DATABASE_URL) | Many short queries; pooling essential |
| **API read endpoints** | **Pooler** | Same pattern |
| **Health lite probe** | **Pooler** | Already optimized |
| **Migrations** | **Direct** (non-pooler session) | DDL unsupported on transaction pooler |
| **EXPLAIN ANALYZE / DBA scripts** | **Direct** | Accurate plans; no pooler queue |
| **Background jobs (long transactions)** | **Direct** | Avoid holding pooler slots |
| **Bulk rebuild (user_connections)** | **Direct** | Long-running; never in request path |
| **Analytics batch insert worker** | **Pooler** | Short writes; high concurrency |
| **Media workers** | **Pooler** | Short metadata lookups |

### Proposed env split

```
DATABASE_URL=postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10
DIRECT_URL=postgresql://...db.supabase.co:5432/postgres
```

**Expected improvement:** SSR unchanged on pooler (but faster RTT from region). DBA/migrations no longer pollute pooler metrics.

---

## Endpoints That Must Stay Pooled

All user-facing HTTP handlers:

- `/home`, `/discoveries`, `/profile`, `/introductions`, `/messages`
- `/api/discoveries`, `/api/messages`, `/api/introductions`
- `/api/notifications/*`
- Layout badge queries (3 counts per request)

**Reason:** 10–18 round-trips/request; direct connections would exhaust Postgres `max_connections` at low concurrency.

---

## Authentication Latency

| Path | Observed | Optimization |
|------|----------|--------------|
| Middleware `updateSession` | Included in middleware timing | Already runs once |
| `getAuthUser` via trusted headers | **0ms** supabase | Ensure middleware always sets headers — **SAFE** |
| `getAuthUser` Supabase fallback | **450–700ms** | Fix header propagation → eliminate fallback |
| `User.findUnique` after auth | **455ms** | Cannot eliminate; already cached |

**Target auth segment:** **<100ms** (header path only + 1 prisma RTT at 40ms)

---

## Transaction Duration

| Path | Type | Duration concern |
|------|------|------------------|
| `createStoryWithTags` | Interactive `$transaction` | Multiple RTTs inside txn — hold pooler slot longer |
| Read pages | No transactions | N/A |
| `sendMessage` | Single inserts | Short |

**Recommendation (next sprint):** Keep story creation on pooler but minimize queries inside transaction (already batched). Monitor transaction duration via Prisma logging.

---

## Supabase Cost Model

| Cost driver | Current | After optimization |
|-------------|---------|-------------------|
| Query count × instances | High (12–18/page) | **−40%** query reduction |
| Pooler compute | Proportional to connections | **−30%** with connection_limit tuning |
| Egress | Low (small rows) | Unchanged |
| Auth MAU | Unchanged | Unchanged |

**Estimated Supabase DB cost reduction:** **35–50%** at same traffic (fewer round-trips + less pool contention).

---

## Monitoring Checklist (Post-Implementation)

| Metric | Tool | Alert threshold |
|--------|------|-----------------|
| Pooler RTT p95 | `check-db-latency.ts` cron | >100ms production |
| Active connections | Supabase dashboard | >80% pool |
| client_wait | pg_stat_activity | >5 sustained |
| Query count/request | PROFILE_PRODUCTION headers | >12 on /home |
| Sequential scans | pg_stat_user_tables | seq_scan > idx_scan × 10 at >10k rows |

---

## What Will NOT Improve from Supabase Alone

- Query duplication on `/home` (4× StoryTag) — application fix required
- Analytics blocking SSR — application deferral required
- Dev cold-compile TTFB — Next.js dev mode only; measure on production build
