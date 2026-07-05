# Simulation & Benchmark Tooling Audit

Generated: 2026-06-22  
Purpose: Pre-flight inspection for progressive scalability testing (50 → 500 users).

---

## 1. npm scripts verified

| Command | Script target | Status |
| ------- | ------------- | ------ |
| `npm run seed:simulation` | `tsx prisma/seed-simulation.ts` | Present |
| `npm run profile:production` | `tsx scripts/profile-production.ts` | Present |
| `npm run build` | `prisma generate && next build` | Present |
| `npm run start` | `next start` | Present |

Additional related scripts:

| Command | Purpose |
| ------- | ------- |
| `npm run profile:middleware-auth` | Middleware auth segment timing |
| `npm run audit:region-latency` | Supabase RTT audit |
| `npm run rebuild-connections` | Manual graph rebuild (uses `server-only`; broken in tsx — simulation uses `lib/simulation/graph-rebuild.ts` instead) |

---

## 2. `prisma/seed-simulation.ts`

### CLI arguments

| Flag | Effect |
| ---- | ------ |
| `--reset` | Delete all `*@simulation.buddyintro.test` users (Prisma cascade + Supabase auth) before seeding |
| `--skip-validation` | Skip per-user loader validation |
| `--validate-sample=N` | Validate N users instead of all (default: all users when flag absent) |
| `--users=N` | Scale dataset (default 1000). Content volumes scale linearly via `resolveTargets(N)` |

### Default credentials

- Email pattern: `sim-{index}@simulation.buddyintro.test`
- Password: `SimPass123!` (`lib/simulation/constants.ts`)

### Pipeline (single command)

1. Optional reset (`deleteSimulationUsers`)
2. Build personas + communities (`buildSimulationPlan`)
3. Supabase auth user creation + Prisma upsert (batched, 25 concurrent)
4. Bulk insert stories, discoveries, messages, notifications
5. Trust graph rebuild (`lib/simulation/graph-rebuild.ts` — no `server-only`)
6. Validation (`validateSimulationUsers` + `assertRecommendationEngine`)
7. Internal Prisma route benchmarks (`runScaleBenchmarks`)
8. Report generation

### Exit codes

- **0** — validation passed, user count ≥ target
- **1** — validation failed or missing users

---

## 3. `lib/simulation/*` modules

| File | Role |
| ---- | ---- |
| `constants.ts` | Targets, markers, `resolveTargets()` scaling |
| `personas.ts` | 20 communities + bridge users, regional personas |
| `content-plan.ts` | Stories, discoveries, messages, notifications (deterministic RNG). **Guaranteed** community star/anchor stories + 8 bridge→hub stories are seeded *before* budget-limited random fill so every user (including bridges) passes validation at 500+ users. |
| `seed.ts` | Bulk insert orchestration |
| `graph-rebuild.ts` | `user_connections` + shared introducers + trust scores |
| `validate.ts` | Per-user feed/discovery/suggestions/trust/insights checks |
| `benchmark.ts` | Prisma proxy timings for SSR-equivalent loaders |
| `reports.ts` | `SIMULATION_REPORT.md`, `SCALABILITY_REPORT.md` writers |
| `env.ts` | Env loading, plain `PrismaClient`, Supabase admin, reset |

### Validation checks (per user)

| Loader | Pass criteria |
| ------ | ------------- |
| Home feed | No error; fails if outgoing intros exist but mutual feed empty |
| Discoveries | Network query completes; warns if no posts in network |
| Introduction suggestions | Query completes |
| Trust dashboard | Has graph data (connections or intro tags) |
| Profile insights | Trust score not null when connection exists |

### Global assertions

- No self-links in `user_connections`
- Recommendation engine smoke test (Prisma query, no crash)

---

## 4. `scripts/profile-production.ts`

### CLI arguments

| Flag | Default | Effect |
| ---- | ------- | ------ |
| `--port=N` | 3005 | Production server port |
| `--base=URL` | `http://localhost:{port}` | Benchmark base URL |
| `--runs=N` | 3 | Warm runs per route (median) |
| `--email=addr` | `user1@friendintro.com` | Auth user for session cookie |
| `--password=pw` | `123456` | Password |
| `--skip-build` | off | Skip `npm run build` |
| `--skip-start` | off | Assume server already running with `PROFILE_PRODUCTION=1` |
| `--compare-dev` | off | Also benchmark dev server |
| `--dev-base=URL` | `http://localhost:3000` | Dev server URL |

