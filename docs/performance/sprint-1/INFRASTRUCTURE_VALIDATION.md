# Infrastructure Validation

**Sprint:** 1 — Infrastructure Validation  
**Generated:** 2026-07-26T07:19:50.247Z  
**Mode:** READ-ONLY — no code changes, no optimizations  
**Git checkpoint:** `checkpoint/sprint-1-infra-start` @ ref: re

---

## Executive Summary

Latency in the BuddyIntro development environment originates **overwhelmingly from network round-trip time to the Supabase pooler**, not from PostgreSQL query execution or Prisma ORM overhead.

| Finding | Evidence |
|---------|----------|
| Pooler dominates | Prisma SELECT 1 p50 **305ms** (avg 612ms inflated by spikes) vs SQL execution **0.037ms** |
| DIRECT_URL = DATABASE_URL | Both point to **same pooler host** — no direct session path configured |
| Prisma overhead | **~10ms** above raw pg at p50 (negligible vs RTT) |
| Local/VPS Postgres | Not configured / Not configured |

**Conclusion:** Application optimizations (Sprints 2–5) will multiply on lower RTT. **Sprint 1 recommends fixing connection topology before code changes.**

---

## Checkpoint

| Item | Value |
|------|-------|
| Branch | `checkpoint/sprint-1-infra-start` |
| HEAD | ref: refs/heads/performance-recovery-sprint |
| Captured | 2026-07-26T07:19:50.243Z |
| Benchmark runs | 10 per test |
| Prior profile baseline | SELECT 1 avg 455ms (profiling sprint) |

---

## Phase Coverage

| Phase | Document |
|-------|----------|
| Connection benchmarks | [DATABASE_CONNECTION_BENCHMARK.md](./DATABASE_CONNECTION_BENCHMARK.md) |
| Network probes | [NETWORK_LATENCY_REPORT.md](./NETWORK_LATENCY_REPORT.md) |
| Prisma overhead | [PRISMA_OVERHEAD.md](./PRISMA_OVERHEAD.md) |
| Recommendations | [RECOMMENDATION.md](./RECOMMENDATION.md) |

---

## Page Benchmark Status

**Server not available** — page TTFB from prior profiling sprint HTTP capture used as reference

Prior HTTP capture (profiling sprint, dev compile included):

| Page | TTFB | Total |
| --- | --- | --- |
| /home | 29890 | 34418 |
| /discoveries | 16637 | 16670 |
| /messages | 5664 | 6041 |
| /introductions | 12381 | 12409 |
| /profile | 16017 | 16029 |
| /create-story | 9350 | 9664 |
| /maindash | 5906 | 5919 |

---

## Query Count Baseline (Planning Sprint)

| Page | Est. Prisma queries |
| --- | --- |
| home | 18 |
| discoveries | 12 |
| profile | 10 |
| introductions | 8 |
| messages | 9 |

---

## Next Sprint Gate

Sprint 2 (Auth Optimization) must **not** begin until this report is reviewed and connection recommendations are scheduled.

**No RC1/RC2 required for Sprint 1** (measurement only, no code changes).
