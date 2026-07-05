# BuddyIntro Scalability Report

Generated: 2026-06-22T22:51:16.150Z

Server-side data-load proxies for SSR routes (Prisma timings on simulation dataset).

### 100 users (sampled 20)

| Route | p50 (ms) | p95 (ms) | max (ms) |
| --- | --- | --- | --- |
| home | 5 | 7 | 164 |
| discoveries | 5 | 8 | 10 |
| introductions | 3 | 7 | 17 |
| profile | 2 | 8 | 53 |
| messageContext | 1 | 4 | 13 |

Total sampled wall time: **606ms**

### 500 users (sampled 20)

| Route | p50 (ms) | p95 (ms) | max (ms) |
| --- | --- | --- | --- |
| home | 5 | 6 | 6 |
| discoveries | 4 | 6 | 8 |
| introductions | 2 | 4 | 7 |
| profile | 2 | 2 | 3 |
| messageContext | 2 | 4 | 5 |

Total sampled wall time: **322ms**

### 1,000 users (sampled 20)

| Route | p50 (ms) | p95 (ms) | max (ms) |
| --- | --- | --- | --- |
| home | 5 | 6 | 6 |
| discoveries | 4 | 5 | 5 |
| introductions | 2 | 4 | 9 |
| profile | 2 | 3 | 3 |
| messageContext | 2 | 3 | 3 |

Total sampled wall time: **312ms**

## Notes

- Timings measure database work equivalent to Home, Discoveries, Introductions, Profile, and Message context loaders.
- Scales use the first N simulation users (`sim-0` … `sim-{N-1}`).
- Re-run after schema/index changes: `npm run seed:simulation`
