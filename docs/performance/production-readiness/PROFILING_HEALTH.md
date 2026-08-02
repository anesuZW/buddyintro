# PROFILING_HEALTH

**Phase:** Production Readiness — Phase 5  
**Generated:** 2026-07-31  
**Mode:** READ-ONLY verification of existing tools

---

## Tool matrix

| Tool | Command / path | Status | Notes |
| --- | --- | --- | --- |
| HTTP page capture | `npm run profile:http-capture` | **Degraded** | Runs; records status/TTFB; all auth pages **500** today |
| Database profile orchestrator | `npm run profile:database` | **Broken** | Aborts on `User.findUnique` P2022 |
| Prisma query extension timing | `lib/prisma.ts` | **OK** | Emits `prisma:error` / slow logs when queries succeed |
| Slow query logging | `[prisma:slow]` threshold 200ms | **OK** when queries run | Confirmed historically; not exercised on happy path today |
| Auth segment headers | `AUTH_PROFILE=1` | **OK** | `x-auth-*` headers present on 3010/3012 |
| Route auth summary logs | `[AUTH-PROFILE] route-summary` | **OK** | Seen for `/home`, `/profile` |
| Runtime trace (full Prisma waterfall) | Depends on successful page | **Blocked** | Cannot complete authenticated `/home` |
| Bench headers (`x-bench-*`) | `PROFILE_PRODUCTION=1` | **Partial** | `x-bench-auth-ms` set; `x-bench-prisma-ms` null on 500 |
| Migration sync check | `npm run check:migration-sync` | **Broken env** | `DIRECT_URL` DNS ENOTFOUND |
| Schema audit probe | `artifacts/schema-migration-audit.ts` | **OK** | New PR readiness artifact |
| Auth capture probe | `artifacts/capture-auth-baseline.ts` | **OK** | Reproducible |

---

## Reproducibility assessment

| Scenario | Reproducible? |
| --- | --- |
| Middleware auth timings | **Yes** — consistent 300–550 ms typical; occasional 1s+ spikes |
| Authenticated 500 due to schema | **Yes** — 100% of Main routes |
| Warm successful `/home` Prisma counts | **No** — blocked by schema |
| `profile:database` end-to-end | **No** — hard fail |
| Identical absolute TTFB across runs | **No** — cold compile + RTT variance |

**Conclusion:** Profiling **instrumentation is healthy**. Profiling **pipelines that require a valid User row are not**. Benchmarks cannot be trusted as performance baselines until schema is aligned.

---

## Side effect note

`profile:http-capture` regenerates docs under `docs/performance/*.md` via `generate-performance-profile-docs.ts`. Those files are **not** the Production Readiness source of truth; use this folder + `artifacts/*` instead.

---

## Required flags for full instrumentation

```powershell
$env:PROFILE_PRODUCTION='1'
$env:AUTH_PROFILE='1'
$env:PROFILE_PHASE2='1'
npm run dev -- -p 3012
```

---

## Pass/fail for Phase 5 success criterion

| Criterion | Result |
| --- | --- |
| Tools functioning correctly | **Partial** — auth/HTTP headers OK; DB profile/runtime trace **fail** on schema |
| Every benchmark reproducible consistently | **No** for authenticated success path |
| Gap fully understood | **Yes** |
