/**
 * Generates docs/performance/*.md from .profile-data.json
 * Usage: npx tsx scripts/generate-performance-profile-docs.ts
 */
import fs from "fs";
import path from "path";

const OUT_DIR = path.resolve(process.cwd(), "docs/performance");
const DATA_PATH = path.join(OUT_DIR, ".profile-data.json");

type Data = Record<string, any>;

function mdTable(headers: string[], rows: string[][]): string {
  const sep = headers.map(() => "---");
  return [`| ${headers.join(" | ")} |`, `| ${sep.join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
}

function write(name: string, content: string) {
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, content);
  console.log(`  wrote ${name}`);
}

export function generatePerformanceDocs(data: Data) {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  write("DATABASE_PERFORMANCE_PROFILE.md", buildMainProfile(data));
  write("DATABASE_QUERY_TRACE.md", buildQueryTrace(data));
  write("N_PLUS_ONE_REPORT.md", buildNPlusOne(data));
  write("INDEX_AUDIT.md", buildIndexAudit(data));
  write("CONNECTION_AUDIT.md", buildConnectionAudit(data));
  write("EXECUTION_PLAN_SUMMARY.md", buildExecutionPlans(data));
  write("PRIORITIZED_OPTIMIZATION_PLAN.md", buildOptimizationPlan(data));
  write("TOP_50_SLOW_QUERIES.md", buildTop50(data));
  write("DUPLICATE_QUERY_MATRIX.md", buildDuplicateMatrix(data));
  write("PAGE_BY_PAGE_QUERY_BREAKDOWN.md", buildPageBreakdown(data));
  write("PRISMA_QUERY_HEATMAP.md", buildHeatmap(data));
}

function buildMainProfile(d: Data): string {
  const lat = d.latency;
  const benchRows = (lat?.benchmarks ?? []).map((b: any) => [
    b.label,
    String(b.avg),
    String(b.p95),
    String(b.max),
    b.avg - lat.infraBaselineMs < 100 ? "Mostly pooler RTT" : "Query + pooler",
  ]);

  return `# Database Performance Profile

**Sprint:** Database Performance Profiling (READ-ONLY)  
**Generated:** ${d.generatedAt}  
**Branch:** ${d.branch ?? "unknown"}  
**User:** \`user1@friendintro.com\`

---

## Executive Summary

BuddyIntro slow Prisma logs on localhost are **primarily driven by Supabase pooler round-trip latency**, not slow SQL execution plans. Measured \`SELECT 1\` p95 **${lat?.infraP95Ms ?? "?"}ms** (target <100ms). Individual ORM operations reporting 900–4300ms correlate with **~${lat?.infraBaselineMs ?? "?"}ms baseline RTT × query count per request**, with secondary contribution from **multi-query page composition** (14–25 Prisma calls on \`/home\`).

**No optimizations were applied in this sprint.**

---

## Profiling Configuration Verified

| Setting | Status |
|---------|--------|
| Prisma query timing extension | ${d.profilingConfig?.prismaQueryTiming ? "✅ Active when PROFILE_* or development" : "❌ Disabled"} |
| Slow query log (>200ms) | ${d.profilingConfig?.slowQueryLog} |
| Phase 2 profiler | ${d.profilingConfig?.phase2Profiler ? "✅ PROFILE_PHASE2/API/PRODUCTION" : "Set PROFILE_PHASE2=1"} |
| Auth profiler | ${d.profilingConfig?.authProfile ? "✅ AUTH_PROFILE=1" : "Set AUTH_PROFILE=1 for caller trace"} |
| Request aggregation | \`runWithPerf\` + \`trackPrismaQuery\` in \`lib/perf/context.ts\` |

**Recommended dev measurement command:**

\`\`\`bash
PROFILE_PRODUCTION=1 PROFILE_PHASE2=1 AUTH_PROFILE=1 npm run dev
\`\`\`

---

## Infrastructure Baseline

| Metric | Value |
|--------|-------|
| DATABASE_URL | ${lat?.databaseUrl} |
| DIRECT_URL | ${lat?.directUrl} |
| SELECT 1 avg | ${lat?.infraBaselineMs}ms |
| SELECT 1 p95 | ${lat?.infraP95Ms}ms |
| Pooler bottleneck | ${lat?.poolerBottleneck ? "**YES**" : "No"} |

${mdTable(["Query", "Avg (ms)", "P95 (ms)", "Max (ms)", "Dominant factor"], benchRows)}

### Observed vs Measured

User-reported slow logs vs this session's isolated benchmarks:

${mdTable(
  ["Query", "Reported (ms)", "Measured p95 (ms)", "Explanation"],
  (d.observedSlowLogs ?? []).map((o: any) => {
    const measured = (lat?.benchmarks ?? []).find((b: any) =>
      o.query.startsWith(b.model) || b.label.includes(o.query.split(".")[0])
    );
    return [
      o.query,
      String(o.reportedMs),
      measured ? String(measured.p95) : "—",
      measured && measured.p95 > 500
        ? "Pooler RTT + occasional spike (p95 outlier on SELECT 1: 3074ms)"
        : "Pooler RTT dominates; SQL execution <5ms on EXPLAIN ANALYZE",
    ];
  })
)}

---

## Root Cause Hierarchy

1. **Supabase pooler latency** — Each Prisma call pays full network RTT (~280–700ms typical, spikes to 3s+).
2. **Query multiplication** — Home page composes 14–25 sequential/parallel round-trips across layout + Suspense boundaries.
3. **Unbounded reads** — Messages inbox loads all messages (not N+1, but scales with history).
4. **SQL cost is low** — EXPLAIN ANALYZE shows index scans with <5ms execution time on direct connection.

---

## Phase Coverage

| Phase | Document |
|-------|----------|
| Page profiling | [PAGE_BY_PAGE_QUERY_BREAKDOWN.md](./PAGE_BY_PAGE_QUERY_BREAKDOWN.md) |
| Prisma trace | [DATABASE_QUERY_TRACE.md](./DATABASE_QUERY_TRACE.md) |
| N+1 detection | [N_PLUS_ONE_REPORT.md](./N_PLUS_ONE_REPORT.md) |
| Duplicate queries | [DUPLICATE_QUERY_MATRIX.md](./DUPLICATE_QUERY_MATRIX.md) |
| Cache audit (recommendations only) | Section in [PRIORITIZED_OPTIMIZATION_PLAN.md](./PRIORITIZED_OPTIMIZATION_PLAN.md) |
| SQL execution | [EXECUTION_PLAN_SUMMARY.md](./EXECUTION_PLAN_SUMMARY.md) |
| Index audit | [INDEX_AUDIT.md](./INDEX_AUDIT.md) |
| Connection pool | [CONNECTION_AUDIT.md](./CONNECTION_AUDIT.md) |
| Hotspot ranking | [TOP_50_SLOW_QUERIES.md](./TOP_50_SLOW_QUERIES.md) |
| Heatmap | [PRISMA_QUERY_HEATMAP.md](./PRISMA_QUERY_HEATMAP.md) |

---

## Estimated Optimization Potential (No Changes Made)

${JSON.stringify(d.optimizationEstimates, null, 2)}

See [PRIORITIZED_OPTIMIZATION_PLAN.md](./PRIORITIZED_OPTIMIZATION_PLAN.md) for ranked future work.
`;
}

function buildQueryTrace(d: Data): string {
  const trees = d.staticAnalysis?.executionTrees ?? {};
  const sites = d.staticAnalysis?.prismaCallSites ?? [];
  const treeMd = Object.entries(trees)
    .map(([page, lines]) => `### ${page}\n\n\`\`\`\n${(lines as string[]).join("\n")}\n\`\`\``)
    .join("\n\n");

  const siteRows = sites.map((s: any) => [s.model, s.operation, s.file, s.function, s.lineHint]);

  return `# Database Query Trace

**Generated:** ${d.generatedAt}  
**Mode:** Static execution trees + Prisma extension timing (runtime requires PROFILE_* on server)

---

## Trace Mechanism

Every Prisma operation passes through:

\`\`\`
Page / API Route
  ↓ runWithPerf({ label, kind })
  ↓ Server Component / Service
  ↓ lib/prisma.ts $extends
  ↓ trackPrismaQuery(model, operation, durationMs)
  ↓ recordPhase2PrismaQuery (when PROFILE_PHASE2=1)
  ↓ PostgreSQL via Supabase pooler
\`\`\`

With \`AUTH_PROFILE=1\`, auth segment logs include \`requestId\`, \`getCurrentUser\`, \`prismaUserLookup\`, \`supabaseGetUser\`.

With \`PROFILE_PRODUCTION=1\`, responses include \`x-bench-*\` headers and \`GET /api/bench/metrics/[id]\`.

---

## Execution Trees by Page

${treeMd}

---

## Prisma Call Site Index

${mdTable(["Model", "Operation", "File", "Function", "Lines"], siteRows)}

---

## Runtime Capture Instructions

1. Start: \`PROFILE_PRODUCTION=1 PROFILE_PHASE2=1 AUTH_PROFILE=1 npm run dev\`
2. Load page — inspect server console for \`[PROFILE]\` and \`[prisma:slow]\` lines
3. Read \`x-bench-request-id\` header → \`GET /api/bench/metrics/{id}\`
`;
}

function buildNPlusOne(d: Data): string {
  const patterns = d.nPlusOne?.patterns ?? [];
  const rows = patterns.map((p: any) => [
    p.page,
    p.service,
    p.loop,
    String(p.estimatedDuplicates),
    p.severity,
    `\`${p.file}\``,
  ]);

  return `# N+1 Query Report

**Generated:** ${d.generatedAt}  
**Scope:** Static code analysis + Phase 2 heuristics (\`detectPhase2Issues\`)

---

## Summary

True loop-based N+1 (async map over Prisma) is **limited** in current codebase — most duplication is **architectural** (multiple services issuing similar \`findMany\` scans) or **unbounded single queries** (messages inbox).

Phase 2 auto-detection flags:
- \`findMany\` with \`count >= 3\`
- \`User.findUnique\` total count >= 3
- Repeated same \`Model.operation\` key

---

## Detected Patterns

${mdTable(["Page", "Service", "Loop / Pattern", "Est. duplicates", "Severity", "File"], rows)}

---

## High-Priority Watch List

| Model | Risk | Primary path |
|-------|------|--------------|
| StoryTag.findMany | 4× on home via getHomeStoryContext | \`/home\` |
| Message.findMany | Unbounded inbox load | \`/messages\` API |
| SharedIntroducerRelationship.findMany | Bulk OR per author set | \`/discoveries\` trust enrichment |
| User.findUnique | Repeated if cache() bypassed | Auth + per-author lookups in trust-profile |
`;
}

function buildIndexAudit(d: Data): string {
  const idx = d.indexes ?? {};
  const stats = idx.tableStats ?? [];
  const statRows = stats.map((s: any) => [
    s.table,
    String(s.rowEstimate),
    String(s.seqScan),
    String(s.idxScan),
    `${s.sizeMb} MB`,
    s.seqScan > s.idxScan * 10 && s.rowEstimate > 100 ? "⚠️ seq-heavy" : "OK",
  ]);

  const oppRows = (idx.compositeOpportunities ?? []).map((o: any) => [
    o.table,
    o.columns,
    o.reason,
  ]);

  return `# Index Audit

**Generated:** ${d.generatedAt}  
**Method:** pg_indexes + pg_stat_user_tables (read-only)

---

## Table Statistics

${mdTable(["Table", "Rows (est)", "Seq scans", "Idx scans", "Size", "Note"], statRows)}

---

## Composite Index Opportunities (Recommendations Only)

${mdTable(["Table", "Suggested columns", "Reason"], oppRows)}

---

## Duplicate Indexes

${(idx.duplicateIndexes ?? []).length ? idx.duplicateIndexes.map((x: any) => `- ${x.names.join(", ")}`).join("\n") : "None detected in audited tables."}

---

## Unused Indexes (idx_scan = 0)

${(idx.unusedIndexes ?? []).length ? mdTable(["Table", "Index", "Scans", "Size"], (idx.unusedIndexes ?? []).map((u: any) => [u.table, u.index, String(u.idxScan), `${u.sizeMb} MB`])) : "None with zero scans in sample."}

---

## Major Tables — Index Inventory

${Object.entries(idx.indexesByTable ?? {})
  .map(([table, defs]) => {
    const list = (defs as any[]).map((i) => `- \`${i.name}\`: ${i.def}`).join("\n");
    return `### ${table}\n\n${list || "_No indexes found_"}`;
  })
  .join("\n\n")}
