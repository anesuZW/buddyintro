# Load testing

BuddyIntro uses a **custom TypeScript load runner** (no k6/Artillery installed on this host).

## Tooling

| Component | Path |
| --------- | ---- |
| Auth pool (pre-login sim users) | `lib/load-test/auth-pool.ts` |
| HTTP sampler + bench headers | `lib/load-test/http-client.ts` |
| Stats (p95, p99, RPS) | `lib/load-test/stats.ts` |
| Orchestrator | `scripts/run-concurrency-test.ts` |

Optional: `autocannon` listed in devDependencies for ad-hoc single-route probes.

## Prerequisites

```bash
npm run build
npm run seed:simulation -- --reset --users=1000   # or existing sim data
```

## Run

```bash
npm run load:concurrency
npm run load:concurrency -- --skip-start --port=3010
npm run load:concurrency -- --quick   # shorter durations (smoke)
```

Uses `sim-0@simulation.buddyintro.test` … `sim-99@simulation.buddyintro.test` with password `SimPass123!`. Sessions are created **once** before load — no auth storm during tests.

## Full load investigation (Phases 1–7)

```bash
npm run load:investigation
npm run load:investigation -- --quick
npm run load:investigation -- --skip-build --port=3010
npm run load:investigation -- --reports-only --merge-concurrency
npm run load:investigation -- --resume --phase=leak
```

Outputs: `docs/PERFORMANCE_BASELINE.md`, `MEMORY_LEAK_REPORT.md`, `PRISMA_BOTTLENECK_REPORT.md`, `CAPACITY_LIMIT_REPORT.md`, `CRASH_ANALYSIS.md`, `HOSTING_READINESS.md`, `OPTIMIZATION_ROADMAP.md`, `BUDDYINTRO_SCALE_ASSESSMENT.md`, and `docs/.load-investigation-results.json`.

Runtime metrics require `PROFILE_PRODUCTION=1` and `/api/bench/runtime` (included in production build).

