# POSTGRES_ANALYSIS

Artifact: `artifacts/explain.json`, warm-query stats in `pg-reuse-client.json` / `repeatability.json`

## Statement

```sql
SELECT NOW();
```

## EXPLAIN (ANALYZE, FORMAT JSON)

Measured after a fresh `pg` connect (connect itself 1756.464 ms — excluded from SQL timing).

| Metric | Value |
|--------|-------|
| Client-observed query wall | 289.686 ms |
| Planning Time | **0.024 ms** |
| Execution Time | **0.032 ms** |
| Actual Total Time | **0.002 ms** |
| Shared Hit/Read blocks | 0 |
| Node | `Result` |

## Interpretation

- Server-side planning + execution for `SELECT NOW()` is **< 0.1 ms**.
- Client wall ~290–310 ms on a warm connection is **network RTT + protocol framing**, not Postgres compute.
- Buffer I/O is irrelevant (no buffer reads).

## Connection wait on server

Not exposed without Supabase/pg_stat privileges. Proxy measurement:

- Time after TLS-ready inside `pg.connect`: **327.582 ms** median (`pg-ssl-derived.json`).
- That is an upper bound on auth + pooler/server accept work for this probe — **not** multi-second.

## Confirmation

**PostgreSQL SQL execution is negligible.** The 3 s cold path is outside the executor.
