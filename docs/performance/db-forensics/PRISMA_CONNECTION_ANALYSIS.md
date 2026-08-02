# PRISMA_CONNECTION_ANALYSIS

Artifacts: `artifacts/prisma.json`, `artifacts/repeatability.json`, `artifacts/test-db-equivalent.json`, `artifacts/pg-*.json`

## Questions

| Question | Measured answer |
|----------|-----------------|
| New connection every execution? | **Yes, if a new `PrismaClient` is constructed and previous client disconnected** (test-db / new-client loops). |
| Reuse one connection? | **Yes, on the same `PrismaClient` instance** after the first query. |
| Reconnect every query on same client? | **No.** Warm queries stay ~300 ms. |

## Construction vs first query

From `artifacts/prisma.json`:

| Measurement | Value |
|-------------|-------|
| First `new PrismaClient()` construct | 292.084 ms |
| Later constructs | 9–81 ms |
| First `$queryRaw` on that client (includes connect) | **3061.029 ms** |
| Queries 2–5 same client | 286–328 ms (median of set including cold: 298.181 ms; cold dominates mean) |
| Prisma query-event durations | first 560 ms, then 277–294 ms |

Prisma’s query event duration for the first query (560 ms) is **much smaller** than wall clock (3061 ms). The gap is connection establishment outside/alongside the logged query event.

## Same client vs new client

From `artifacts/repeatability.json` (20 runs each):

| Mode | Median ms | Mean ms | P95 ms |
|------|-----------|---------|--------|
| Serial **same** PrismaClient | 304.460 | 449.476 | 2958.960 |
| Serial **new** PrismaClient each time (incl. disconnect in timer) | 2935.733 | 2901.847 | 3175.175 |
| Fresh client first-query only ×5 | 2737.185 | 2757.361 | 2895.502 |

Same-client P95 is inflated by the **first** cold sample (2958.96 ms) inside the 20-run series; warm samples cluster 278–408 ms.

## Parallel new clients

| Metric | Value |
|--------|-------|
| 10 parallel new clients wall | 5740.129 ms |
| Per-client median | 3244.976 ms |
| Per-client max | 5599.999 ms |

Parallelism does **not** hide connect cost; several clients stretch past 5 s (pooler/OS contention).

## Comparison to raw `pg`

| Path | Median / mean |
|------|----------------|
| `pg` new client connect | median 1763.524 ms |
| `pg` warm query | median 301.380 ms |
| `pg` connect + warm query | 2064.904 ms |
| Prisma cold query (test-db style, no disconnect in timer) | mean 2894.260 ms |
| Residual Prisma − pg | **829.356 ms** |

Prisma cold path is slower than an equivalent `pg` connect+query on the same `DATABASE_URL` by ~0.83 s (measured residual). Warm Prisma ≈ warm `pg`.

## Conclusion

`test-db.js` pays a **full new-connection tax** on every run because each process constructs a client and the first query opens TCP/TLS/auth. The ~3 s is **not** Prisma re-parsing SQL; it is connect-dominated, with an additional ~0.83 s beyond `pg` on the cold path.
