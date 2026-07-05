# Concurrency Test Report

Generated: 2026-06-23T05:18:53.346Z

Base URL: `http://localhost:3010`  
Auth pool: 100 pre-authenticated simulation users (no per-request sign-in)

---

## Phase 1 — Load testing tooling audit

| Tool | Status | Notes |
| ---- | ------ | ----- |
| **k6** | Not installed | Not on PATH; not required |
| **Artillery** | Not installed | — |
| **autocannon** | In `devDependencies` | Ad-hoc single-route probes |
| **Playwright load** | None | — |
| **Custom runner** | **`npm run load:concurrency`** | Primary infrastructure |

Infrastructure: `lib/load-test/*` + `scripts/run-concurrency-test.ts`. Auth pool caches 100 simulation sessions in `docs/.load-test-auth-pool.json` (no per-request sign-in).

---

## Summary chart

| Concurrency | Mode | RPS | Median ms | p95 ms | Error % |
| --- | --- | --- | --- | --- | --- |
| 10 | routes | 25.68 | 339 | 527 | 0.00% |
| 25 | routes | 40.72 | 520 | 1035 | 0.00% |
| 50 | routes | 39.75 | 981 | 2449 | 0.00% |
| 100 | routes | 39.08 | 1782 | 5284 | 0.00% |
| 25 | journey | 12.56 | 338 | 448 | 0.00% |
| 50 | journey | 22.41 | 362 | 2709 | 20.25% |
| 100 | journey | 60.42 | 6 | 12 | 100.00% |

---

## Phase 3 — Route load tests

Duration: 60s per concurrency level · Routes: home, discoveries, profile, APIs

### 10 concurrent users (60s)

| Metric | Value |
| ------ | ----- |
| Total requests | 1541 |
| Throughput | 25.68 req/s |
| Error rate | 0.00% |
| Avg latency | 370ms |
| Median | 339ms |
| p95 | 527ms |
| p99 | 874ms |

| Route | Count | RPS | Avg | p95 | p99 | Err% | Auth | Prisma |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/discoveries | 228 | 3.8 | 323 | 398 | 555 | 0.00% | 283 | 5 |
| /api/introductions | 216 | 3.6 | 314 | 363 | 549 | 0.00% | 286 | 21 |
| /api/messages/[userId]/context | 212 | 3.53 | 381 | 491 | 764 | 0.00% | 285 | 133 |
| /api/profile/insights | 225 | 3.75 | 298 | 341 | 446 | 0.00% | 279 | 4 |
| /discoveries | 229 | 3.82 | 428 | 641 | 1750 | 0.00% | 295 | 0 |
| /home | 224 | 3.73 | 448 | 634 | 934 | 0.00% | 283 | 0 |
| /profile | 207 | 3.45 | 396 | 534 | 887 | 0.00% | 290 | 0 |

### 25 concurrent users (60s)

| Metric | Value |
| ------ | ----- |
| Total requests | 2443 |
| Throughput | 40.72 req/s |
| Error rate | 0.00% |
| Avg latency | 598ms |
| Median | 520ms |
| p95 | 1035ms |
| p99 | 1398ms |

| Route | Count | RPS | Avg | p95 | p99 | Err% | Auth | Prisma |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/discoveries | 373 | 6.22 | 428 | 582 | 899 | 0.00% | 311 | 18 |
| /api/introductions | 336 | 5.6 | 388 | 517 | 651 | 0.00% | 312 | 73 |
| /api/messages/[userId]/context | 373 | 6.22 | 570 | 789 | 1340 | 0.00% | 311 | 385 |
| /api/profile/insights | 325 | 5.42 | 365 | 464 | 634 | 0.00% | 311 | 18 |
| /discoveries | 350 | 5.83 | 800 | 1089 | 1458 | 0.00% | 317 | 0 |
| /home | 329 | 5.48 | 869 | 1233 | 1607 | 0.00% | 307 | 0 |
| /profile | 357 | 5.95 | 767 | 1209 | 1476 | 0.00% | 316 | 0 |

### 50 concurrent users (60s)

| Metric | Value |
| ------ | ----- |
| Total requests | 2385 |
| Throughput | 39.75 req/s |
| Error rate | 0.00% |
| Avg latency | 1241ms |
| Median | 981ms |
| p95 | 2449ms |
| p99 | 2885ms |

| Route | Count | RPS | Avg | p95 | p99 | Err% | Auth | Prisma |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/discoveries | 318 | 5.3 | 652 | 881 | 1050 | 0.00% | 388 | 45 |
| /api/introductions | 361 | 6.02 | 565 | 769 | 952 | 0.00% | 385 | 179 |
| /api/messages/[userId]/context | 356 | 5.93 | 981 | 1283 | 1530 | 0.00% | 393 | 893 |
| /api/profile/insights | 340 | 5.67 | 517 | 682 | 892 | 0.00% | 386 | 45 |
| /discoveries | 341 | 5.68 | 1863 | 2386 | 2716 | 0.00% | 397 | 0 |
| /home | 362 | 6.03 | 2251 | 2922 | 3217 | 0.00% | 394 | 0 |
| /profile | 307 | 5.12 | 1871 | 2405 | 2857 | 0.00% | 380 | 0 |