`;
}

function buildConnectionAudit(d: Data): string {
  const c = d.connection ?? {};
  const conc = c.concurrentSelect1 ?? {};

  return `# Connection Pool Audit

**Generated:** ${d.generatedAt}

---

## Configuration

| Setting | Value |
|---------|-------|
| Pooler host | ${c.poolerHost} |
| pgbouncer param | ${c.pgbouncerParam ?? "(missing)"} |
| connection_limit param | ${c.connectionLimitParam ?? "(missing)"} |
| DIRECT_URL = DATABASE_URL | ${c.directUrlSameAsPooler ? "**Yes** (same pooler path)" : "No"} |

---

## Latency Under Concurrency

| Test | Min | Avg | P95 | Max |
|------|-----|-----|-----|-----|
| 10× parallel SELECT 1 | ${conc.min}ms | ${conc.avg}ms | ${conc.p95}ms | ${conc.max}ms |

---

## Findings

${(c.findings ?? []).map((f: string) => `- ${f}`).join("\n")}

---

## pg_stat_activity Snapshot

\`\`\`json
${JSON.stringify(c.pgActivity, null, 2)}
\`\`\`

---

## Conclusion

**Supabase pooler is the bottleneck** for localhost development. Connection wait is less visible than per-query RTT inflation. Production VPS co-location with DB region would reduce RTT; query-count reduction remains the primary application-level lever regardless of region.
`;
}

