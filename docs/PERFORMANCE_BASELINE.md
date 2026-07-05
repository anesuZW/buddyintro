# Performance Baseline

Generated: 2026-06-23T07:18:42.260Z

Environment: `next start` @ `http://localhost:3011` · `PROFILE_PRODUCTION=1` · Auth pool: 100 users

---

## Load profile

| Setting | Value |
| ------- | ----- |
| Concurrency | 25 VUs |
| Duration | 120s |
| Snapshot interval | 5s |
| Total requests | 3810 |
| Throughput | 31.75 req/s |
| Error rate | 0.00% |
| p50 / p95 / p99 | 573 / 1469 / 5822 ms |

---

## Process metrics (peak under load)

| Metric | Peak |
| ------ | ---- |
| Heap used | 216.4 MB |
| RSS | 350.4 MB |
| Event loop lag (max) | 720.37 ms |
| CPU (sample window) | 180.4% |

---

## Route timings @ 25 VUs

| Route | Count | p50 | p95 | p99 | Auth avg | Prisma avg | Err% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /api/discoveries | 566 | 577 | 1324 | 2829 | 524 | 3 | 0.00% |
| /api/introductions | 567 | 563 | 1416 | 4657 | 533 | 27 | 0.00% |
| /api/messages/[userId]/context | 520 | 569 | 1467 | 4229 | 529 | 84 | 0.00% |
| /api/profile/insights | 556 | 581 | 1448 | 2618 | 531 | 12 | 0.00% |
| /discoveries | 532 | 576 | 1476 | 6868 | 531 | 0 | 0.00% |
| /home | 545 | 565 | 1740 | 7501 | 529 | 0 | 0.00% |
| /profile | 524 | 578 | 1579 | 7367 | 540 | 0 | 0.00% |

---

## 5-second snapshots (first 40)

| Time | Heap MB | RSS MB | EL lag max | CPU % | Handles | Active req | Prisma q | Auth ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0s | 77.9 | 122 | 514.59 | 1.2 | 39 | 5 | 4 | 0 |
| 5s | 105.6 | 278.3 | 720.37 | 180.4 | 29 | 0 | 636 | 0 |
| 10s | 185.8 | 332.5 | 74.45 | 55.9 | 20 | 0 | 923 | 0 |
| 15s | 216.4 | 345.4 | 86.77 | 52.5 | 20 | 0 | 1016 | 0 |
| 20s | 94.2 | 347.1 | 114.29 | 53.3 | 17 | 0 | 1107 | 0 |
| 25s | 97.5 | 350.4 | 86.84 | 43.1 | 13 | 0 | 1180 | 0 |
| 30s | 84.3 | 264.7 | 445.91 | 49.5 | 15 | 0 | 7133 | 0 |
| 35s | 93.6 | 265.4 | 55.05 | 51 | 13 | 0 | 7194 | 0 |
| 40s | 126.1 | 266.1 | 93.13 | 52 | 11 | 0 | 7346 | 0 |
| 45s | 99.7 | 266.7 | 122.49 | 54.5 | 13 | 0 | 7613 | 0 |
| 50s | 91 | 266.9 | 580.39 | 55.3 | 22 | 0 | 12950 | 0 |
| 55s | 128.6 | 294.5 | 602.93 | 57.7 | 22 | 0 | 13712 | 0 |
| 60s | 125.4 | 299.1 | 194.12 | 53.6 | 16 | 0 | 14766 | 0 |

---

## Instrumentation

| Signal | Source |
| ------ | ------ |
| Heap / RSS | `process.memoryUsage()` via `/api/bench/runtime` |
| Event loop lag | `perf_hooks.monitorEventLoopDelay` |
| CPU | `process.cpuUsage()` delta per interval |
| Active handles | `process._getActiveHandles()` |
| Active requests | `runWithPerf` counter |
| Prisma queries | Prisma extension → runtime histogram |
| Middleware auth | Middleware timing → runtime aggregate |
| Route timings | `x-bench-*` headers + perf store |

*Raw JSON: `docs/.load-investigation-results.json` → `baseline`*
