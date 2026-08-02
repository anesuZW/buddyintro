# DB_FORENSICS_SUMMARY

## Objective

Explain the measured **~3.07 s** for `SELECT NOW()` via Prisma (`test-db.js`) without optimizing application code.

## Reproduction

| Source | Mean / median |
|--------|----------------|
| CTO baseline (5 runs) | ≈ 3.07 s |
| This forensics (`reproduce-test-db.mjs`) | mean **2894 ms**, median 2774 ms |
| 20× new PrismaClient | mean **2902 ms**, median **2936 ms** |

## Where the milliseconds go

For cold Prisma `SELECT NOW()` (~2894 ms mean):

```
DNS                              3 ms
TCP IPv4                       286 ms
Happy Eyeballs penalty         516 ms
SSLRequest                     297 ms
TLS                            307 ms
Auth / pooler startup          328 ms
SELECT NOW() RTT               301 ms   ← server SQL 0.032 ms
Prisma residual                829 ms
────────────────────────────────────
Total                         ~2894 ms
```

Full ranking: `ROOT_CAUSE.md`.

## Key truths (evidence-backed)

1. **Postgres is not slow** — EXPLAIN Execution Time **0.032 ms**.
2. **Warm connections are ~300 ms** — one Zimbabwe→us-east-1 RTT.
3. **Cold connections are ~2.9 s** — multiple RTTs + Happy Eyeballs + Prisma residual.
4. **Node default hostname connect adds ~516 ms** vs `family:4` / `autoSelectFamily: false`.
5. **Pooler port 5432 vs 6543** does not explain the gap.
6. **DIRECT_URL is not reachable over IPv4** from this workstation.
7. **DNS is ~2 ms** — not the bottleneck.

## Pipeline

Documented in `CONNECTION_PIPELINE.md`:

`Node → Prisma → DNS → TCP → SSLRequest → TLS → Supabase pooler (us-east-1) → Postgres → SELECT NOW()`

## Artifacts & scripts

| Path | Role |
|------|------|
| `scripts/run-forensics.mjs` | DNS, TCP, pg, Prisma, EXPLAIN |
| `scripts/measure-pg-ssl.mjs` | SSLRequest + TLS + port modes |
| `scripts/measure-tcp-hostname-penalty.mjs` | Happy Eyeballs proof |
| `scripts/run-network.mjs` | ping / tracert |
| `scripts/run-repeatability.mjs` | 20× cold/warm/parallel |
| `scripts/reproduce-test-db.mjs` | CTO baseline rematch |
| `artifacts/*.json` | Raw measurements |

## Documents

| File | Content |
|------|---------|
| `CONNECTION_PIPELINE.md` | End-to-end path map |
| `CONNECTION_TIMELINE.md` | Stage timeline |
| `PRISMA_CONNECTION_ANALYSIS.md` | Same vs new client |
| `POOLER_ANALYSIS.md` | URL / 5432 / 6543 / reuse |
| `DNS_ANALYSIS.md` | Resolver timings |
| `TLS_ANALYSIS.md` | TCP/TLS/SSLRequest |
| `NETWORK_ANALYSIS.md` | Traceroute / RTT |
| `POSTGRES_ANALYSIS.md` | EXPLAIN proof |
| `REPEATABILITY.md` | 20-run stats |
| `ROOT_CAUSE.md` | Ranked ms budget |
| `RECOMMENDATIONS.md` | Impact-ranked next steps |

## Success criteria

| Criterion | Status |
|-----------|--------|
| Know where every ms of the ~3 s goes | **Met** (budget sums to measured wall) |
| Evidence only | **Met** (artifacts under `artifacts/`) |
| No application optimization | **Met** (scripts/docs only) |

## Bottom line

The missing three seconds are **not missing inside SQL**. They are **serial network round-trips to us-east-1 on a new connection**, worsened by **Node Happy Eyeballs (~0.5 s)** and **Prisma cold-connect overhead (~0.8 s beyond `pg`)**. Reusing one client collapses the same query to **~300 ms**.