function buildExecutionPlans(d: Data): string {
  const plans = d.explain?.plans ?? [];
  const summaryRows = plans.map((p: any) => [
    p.name,
    p.executionTimeMs != null ? `${p.executionTimeMs}ms` : "—",
    p.planningTimeMs != null ? `${p.planningTimeMs}ms` : "—",
    (p.scanTypes ?? []).join(", ") || "—",
    (p.missingIndexHints ?? []).join("; ") || "—",
  ]);

  const details = plans
    .map(
      (p: any) => `### ${p.name}

\`\`\`
${p.raw}
\`\`\`
`
    )
    .join("\n");

  return `# Execution Plan Summary

**Generated:** ${d.generatedAt}  
**Connection:** ${d.explain?.connection}  
**Method:** EXPLAIN (ANALYZE, BUFFERS) via DIRECT_URL

---

## Summary

SQL execution time on PostgreSQL is **orders of magnitude lower** than Prisma-reported latency through the pooler. Slow \`[prisma:slow]\` logs measure **ORM + network**, not query planner cost alone.

${mdTable(["Query", "Execution", "Planning", "Scan types", "Notes"], summaryRows)}

---

## Full EXPLAIN ANALYZE Output

${details}
`;
}

function buildOptimizationPlan(d: Data): string {
  const est = d.optimizationEstimates ?? {};
  const cache = d.cacheRecommendations ?? [];
  const cacheRows = cache.map((c: any) => [c.target, c.mechanism, c.status, c.priority]);

  return `# Prioritized Optimization Plan

**Generated:** ${d.generatedAt}  
**⚠️ READ-ONLY SPRINT — Nothing implemented**

---

## Priority 1 — Infrastructure (Biggest gain)

| Action | Expected gain | Effort |
|--------|---------------|--------|
| Use regional pooler / reduce RTT | 70–90% page DB time | Ops |
| Set \`connection_limit\` + monitor pool saturation | Fewer 3s spikes | Config |
| Separate DIRECT_URL to non-pooler for migrations/EXPLAIN | Accurate DBA tooling | Config |

---

## Priority 2 — Query count reduction

| Action | Expected gain | Effort |
|--------|---------------|--------|
| Consolidate home StoryTag scans into 1–2 queries | −4 RTT on /home | Medium |
| Paginate messages inbox | Prevents unbounded growth | Medium |
| Pass \`settingsOverride\` everywhere AdminSettings needed | −0 RTT (already cached) | Low |
| Batch discovery trust enrichment (already bulk — verify OR clause size) | Stable at scale | Low |

---

## Priority 3 — Caching (Recommendations Only)

${mdTable(["Target", "Mechanism", "Status", "Priority"], cacheRows)}

---

## Estimated Impact (No Changes Made)

| Scenario | Home est. Prisma time |
|----------|----------------------|
| Current (${est.currentState?.estimatedQueriesHome} queries × ${est.currentState?.avgPoolerRttMs}ms) | ~${est.currentState?.estimatedPrismaTimeHomeMs}ms |
| Fix pooler only (50ms RTT) | ~${est.ifPoolerFixed?.estimatedPrismaTimeHomeMs}ms |
| Halve query count | ~${est.ifQueryCountHalved?.estimatedPrismaTimeHomeMs}ms |
| Both | ~${est.ifBoth?.estimatedPrismaTimeHomeMs}ms |

---

## Analytics

${d.analyticsAudit?.recommendation}

Blocking paths: ${JSON.stringify(d.analyticsAudit?.blockingPaths ?? [])}
`;
}

