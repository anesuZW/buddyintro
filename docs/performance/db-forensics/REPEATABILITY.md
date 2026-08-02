# REPEATABILITY

Artifact: `artifacts/repeatability.json`, `artifacts/test-db-equivalent.json`

## Prisma — 20× serial, same client

Includes first cold query in the series.

| Stat | ms |
|------|-----|
| min | 277.693 |
| median | 304.460 |
| mean | 449.476 |
| p95 | 2958.960 |
| p99 | 2958.960 |
| max | 2958.960 |

Warm cluster: 277–408 ms. Single cold sample (first) = 2958.96 ms drives p95/max.

## Prisma — 20× serial, new client each (construct + query + disconnect)

| Stat | ms |
|------|-----|
| min | 2653.191 |
| median | **2935.733** |
| mean | **2901.847** |
| p95 | 3175.175 |
| max | 3175.175 |

Stable cold band **~2.65–3.18 s**. Matches CTO ~3.07 s average.

## Prisma — 5× fresh client first query only

| Stat | ms |
|------|-----|
| min | 2585.091 |
| median | 2737.185 |
| mean | 2757.361 |
| max | 2895.502 |

## Prisma — 10× parallel new clients

| Stat | ms |
|------|-----|
| wall | 5740.129 |
| per-client median | 3244.976 |
| per-client mean | 4112.064 |
| per-client max | 5599.999 |

## pg — connect once, 20× warm SELECT NOW()

| Stat | ms |
|------|-----|
| connect (once) | 1885.361 |
| query min | 279.400 |
| query median | **299.830** |
| query mean | 298.155 |
| query p95 | 344.347 |
| query max | 344.347 |

## test-db equivalent (5 runs, query timer only)

| Stat | ms |
|------|-----|
| samples | 3091.6, 2773.6, 2684.9, 2692.9, 3228.3 |
| mean | **2894.260** |
| median | 2773.576 |

## Variance summary

| Path | Shape |
|------|-------|
| Cold new client | Tight around **~2.9 s** (CV low) |
| Warm reuse | Tight around **~300 ms** |
| Parallel cold | Higher tail (up to ~5.6 s) |

**Conclusion:** The 3 s number is **repeatable** for cold connect paths and **disappears** when the connection is reused.
