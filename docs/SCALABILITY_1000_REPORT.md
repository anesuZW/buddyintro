# Scalability Report — 1000 User Target

Generated: 2026-06-22T22:51:41.984Z

Benchmark user: `sim-0@simulation.buddyintro.test` · Port: 3010 · Warm runs: 3

## Message Context optimization (500 users)

| Metric | Before fix | After fix |
| ------ | ---------- | --------- |
| Prisma (warm) | 243ms | **74ms** at 500 users / **44ms** at 100 users |
| Server handler | 253ms | **56ms** at 500 users |

## Performance by scale

Trust Dashboard metrics are reflected in **Home** TTFB (SSR trust network section).

| Users | Home TTFB | Discoveries | Introductions | Profile | Msg Context Prisma | Msg Context Total |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 313 | 390 | 312 | 323 | **44** | 303 |
| 250 | 329 | 391 | 321 | 334 | **54** | 313 |
| 500 | 306 | 384 | 292 | 345 | **74** | 326 |
| 1000 | 320 | 398 | 302 | 347 | **119** | 380 |

## Dataset sizes

| Users | Stories | Discoveries | Messages | Notifications | Connections | Validation |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 1000 | 500 | 1000 | 1500 | 9886 | PASS 100/100 |
| 250 | 2500 | 1250 | 2500 | 3750 | 61050 | PASS 250/250 |
| 500 | 5000 | 2500 | 5000 | 7500 | 249500 | PASS 500/500 |
| 1000 | 10000 | 5000 | 10000 | 15000 | 999000 | PASS 1000/1000 |

## Loader validation (all users)

- **100 users:** PASS (100/100), seed 307s
- **250 users:** PASS (250/250), seed 187s
- **500 users:** PASS (500/500), seed 594s
- **1000 users:** PASS (1000/1000), seed 2108s (~35 min)

## Remaining bottlenecks

1. **Auth RTT (~250–280ms)** — fixed per request; dominates TTFB on all routes
2. **Seed/graph rebuild time** — super-linear with `user_connections` materialization
3. **Home/discoveries SSR** — flat vs user count once auth bound

---

*Raw: `docs/.scale-progression-results.json`, `docs/.scale-progression/{N}-benchmark.json`*