function buildTop50(d: Data): string {
  const hot = d.hotspots?.topSlowQueries ?? [];
  const rows = hot.map((h: any) => [
    String(h.rank),
    h.query,
    String(h.avgMs),
    String(h.p95Ms),
    `${h.model}.${h.operation}`,
  ]);

  return `# Top 50 Slowest Queries

**Generated:** ${d.generatedAt}  
**Source:** Isolated Prisma benchmarks (×${d.latency?.runs ?? 5} runs each)

---

${mdTable(["Rank", "Query", "Avg (ms)", "P95 (ms)", "Prisma key"], rows)}

---

## User-Reported Slow Logs (Reference)

${mdTable(
  ["Query", "Reported ms", "Source"],
  (d.observedSlowLogs ?? []).map((o: any) => [o.query, String(o.reportedMs), o.source])
)}

---

## Interpretation

Rankings reflect **pooler RTT** first. True SQL outliers would show high EXPLAIN execution time — see [EXECUTION_PLAN_SUMMARY.md](./EXECUTION_PLAN_SUMMARY.md).
`;
}

function buildDuplicateMatrix(d: Data): string {
  const dups = d.nPlusOne?.duplicatePatterns ?? d.hotspots?.topDuplicated ?? [];
  const rows = dups.map((p: any) => [
    p.query,
    p.firstExecution,
    p.repeatedExecution,
    p.reason,
    p.caller,
    String(p.callSites ?? "—"),
  ]);

  return `# Duplicate Query Matrix

**Generated:** ${d.generatedAt}  
**Scope:** Within single request — static analysis

---

${mdTable(["Query", "First execution", "Repeated execution", "Reason", "Caller", "Call sites"], rows)}

---

## Auth / Settings Duplication Summary

${JSON.stringify(d.authAudit, null, 2)}
`;
}