### 100 concurrent users (60s)

| Metric | Value |
| ------ | ----- |
| Total requests | 2345 |
| Throughput | 39.08 req/s |
| Error rate | 0.00% |
| Avg latency | 2567ms |
| Median | 1782ms |
| p95 | 5284ms |
| p99 | 5995ms |

| Route | Count | RPS | Avg | p95 | p99 | Err% | Auth | Prisma |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| /api/discoveries | 332 | 5.53 | 1157 | 1485 | 2652 | 0.00% | 550 | 102 |
| /api/introductions | 349 | 5.82 | 965 | 1369 | 2283 | 0.00% | 554 | 407 |
| /api/messages/[userId]/context | 345 | 5.75 | 1916 | 2869 | 3515 | 0.00% | 574 | 2019 |
| /api/profile/insights | 327 | 5.45 | 867 | 1276 | 2133 | 0.00% | 557 | 102 |
| /discoveries | 318 | 5.3 | 4033 | 4917 | 5157 | 0.00% | 557 | 0 |
| /home | 339 | 5.65 | 5001 | 6014 | 6708 | 0.00% | 547 | 0 |
| /profile | 335 | 5.58 | 4107 | 4983 | 5398 | 0.00% | 568 | 0 |

---

## Phase 4 — Mixed user journeys

Duration: 300s · Flow: Home → Discoveries → Profile → Message Context → Introductions

### 25 concurrent users (300s journey)

| Metric | Value |
| ------ | ----- |
| Total requests | 3768 |
| Throughput | 12.56 req/s |
| Error rate | 0.00% |
| Avg latency | 354ms |
| p95 | 448ms |
| p99 | 697ms |

| Route | Avg | p95 | Err% |
| --- | --- | --- | --- |
| /api/messages/[userId]/context | 339 | 406 | 0.00% |
| /discoveries | 361 | 447 | 0.00% |
| /home | 400 | 558 | 0.00% |
| /introductions | 324 | 393 | 0.00% |
| /profile | 344 | 417 | 0.00% |

### 50 concurrent users (300s journey)

| Metric | Value |
| ------ | ----- |
| Total requests | 6722 |
| Throughput | 22.41 req/s |
| Error rate | 20.25% |
| Avg latency | 584ms |
| p95 | 2709ms |
| p99 | 5132ms |

| Route | Avg | p95 | Err% |
| --- | --- | --- | --- |
| /api/messages/[userId]/context | 474 | 1416 | 20.61% |
| /discoveries | 624 | 3439 | 19.96% |
| /home | 762 | 3371 | 19.52% |
| /introductions | 491 | 1508 | 20.53% |
| /profile | 562 | 3208 | 20.64% |

### 100 concurrent users (300s journey)

| Metric | Value |
| ------ | ----- |
| Total requests | 18126 |
| Throughput | 60.42 req/s |
| Error rate | 100.00% |
| Avg latency | 8ms |
| p95 | 12ms |
| p99 | 34ms |

| Route | Avg | p95 | Err% |
| --- | --- | --- | --- |
| /api/messages/[userId]/context | 6 | 11 | 100.00% |
| /discoveries | 7 | 11 | 100.00% |
| /home | 13 | 17 | 100.00% |
| /introductions | 6 | 11 | 100.00% |
| /profile | 6 | 11 | 100.00% |

---

## Phase 5 — Bottleneck analysis

| Severity | Bottleneck | Measured evidence |
| -------- | ---------- | ----------------- |
| **P0** | Supabase Auth RTT | Auth ~283ms @ 10 VUs → **574ms** @ 100 VUs (middleware queueing) |
| **P0** | Single Node event loop | Throughput plateaus ~40 RPS; p95 **5284ms** @ 100 VUs |
| **P1** | Message Context under load | Prisma **133ms** @ 10 VUs → **2019ms** @ 100 VUs (connection queue) |
| **P1** | SSR page routes | `/home` p95 **6014ms** @ 100 VUs (worst endpoint) |
| **P1** | Journey saturation | **20% errors** @ 50 VUs sustained 5 min |
| **P2** | Server crash under stress | **100% errors** @ 100 VU journey (connection refused, ~6ms) |
| **P3** | No horizontal scaling | One `next start` process |

### Latency growth (route tests, aggregate p95)

```
 10 VUs ──► 527ms
 25 VUs ──► 1035ms
 50 VUs ──► 2449ms
100 VUs ──► 5284ms
```

### Worst / best endpoints @ 100 VUs (route test, 60s)

| Rank | Route | p95 | Prisma avg |
| ---- | ----- | --- | ---------- |
| Worst | `/home` | **6014ms** | 0 |
| | `/discoveries` | 4917ms | 0 |
| | `/api/messages/[userId]/context` | 2869ms | **2019ms** |
| Best | `/api/profile/insights` | 1276ms | 102ms |
| | `/api/discoveries` | 1485ms | 102ms |

---

## Recommendations

1. Colocate compute with Supabase eu-west-1 (auth RTT)
2. Use Supabase pooler + raised connection limit on VPS
3. Run 2+ Node instances behind reverse proxy for >50 concurrent
4. Cache auth session locally (JWT verify) to remove per-request `getUser()` RTT

---

*Raw: `docs/.concurrency-test-results.json`*
