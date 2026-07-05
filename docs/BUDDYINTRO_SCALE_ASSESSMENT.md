# BuddyIntro Scale Assessment

Generated: 2026-06-23T07:18:42.260Z

Executive summary from automated load investigation (Phases 1–7).

---

## Key findings

| Dimension | Result |
| --------- | ------ |
| **Maximum safe concurrency** | **25 VUs** (single instance) |
| **Likely launch capacity** | **25 concurrent / 500–800 DAU** on VPS 2GB |
| **Likely bottleneck** | **Supabase Auth RTT (~524ms) + single Node event loop** |
| **Memory health** | **stable** (47.5 MB heap / 177.1 MB RSS over 30 min) |
| **Database health** | Prisma OK at 1000 users sequential; queueing under **50+ VUs** |
| **Breaking point** | **100 VUs** (access-violation) |

---

## Latency under load

| Scenario | p95 |
| -------- | --- |
| Baseline 25 VUs | 1469 ms |
| Capacity warning zone | 2709 ms @ 50 VUs |
| At breaking point | 12 ms |

---

## Hosting recommendation

**Launch:** Small VPS (2–4 GB) in **eu-west-1** (same region as Supabase) + pooler.

**Avoid:** Single shared-hosting PHP-style deployment for >15 concurrent users.

**Scale path:** Auth optimization → 2 Node workers → read replicas at 10k+ MAU.

---

## Reports

| Phase | Document |
| ----- | -------- |
| 1 Baseline | [PERFORMANCE_BASELINE.md](./PERFORMANCE_BASELINE.md) |
| 2 Memory | [MEMORY_LEAK_REPORT.md](./MEMORY_LEAK_REPORT.md) |
| 3 Prisma | [PRISMA_BOTTLENECK_REPORT.md](./PRISMA_BOTTLENECK_REPORT.md) |
| 4 Capacity | [CAPACITY_LIMIT_REPORT.md](./CAPACITY_LIMIT_REPORT.md) |
| 5 Crash | [CRASH_ANALYSIS.md](./CRASH_ANALYSIS.md) |
| 6 Hosting | [HOSTING_READINESS.md](./HOSTING_READINESS.md) |
| 7 Roadmap | [OPTIMIZATION_ROADMAP.md](./OPTIMIZATION_ROADMAP.md) |

*Raw measurements: `docs/.load-investigation-results.json`*