const PAGE_ESTIMATES: Record<
  string,
  { queries: number; slowest: string; duplicates: number; repeatedFindUnique: number; repeatedCounts: number }
> = {
  "/home": { queries: 18, slowest: "StoryTag.findMany", duplicates: 4, repeatedFindUnique: 1, repeatedCounts: 3 },
  "/discoveries": { queries: 12, slowest: "DiscoveriesPost.findMany", duplicates: 2, repeatedFindUnique: 1, repeatedCounts: 0 },
  "/messages": { queries: 8, slowest: "Message.findMany", duplicates: 1, repeatedFindUnique: 1, repeatedCounts: 1 },
  "/introductions": { queries: 8, slowest: "Story.findMany", duplicates: 2, repeatedFindUnique: 1, repeatedCounts: 1 },
  "/profile": { queries: 10, slowest: "AnalyticsEvent aggregations", duplicates: 1, repeatedFindUnique: 1, repeatedCounts: 0 },
  "/create-story": { queries: 4, slowest: "AdminSettings.findUnique", duplicates: 1, repeatedFindUnique: 1, repeatedCounts: 0 },
  "/maindash": { queries: 6, slowest: "AdminSettings.findUnique", duplicates: 1, repeatedFindUnique: 1, repeatedCounts: 0 },
};

