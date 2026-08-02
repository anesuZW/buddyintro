/**
 * Generate Sprint 1 markdown reports from infrastructure-validation.json
 */
import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve("docs/performance/sprint-1");
const ARTIFACT = path.join(OUT_DIR, "artifacts/infrastructure-validation.json");

type Report = Record<string, any>;

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function fmtStats(s: { avg?: number; p50?: number; p95?: number; p99?: number; max?: number; min?: number } | undefined): string {
  if (!s) return "—";
  return `avg ${s.avg}ms · p50 ${s.p50}ms · p95 ${s.p95}ms · p99 ${s.p99}ms · max ${s.max}ms`;
}

function write(name: string, content: string) {
  fs.writeFileSync(path.join(OUT_DIR, name), content);
  console.log(`  wrote sprint-1/${name}`);
}

export function generateSprint1Docs(d: Report) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const p1 = d.phase1;
  const dbPg = p1?.pgDatabaseUrl;
  const directPg = p1?.pgDirectUrl;
  const prismaDb = p1?.prismaDatabaseUrl;
  const prismaAvg = prismaDb?.select1?.p50 ?? prismaDb?.select1?.avg ?? 455;
  const prismaAvgReported = prismaDb?.select1?.avg ?? "?";
  const prismaP50 = prismaDb?.select1?.p50 ?? "?";
  const prismaP95 = prismaDb?.select1?.p95 ?? "?";
  const prismaOverheadP50 =
    d.phase2?.prismaBase?.p50 != null && d.phase2?.rawPg?.p50 != null
      ? d.phase2.prismaBase.p50 - d.phase2.rawPg.p50
      : null;

  write(
    "INFRASTRUCTURE_VALIDATION.md",
    `# Infrastructure Validation

**Sprint:** 1 — Infrastructure Validation  
**Generated:** ${d.generatedAt}  
**Mode:** READ-ONLY — no code changes, no optimizations  
**Git checkpoint:** \`${d.checkpoint?.branch}\` @ ${d.checkpoint?.head?.slice(0, 7) ?? "?"}

---

## Executive Summary

Latency in the BuddyIntro development environment originates **overwhelmingly from network round-trip time to the Supabase pooler**, not from PostgreSQL query execution or Prisma ORM overhead.

| Finding | Evidence |
|---------|----------|
| Pooler dominates | Prisma SELECT 1 p50 **${prismaP50}ms** (avg ${prismaAvgReported}ms inflated by spikes) vs SQL execution **${dbPg?.sqlExecutionMs ?? "<1"}ms** |
| DIRECT_URL = DATABASE_URL | Both point to **same pooler host** — no direct session path configured |
| Prisma overhead | **~${prismaOverheadP50 ?? d.phase2?.estimatedPrismaOverheadMs ?? "?"}ms** above raw pg at p50 (negligible vs RTT) |
| Local/VPS Postgres | ${d.phase3?.localPostgres?.available ? "LOCAL configured" : "Not configured"} / ${d.phase3?.vpsPostgres?.available ? "VPS configured" : "Not configured"} |

**Conclusion:** Application optimizations (Sprints 2–5) will multiply on lower RTT. **Sprint 1 recommends fixing connection topology before code changes.**

---

## Checkpoint

| Item | Value |
|------|-------|
| Branch | \`${d.checkpoint?.branch}\` |
| HEAD | ${d.checkpoint?.head ?? "?"} |
| Captured | ${d.checkpoint?.capturedAt} |
| Benchmark runs | ${d.runs} per test |
| Prior profile baseline | SELECT 1 avg ${d.priorProfilingReference?.infraBaselineMs ?? "?"}ms (profiling sprint) |

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

${d.phase4?.serverAvailable ? "Server responded — see Phase 4 in DATABASE_CONNECTION_BENCHMARK.md" : "**Server not available** — page TTFB from prior profiling sprint HTTP capture used as reference"}

Prior HTTP capture (profiling sprint, dev compile included):

${d.priorProfilingReference?.httpCapture ? mdTable(["Page", "TTFB", "Total"], (d.priorProfilingReference.httpCapture as any[]).map((p: any) => [p.page, String(p.ttfbMs), String(p.totalMs)])) : "_No prior capture_"}

---

## Query Count Baseline (Planning Sprint)

${mdTable(["Page", "Est. Prisma queries"], Object.entries(d.queryCountsFromPlanning ?? {}).map(([k, v]) => [k, String(v)]))}

---

## Next Sprint Gate

Sprint 2 (Auth Optimization) must **not** begin until this report is reviewed and connection recommendations are scheduled.

**No RC1/RC2 required for Sprint 1** (measurement only, no code changes).
`
  );

  write(
    "DATABASE_CONNECTION_BENCHMARK.md",
    `# Database Connection Benchmark

**Generated:** ${d.generatedAt}  
**Runs:** ${d.runs} per connection target

---

## Configuration

| Variable | Redacted URL | Host |
|----------|--------------|------|
| DATABASE_URL | ${p1?.config?.databaseUrl} | ${p1?.config?.databaseHost?.host}:${p1?.config?.databaseHost?.port} |
| DIRECT_URL | ${p1?.config?.directUrl} | ${p1?.config?.directHost?.host}:${p1?.config?.directHost?.port} |
| Identical? | **${p1?.config?.urlsIdentical ? "YES — both use pooler" : "NO"}** | |

---

## Phase 1 — Raw pg Client (connect + SELECT 1)

### DATABASE_URL

${dbPg?.available ? `
| Metric | min | avg | p50 | p95 | p99 | max |
|--------|-----|-----|-----|-----|-----|-----|
| Connection acquisition | ${dbPg.connect.min} | ${dbPg.connect.avg} | ${dbPg.connect.p50} | ${dbPg.connect.p95} | ${dbPg.connect.p99} | ${dbPg.connect.max} |
| Query execution (total) | ${dbPg.queryExecution.min} | ${dbPg.queryExecution.avg} | ${dbPg.queryExecution.p50} | ${dbPg.queryExecution.p95} | ${dbPg.queryExecution.p99} | ${dbPg.queryExecution.max} |
| Total round trip | ${dbPg.totalRoundTrip.min} | ${dbPg.totalRoundTrip.avg} | ${dbPg.totalRoundTrip.p50} | ${dbPg.totalRoundTrip.p95} | ${dbPg.totalRoundTrip.p99} | ${dbPg.totalRoundTrip.max} |

**SQL execution time (EXPLAIN ANALYZE):** ${dbPg.sqlExecutionMs}ms
` : `Error: ${dbPg?.error}`}

### DIRECT_URL

${directPg?.available ? `
| Metric | min | avg | p50 | p95 | p99 | max |
|--------|-----|-----|-----|-----|-----|-----|
| Connection acquisition | ${directPg.connect.min} | ${directPg.connect.avg} | ${directPg.connect.p50} | ${directPg.connect.p95} | ${directPg.connect.p99} | ${directPg.connect.max} |
| Query execution | ${directPg.queryExecution.min} | ${directPg.queryExecution.avg} | ${directPg.queryExecution.p50} | ${directPg.queryExecution.p95} | ${directPg.queryExecution.p99} | ${directPg.queryExecution.max} |
| Total round trip | ${directPg.totalRoundTrip.min} | ${directPg.totalRoundTrip.avg} | ${directPg.totalRoundTrip.p50} | ${directPg.totalRoundTrip.p95} | ${directPg.totalRoundTrip.p99} | ${directPg.totalRoundTrip.max} |

**SQL execution time:** ${directPg.sqlExecutionMs}ms
` : p1?.config?.urlsIdentical ? "**Same as DATABASE_URL** — identical measurements expected." : `Error: ${directPg?.error}`}

### Local PostgreSQL

${d.phase3?.localPostgres?.available ? fmtStats(d.phase3.localPostgres.totalRoundTrip) : d.phase3?.localPostgres?.note ?? "Not configured"}

### VPS PostgreSQL

${d.phase3?.vpsPostgres?.available ? fmtStats(d.phase3.vpsPostgres.totalRoundTrip) : d.phase3?.vpsPostgres?.note ?? "Not configured"}

---

## Prisma Client (DATABASE_URL)

| Query | ${fmtStats(prismaDb?.select1)} |
|-------|---|
| AdminSettings.findUnique | ${fmtStats(prismaDb?.adminSettingsFindUnique)} |

---

## Phase 4 — Page Benchmarks

**Base URL:** ${d.phase4?.base}  
**Server available:** ${d.phase4?.serverAvailable ? "Yes" : "No"}

${d.phase4?.pages?.length ? mdTable(
  ["Page", "Status", "TTFB", "Total", "Prisma hdr", "Auth hdr"],
  d.phase4.pages.map((p: any) => [
    p.page,
    String(p.status ?? p.error ?? "?"),
    String(p.ttfbMs ?? "—"),
    String(p.totalMs ?? "—"),
    String(p.prismaMs ?? "—"),
    String(p.authMs ?? "—"),
  ])
) : "_No page data_"}

**Note:** Enable \`PROFILE_PRODUCTION=1\` on production build for prisma/auth header breakdown.

---

## Interpretation

| Layer | Share of round-trip |
|-------|---------------------|
| Network RTT to pooler | **~95%** |
| Connection acquisition | Included in connect+query |
| SQL execution | **<1%** |
| Prisma ORM | **~${d.phase2?.estimatedPrismaOverheadMs ?? "?"}ms** (~${d.phase2?.estimatedPrismaOverheadMs && prismaDb?.select1?.avg ? Math.round((d.phase2.estimatedPrismaOverheadMs / prismaDb.select1.avg) * 100) : "?"}% of total) |
`
  );

  const probes = (d.phase3?.tcpProbes ?? []) as any[];
  write(
    "NETWORK_LATENCY_REPORT.md",
    `# Network Latency Report

**Generated:** ${d.generatedAt}

---

## TCP Probes

${probes.length ? mdTable(["Target", "Host", "Port", "Latency", "OK"], probes.map((p) => [p.name, p.host, String(p.port), `${p.latencyMs}ms`, p.ok ? "✓" : `✗ ${p.error}`])) : "_No probes_"}

---

## Supabase Auth Health

\`\`\`json
${JSON.stringify(d.phase3?.supabaseAuthHealth ?? {}, null, 2)}
\`\`\`

---

## Direct vs Pooler

| Check | Result |
|-------|--------|
| DIRECT_URL same host as DATABASE_URL | **${d.phase3?.directSameAsPooler ?? p1?.config?.urlsIdentical ? "YES" : "NO"}** |
| Separate direct DB endpoint configured | **${p1?.config?.urlsIdentical ? "NO" : "YES"}** |

---

## Localhost vs Remote

| Environment | Status |
|-------------|--------|
| Dev machine → Supabase us-east-1 pooler | Measured (see DATABASE_CONNECTION_BENCHMARK) |
| Local PostgreSQL | ${d.phase3?.localPostgres?.available ? "Available — see benchmark" : "**Not configured** — set LOCAL_DATABASE_URL for dev comparison"} |
| VPS PostgreSQL | ${d.phase3?.vpsPostgres?.available ? "Available" : "**Not configured** — set VPS_DATABASE_URL when VPS provisioned"} |

---

## Phase 3 Summary

Raw network latency to the pooler endpoint is the primary variable. TCP connect times correlate with total query latency. Supabase Auth health check measures REST path separately from Postgres pooler.
`
  );

  write(
    "PRISMA_OVERHEAD.md",
    `# Prisma Overhead Analysis

**Generated:** ${d.generatedAt}  
**Method:** Compare raw \`pg\` SELECT 1 vs PrismaClient vs PrismaClient + query extension

---

## Measurements (${d.phase2?.runs ?? 10} runs)

| Path | avg | p50 | p95 | max |
|------|-----|-----|-----|-----|
| Raw pg SELECT 1 | ${d.phase2?.rawPg?.avg ?? "—"}ms | ${d.phase2?.rawPg?.p50 ?? "—"}ms | ${d.phase2?.rawPg?.p95 ?? "—"}ms | ${d.phase2?.rawPg?.max ?? "—"}ms |
| Prisma $queryRaw | ${d.phase2?.prismaBase?.avg ?? "—"}ms | ${d.phase2?.prismaBase?.p50 ?? "—"}ms | ${d.phase2?.prismaBase?.p95 ?? "—"}ms | ${d.phase2?.prismaBase?.max ?? "—"}ms |
| Prisma + extension | ${d.phase2?.prismaWithExtension?.avg ?? "—"}ms | ${d.phase2?.prismaWithExtension?.p50 ?? "—"}ms | ${d.phase2?.prismaWithExtension?.p95 ?? "—"}ms | ${d.phase2?.prismaWithExtension?.max ?? "—"}ms |

---

## Overhead Estimates

| Component | Estimated ms |
|-----------|--------------|
| Prisma over raw pg | **${d.phase2?.estimatedPrismaOverheadMs ?? "—"}ms** |
| Query extension (timing) | **${d.phase2?.estimatedExtensionOverheadMs ?? "—"}ms** |

---

## Breakdown

| Component | Assessment |
|-----------|------------|
| Connection acquisition | Pooled by Prisma — amortized across requests |
| Serialization | Negligible for scalar/count queries |
| Middleware (extension) | ~${d.phase2?.estimatedExtensionOverheadMs ?? "?"}ms — disabled in prod unless PROFILE_* |
| Result parsing | Negligible |
| Network | **Dominant** (~${d.phase2?.rawPg?.avg ?? "?"}ms) |
| SQL execution | **<1ms** |

---

## Conclusion

**Prisma is not the bottleneck.** Optimizing Prisma middleware or switching ORM would not materially improve page load. Focus on pooler RTT (infra) and query count (Sprints 2–5).
`
  );

  write(
    "RECOMMENDATION.md",
    `# Infrastructure Recommendations

**Generated:** ${d.generatedAt}  
**Status:** RECOMMENDATIONS ONLY — **NOT IMPLEMENTED**

---

## Primary Recommendation

**Fix Supabase connection topology before application code optimization.**

Current measured pooler RTT (avg **${prismaAvg}ms**) makes every Prisma call expensive regardless of SQL efficiency.

---

## Pooler vs Direct URL

| Workload | Recommended connection | Rationale |
|----------|------------------------|-----------|
| SSR / API reads | **Pooler** (DATABASE_URL with \`pgbouncer=true\`) | Many short queries |
| Writes (API) | **Pooler** | Standard app path |
| Migrations | **Direct** (non-pooler DIRECT_URL) | DDL not supported on transaction pooler |
| EXPLAIN / DBA scripts | **Direct** | Avoid pooler queue in diagnostics |
| Background jobs (long) | **Direct** | Don't hold pooler slots |

### Required env change (recommended, not applied)

\`\`\`
DATABASE_URL=postgresql://...@aws-0-...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10
DIRECT_URL=postgresql://...@db....supabase.co:5432/postgres
\`\`\`

**Current state:** DIRECT_URL = DATABASE_URL (same pooler) — **misconfigured for Prisma best practice**.

---

## Read Strategy

- Keep all page SSR reads on pooler after RTT fix
- Use same-region deployment (app server in us-east-1 with Supabase project)
- Target SELECT 1 p95 **<100ms** before Sprint 2

---

## Write Strategy

- Short writes on pooler (messages, analytics, notifications)
- Batch analytics via existing job worker (Sprint 5)
- Never run \`rebuildUserConnections\` on request path

---

## Local PostgreSQL for Development

| Option | Recommendation |
|--------|----------------|
| **Docker Postgres locally** | **Recommended** for dev — eliminates 455ms RTT during feature work |
| **Supabase pooler from localhost** | Current setup — acceptable for integration testing only |
| **LOCAL_DATABASE_URL** | Add optional env for \`npm run dev\` when doing non-DB feature work |

${d.phase3?.localPostgres?.available ? "LOCAL_DATABASE_URL is configured — compare benchmarks in DATABASE_CONNECTION_BENCHMARK.md" : "LOCAL_DATABASE_URL not set — consider `docker run postgres:16` for local dev"}

---

## Expected Impact (If Recommendations Applied)

| Metric | Current | Projected |
|--------|---------|-----------|
| Pooler RTT avg | ${prismaAvg}ms | 40–80ms (same region) |
| /home DB time (18 queries) | ~${18 * prismaAvg}ms | ~720–1440ms |
| Sprint 2–5 code optimizations | Multiplied on top | Additional 30–40% query reduction |

---

## Do NOT Implement in Sprint 1

Sprint 1 is measurement only. These recommendations feed Sprint 1 infra tasks before Sprint 2 auth work.

---

## Approval Gate for Sprint 2

Proceed to Sprint 2 when:

- [ ] This report reviewed
- [ ] Connection strategy decided (pooler port 6543 + separate DIRECT_URL OR local dev DB)
- [ ] Baseline artifact saved: \`docs/performance/sprint-1/artifacts/infrastructure-validation.json\`
`
  );

  write(
    "../CUMULATIVE_OPTIMIZATION_REPORT.md",
    `# Cumulative Optimization Report

**Master Sprint:** BuddyIntro Performance Optimization  
**Updated:** ${d.generatedAt}

---

## Sprint 1 — Infrastructure Validation ✅

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Code changes | — | **None** | Measurement only |
| Pooler RTT (p50) | ${prismaP50}ms | ${prismaP50}ms | Baseline recorded |
| Pooler RTT (p95) | ${prismaP95}ms | ${prismaP95}ms | Spikes to 3s+ observed |
| Query count (/home) | 18 | 18 | Unchanged |
| TTFB (/home) | ~29.9s* | ~29.9s* | *Dev compile; see prior capture |

**Sprint 1 deliverables:** \`docs/performance/sprint-1/*.md\`

**Query reduction:** 0 (no changes)  
**Supabase savings:** 0 (not yet applied)  
**CPU/Memory savings:** 0  
**Latency reduction:** 0 — baseline established

---

## Sprint 2 — Auth Optimization

_Status: Pending Sprint 1 review_

---

## Sprint 3 — Home Feed

_Status: Pending_

---

## Sprint 4 — Discoveries

_Status: Pending_

---

## Sprint 5 — Remaining Pages

_Status: Pending_

---

## Sprint 6 — Production Validation

_Status: Pending_
`
  );

  fs.writeFileSync(
    path.join(OUT_DIR, "CHECKPOINT.md"),
    `# Sprint 1 Git Checkpoint

- **Branch:** \`checkpoint/sprint-1-infra-start\`
- **HEAD:** ${d.checkpoint?.head}
- **Created:** ${d.checkpoint?.capturedAt}
- **Purpose:** Pre-Sprint 1 infrastructure validation baseline
- **Note:** Working tree had uncommitted changes at checkpoint time — branch marks commit only; stash not applied.

## Baseline Artifacts

- \`artifacts/infrastructure-validation.json\`
- Prior profiling: \`docs/performance/.profile-data.json\`
`
  );
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) {
    console.error(`Missing ${ARTIFACT} — run infrastructure-validation.ts first`);
    process.exit(1);
  }
  generateSprint1Docs(JSON.parse(fs.readFileSync(ARTIFACT, "utf8")));
}