### Environment

- Sets `PROFILE_PRODUCTION=1` when starting server (enables `x-bench-*` headers)
- Loads `.env.local` then `.env`

### Routes benchmarked (warm + cold)

| Label | Path | Kind |
| ----- | ---- | ---- |
| `/home` | `/home` | page |
| `/discoveries` | `/discoveries` | page |
| `/introductions` | `/introductions` | page |
| `/profile` | `/profile` | page |
| `/api/discoveries` | `/api/discoveries` | api |
| `/api/introductions` | `/api/introductions?group=recent` | api |
| `/api/messages/[userId]/context` | dynamic | api |
| `/api/profile/insights` | `/api/profile/insights` | api |

### Metrics captured (per route)

- **Client:** `ttfbMs`, `totalMs`
- **Server headers:** `authMs`, `prismaMs`, `externalMs`, `serializeMs`, `serverTotalMs`
- Page routes also pull segments from `/api/bench/metrics/{requestId}` when headers incomplete

### Output locations

| Artifact | Path |
| -------- | ---- |
| JSON results | `docs/.production-benchmark.json` |
| Markdown report | `docs/PRODUCTION_BENCHMARK_REPORT.md` |

Structure: `{ production: { cold: RouteResult[], warm: RouteResult[] } }`

### Server lifecycle

- Kills port before start (Windows: `Get-NetTCPConnection`)
- Spawns `npm run start -- -p {PORT}` with `PROFILE_PRODUCTION=1`
- Waits for `/api/health`
- Stops server in `finally` block

---

## 5. Simulation report locations

| Report | Path | When written |
| ------ | ---- | ------------ |
| Simulation summary | `docs/SIMULATION_REPORT.md` | After `seed:simulation` |
| Prisma scale proxy | `docs/SCALABILITY_REPORT.md` | After `seed:simulation` |
| Persona sample | `docs/.simulation-personas.json` | After `seed:simulation` |
| Progressive test results | `docs/.scale-progression-results.json` | After `run-scale-progression` |
| Scale analysis | `docs/SCALABILITY_TEST_RESULTS.md` | After progressive run |
| Readiness verdict | `docs/BUDDYINTRO_SCALE_READINESS.md` | After progressive run |

---

## 6. Integration notes for progressive testing

1. **Auth user for HTTP benchmarks:** Use `sim-0@simulation.buddyintro.test` / `SimPass123!` (not demo `user1@friendintro.com`).
2. **Build once:** First scale runs full build; subsequent scales use `--skip-build`.
3. **Graph rebuild:** Included in `seed:simulation` (no separate step).
4. **`user_connections` count:** Materialized BFS (degree ≤ 4) — grows faster than user count.
5. **Health check caveat:** `/api/health` without cookies may redirect to login; `waitForServer` follows redirects (200 from login page).

---

## 7. Recommended progressive command sequence

```bash
# Per scale N in 50 100 250 500:
npm run seed:simulation -- --reset --users=N
npm run profile:production -- --skip-build --email=sim-0@simulation.buddyintro.test --password=SimPass123! --port=3010 --runs=3
```

Or automated:

```bash
npm run profile:scale-progression
npm run profile:scale-progression -- --only=250 --port=3010 --skip-build
npm run profile:scale-progression -- --scales=50,100,250,500 --runs=3
```

### `scripts/run-scale-progression.ts` CLI

| Flag | Default | Effect |
| ---- | ------- | ------ |
| `--scales=50,100,250,500` | all four | Comma-separated user counts |
| `--only=N` | — | Run a single scale (merges into existing JSON) |
| `--port=N` | 3010 | Production benchmark port |
| `--runs=N` | 3 | Warm runs per route |
| `--skip-build` | off | Skip initial `npx next build` |

**Progressive run completed:** 2026-06-22 — all scales **PASS** (50/50, 100/100, 250/250, 500/500 validation; production benchmarks captured). Raw: `docs/.scale-progression-results.json`.