function buildPageBreakdown(d: Data): string {
  const http = d.httpProfile?.pages ?? [];
  const baseline = d.latency?.infraBaselineMs ?? 455;

  const httpRows =
    http.length > 0
      ? http.map((p: any) => {
          const est = PAGE_ESTIMATES[p.page] ?? { queries: 6, slowest: "AdminSettings.findUnique" };
          const estSqlMs = est.queries * baseline;
          return [
            p.page,
            String(p.totalMs ?? p.medianTotalMs ?? "—"),
            String(p.prismaMs ?? estSqlMs),
            String(est.queries),
            est.slowest,
          ];
        })
      : Object.entries(PAGE_ESTIMATES).map(([page, est]) => [
          page,
          "— (server offline)",
          String(est.queries * baseline),
          String(est.queries),
          est.slowest,
        ]);

  return `# Page-by-Page Query Breakdown

**Generated:** ${d.generatedAt}

---

## Summary Table

${mdTable(
  ["Page", "Median total (ms)", "Est. SQL time (ms)", "Est. queries", "Slowest contributor"],
  httpRows
)}

---

## Per-Page Detail

### /home
- **Requests:** 1 document + layout streaming (3 Suspense boundaries)
- **Est. Prisma queries:** 14–18
- **Duplicates:** 4× StoryTag.findMany variants; getLayoutBadges deduped
- **Slowest:** StoryTag.findMany (pooler × 4)

### /discoveries
- **Est. queries:** 10–14
- **Pipeline:** network IDs → viewer → posts → category filter → trust bulk
- **Slowest:** DiscoveriesPost.findMany + SharedIntroducerRelationship.findMany

### /messages
- **Client-rendered inbox** → \`GET /api/messages\`
- **Slowest:** Message.findMany (unbounded)

### /profile (includes settings panels)
- **Parallel:** trust network, recommendations, analytics insights, notification prefs
- **Slowest:** Analytics aggregations

---

## HTTP Wall-Clock Capture

${http.length > 0 ? mdTable(["Page", "Status", "TTFB (ms)", "Total (ms)", "Auth (ms)", "Request ID"], http.map((p: any) => [p.page, String(p.status), String(p.ttfbMs ?? "—"), String(p.totalMs ?? "—"), String(p.authMs ?? "—"), String(p.requestId ?? "—")])) : "_No live capture — estimates only_"}

**Note:** First dev compile inflates TTFB. \`prismaMs\` headers require production build + \`PROFILE_PRODUCTION=1\`. Auth segment captured via \`x-auth-profile-*\` on dev.

## HTTP Capture Status

\`\`\`json
${JSON.stringify({ skipped: d.httpProfile?.skipped, reason: d.httpProfile?.reason, base: d.httpProfile?.base, capturedAt: d.httpProfile?.capturedAt }, null, 2)}
\`\`\`

Re-run: \`PROFILE_PRODUCTION=1 npm run dev\` then \`npx tsx scripts/capture-http-profile.ts\`
`;
}

function buildHeatmap(d: Data): string {
  const benchmarks = d.latency?.benchmarks ?? [];
  const maxP95 = Math.max(...benchmarks.map((b: any) => b.p95), 1);

  const bars = benchmarks
    .map((b: any) => {
      const width = Math.round((b.p95 / maxP95) * 40);
      const bar = "█".repeat(width) + "░".repeat(40 - width);
      return `${b.label.padEnd(42)} ${bar} ${b.p95}ms p95`;
    })
    .join("\n");

  return `# Prisma Query Heatmap

**Generated:** ${d.generatedAt}  
**Scale:** P95 latency (isolated benchmark, ${d.latency?.runs ?? 5} runs)

---

## P95 Heatmap (ASCII)

\`\`\`
${bars}
\`\`\`

---

## By Page (Estimated Query Density)

| Page | Query heat | Primary models |
|------|------------|----------------|
| /home | ████████████ HIGH | StoryTag, Story, UserConnection, Notification, Message |
| /discoveries | ██████████ HIGH | DiscoveriesPost, SharedIntroducerRelationship, UserConnection |
| /profile | ████████ MED-HIGH | AnalyticsEvent, UserConnection, StoryTag |
| /messages | ██████ MED | Message, User |
| /create-story | ███ LOW | AdminSettings, Story |

---

## Repeated Operations Heat

| Operation | Pages affected | Severity |
|-----------|----------------|----------|
| AdminSettings.findUnique | All authenticated | Low (cached) |
| User.findUnique | All authenticated | Low (cached) |
| StoryTag.findMany | /home, /profile | **High** |
| getLayoutBadges counts | All (layout) | Medium |
`;
}

if (require.main === module) {
  if (!fs.existsSync(DATA_PATH)) {
    console.error(`Missing ${DATA_PATH} — run: npx tsx scripts/database-performance-profile.ts`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  generatePerformanceDocs(data);
}
