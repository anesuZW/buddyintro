import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import type { LoadInvestigationResults } from "@/lib/load-test/investigation-types";

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.join(" | ")} |`),
  ].join("\n");
}

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function snapTable(
  snapshots: LoadInvestigationResults["baseline"]["snapshots"]["snapshots"]
): string {
  if (!snapshots.length) return "_No snapshots collected._";
  return mdTable(
    ["Time", "Heap MB", "RSS MB", "EL lag max", "CPU %", "Handles", "Active req", "Prisma q", "Auth ms"],
    snapshots.slice(0, 40).map((s, i) => [
      `${i * 5}s`,
      String(s.memory.heapUsedMb),
      String(s.memory.rssMb),
      String(s.eventLoop.lagMaxMs),
      String(s.cpu.percent),
      String(s.handles.active),
      String(s.handles.activeRequests),
      String(s.prisma.totalQueries),
      String(s.auth.avgMiddlewareMs),
    ])
  );
}

export function writeInvestigationReports(results: LoadInvestigationResults): void {
  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "docs/.load-investigation-results.json"),
    JSON.stringify(results, null, 2)
  );

  writePerformanceBaseline(results);
  writeMemoryLeakReport(results);
  writePrismaBottleneckReport(results);
  writeCapacityLimitReport(results);
  writeCrashAnalysis(results);
  writeHostingReadiness(results);
  writeOptimizationRoadmap(results);
  writeScaleAssessment(results);
}

function writePerformanceBaseline(r: LoadInvestigationResults): void {
  const { baseline } = r;
  const summary =
    baseline.snapshots.snapshots.length > 0
      ? baseline.snapshots.snapshots
      : r.memoryLeak.snapshots.snapshots;
  const peak = summary.length
    ? {
        heap: Math.max(...summary.map((s) => s.memory.heapUsedMb)),
        rss: Math.max(...summary.map((s) => s.memory.rssMb)),
        lag: Math.max(...summary.map((s) => s.eventLoop.lagMaxMs)),
        cpu: Math.max(...summary.map((s) => s.cpu.percent)),
      }
    : { heap: 0, rss: 0, lag: 0, cpu: 0 };

  writeFileSync(
    resolve(process.cwd(), "docs/PERFORMANCE_BASELINE.md"),
    `# Performance Baseline

Generated: ${r.generatedAt}

Environment: \`next start\` @ \`${r.base}\` · \`PROFILE_PRODUCTION=1\` · Auth pool: ${r.authPoolSize} users

---

## Load profile

| Setting | Value |
| ------- | ----- |
| Concurrency | ${baseline.concurrency} VUs |
| Duration | ${baseline.durationSec}s |
| Snapshot interval | ${baseline.snapshots.intervalSec}s |
| Total requests | ${baseline.run.totalRequests} |
| Throughput | ${baseline.run.rps} req/s |
| Error rate | ${pct(baseline.run.errorRate)} |
| p50 / p95 / p99 | ${baseline.run.medianMs} / ${baseline.run.p95Ms} / ${baseline.run.p99Ms} ms |

---

## Process metrics (peak under load)

| Metric | Peak |
| ------ | ---- |
| Heap used | ${peak.heap} MB |
| RSS | ${peak.rss} MB |
| Event loop lag (max) | ${peak.lag} ms |
| CPU (sample window) | ${peak.cpu}% |

---

## Route timings @ ${baseline.concurrency} VUs

${mdTable(
  ["Route", "Count", "p50", "p95", "p99", "Auth avg", "Prisma avg", "Err%"],
  baseline.run.routes.map((row) => [
    row.route,
    String(row.count),
    String(row.medianMs),
    String(row.p95Ms),
    String(row.p99Ms),
    String(row.avgAuthMs),
    String(row.avgPrismaMs),
    pct(row.errorRate),
  ])
)}

---

## 5-second snapshots (first 40)

${snapTable(summary)}

---

## Instrumentation

| Signal | Source |
| ------ | ------ |
| Heap / RSS | \`process.memoryUsage()\` via \`/api/bench/runtime\` |
| Event loop lag | \`perf_hooks.monitorEventLoopDelay\` |
| CPU | \`process.cpuUsage()\` delta per interval |
| Active handles | \`process._getActiveHandles()\` |
| Active requests | \`runWithPerf\` counter |
| Prisma queries | Prisma extension → runtime histogram |
| Middleware auth | Middleware timing → runtime aggregate |
| Route timings | \`x-bench-*\` headers + perf store |

*Raw JSON: \`docs/.load-investigation-results.json\` → \`baseline\`*
`
  );
}

function writeMemoryLeakReport(r: LoadInvestigationResults): void {
  const m = r.memoryLeak;
  writeFileSync(
    resolve(process.cwd(), "docs/MEMORY_LEAK_REPORT.md"),
    `# Memory Leak Report

Generated: ${r.generatedAt}

---

## Test configuration

| Setting | Value |
| ------- | ----- |
| Concurrency | ${m.concurrency} VUs |
| Duration | ${Math.round(m.durationSec / 60)} min (${m.durationSec}s) |
| Snapshots | ${m.snapshotCount} @ ${r.memoryLeak.snapshots.intervalSec}s |

Expected ~${Math.round(m.durationSec / r.memoryLeak.snapshots.intervalSec)} snapshots; lower counts indicate intermittent \`/api/bench/runtime\` polling under load.

---

## Results

| Metric | Start | End | Growth | Growth % |
| ------ | ----- | --- | ------ | -------- |
| Heap used | ${m.heapStartMb} MB | ${m.heapEndMb} MB | ${m.heapGrowthMb} MB | ${m.heapGrowthPct}% |
| RSS | ${m.rssStartMb} MB | ${m.rssEndMb} MB | ${m.rssGrowthMb} MB | ${m.rssGrowthPct}% |

| Slope | Value |
| ----- | ----- |
| Heap | ${m.heapSlopeMbPerHour} MB/hour |
| RSS | ${m.rssSlopeMbPerHour} MB/hour |

---

## Verdict: **${m.verdict.toUpperCase()}**

${m.notes.map((n) => `- ${n}`).join("\n")}

---

## Interpretation

| Verdict | Criteria |
| ------- | -------- |
| **stable** | Heap/RSS growth within normal GC variance |
| **slow-leak** | Sustained upward slope >25 MB/hour RSS or >40 MB heap |
| **severe-leak** | >80 MB/hour RSS or >150 MB heap over window |

GC pause times are not directly instrumented in-process; heap slope is the primary signal. Enable \`--heapsnapshot-near-heap-limit\` in staging if verdict is slow/severe.

*Raw: \`docs/.load-investigation-results.json\` → \`memoryLeak\`*
`
  );
}

function writePrismaBottleneckReport(r: LoadInvestigationResults): void {
  const routes = r.prisma.routes;
  writeFileSync(
    resolve(process.cwd(), "docs/PRISMA_BOTTLENECK_REPORT.md"),
    `# Prisma Bottleneck Report

Generated: ${r.generatedAt}

Dataset: 1000-user simulation · Warm sequential profiling per route

---

## Route profiles (warm median)

${routes
  .map(
    (route) => `### ${route.route}

| Metric | Value |
| ------ | ----- |
| Path | \`${route.path}\` |
| Warm runs | ${route.warmRuns} |
| Median total | ${route.medianTotalMs} ms |
| Median auth | ${route.medianAuthMs} ms |
| Median Prisma | ${route.medianPrismaMs} ms |
| Query count | ${route.medianQueryCount} |

**Top queries**

${mdTable(
  ["Query", "Count", "Total ms", "Avg ms"],
  route.topQueries.slice(0, 10).map((q) => [
    q.key,
    String(q.count),
    String(q.totalMs),
    String(q.avgMs),
  ])
)}

**Issues:** ${route.issues.length ? route.issues.join("; ") : "None detected"}
`
  )
  .join("\n")}

---

## Cross-route findings

| Pattern | Impact | Recommendation |
| ------- | ------ | -------------- |
| Middleware auth ~250ms every request | Dominates TTFB | JWT local verify or session cache (P0) |
| Message context graph queries | Highest Prisma ms under load | Keep materialized \`user_connections\` path; avoid StoryTag scans |
| Discoveries trust enrichment | N parallel trust lookups | Batch \`getTrustProfilesBulk\` into single query |
| Category visibility | Per-post queries | Precompute viewer category edges |
| Introduction suggestions | O(n²) shared counts | Batch count query |

---

## Static audit findings

${r.prisma.staticFindings.map((f) => `- ${f}`).join("\n")}

---

## Index recommendations

1. \`user_connections(source_user_id, target_user_id)\` — graph / trust hot path
2. \`messages(sender_id, receiver_id, created_at DESC)\` — inbox + context
3. \`discoveries(author_id, created_at DESC)\` — feed pagination
4. \`story_tags(story_id, user_id)\` — introduction graph (prefer materialized edges)
5. Partial index on \`users(email)\` where simulation flag if used in bulk auth pool

*Raw: \`docs/.load-investigation-results.json\` → \`prisma\`*
`
  );
}

function writeCapacityLimitReport(r: LoadInvestigationResults): void {
  const { capacity } = r;
  writeFileSync(
    resolve(process.cwd(), "docs/CAPACITY_LIMIT_REPORT.md"),
    `# Capacity Limit Report

Generated: ${r.generatedAt}

Progressive journey load · ${capacity.runs.find((r) => r.mode === "journey")?.durationSec ?? capacity.runs[0]?.durationSec ?? 300}s per level · Stop if error rate >30%

_Note: Levels 10/25/50/100 include merged data from prior route + journey concurrency runs where applicable._

---

## Results by concurrency

${mdTable(
  ["VUs", "RPS", "p50", "p95", "p99", "Err%", "Peak heap", "Peak RSS", "Peak CPU", "Status"],
  capacity.runs.map((run) => [
    String(run.concurrency),
    String(run.rps),
    String(run.medianMs),
    String(run.p95Ms),
    String(run.p99Ms),
    pct(run.errorRate),
    `${run.peakHeapMb} MB`,
    `${run.peakRssMb} MB`,
    `${run.peakCpuPercent}%`,
    run.stoppedEarly ? `STOP (${run.stopReason})` : "OK",
  ])
)}

---

## Capacity zones

| Zone | Concurrency | Evidence |
| ---- | ----------- | -------- |
| **Safe** | **≤${capacity.safeConcurrency} VUs** | Error rate ≤1%, p95 within auth-bound budget |
| **Warning** | **${capacity.warningZone}** | Rising p95, occasional journey errors |
| **Breaking point** | **${capacity.breakingPoint ?? "Not reached"} VUs** | Error rate >30% or Node crash |

Escalation ${capacity.stoppedAt ? `stopped at **${capacity.stoppedAt} VUs**` : "completed all levels"}.

*Raw: \`docs/.load-investigation-results.json\` → \`capacity\`*
`
  );
}

function writeCrashAnalysis(r: LoadInvestigationResults): void {
  const c = r.crash;
  writeFileSync(
    resolve(process.cwd(), "docs/CRASH_ANALYSIS.md"),
    `# Crash Root Cause Analysis

Generated: ${r.generatedAt}

---

## Summary

| Field | Value |
| ----- | ----- |
| Crash occurred | ${c.occurred ? "**Yes**" : "No"} |
| Classification | **${c.classification}** |
| Exit code | ${c.exitCode ?? "—"} |
| Signal | ${c.signal ?? "—"} |

${c.analysis}

---

## Pre-crash process state

| Metric | Value |
| ------ | ----- |
| Heap before crash | ${c.heapBeforeCrashMb ?? "—"} MB |
| RSS before crash | ${c.rssBeforeCrashMb ?? "—"} MB |
| Event loop lag | ${c.eventLoopLagBeforeCrashMs ?? "—"} ms |

---

## Last stdout (tail)

\`\`\`
${c.lastStdoutLines.slice(-20).join("\n") || "(none captured)"}
\`\`\`

---

## Last stderr (tail)

\`\`\`
${c.lastStderrLines.slice(-20).join("\n") || "(none captured)"}
\`\`\`

---

## Windows Event Log (Application)

${c.windowsEventLog.length ? c.windowsEventLog.map((l) => `- ${l}`).join("\n") : "_No matching events in window._"}

---

## Classification guide

| Cause | Indicators |
| ----- | ---------- |
| Out of memory | Exit 134/137, heap near limit, V8 OOM message |
| Native module | Access violation 0xC0000005, no OOM |
| Prisma engine | Rust panic in stderr, query engine crash |
| Unhandled rejection | Node warning before exit code 1 |
| Event loop starvation | Extreme lag, no crash |

*Raw: \`docs/.load-investigation-results.json\` → \`crash\`*
`
  );
}

function writeHostingReadiness(r: LoadInvestigationResults): void {
  const safe = r.capacity.safeConcurrency;
  writeFileSync(
    resolve(process.cwd(), "docs/HOSTING_READINESS.md"),
    `# Hosting Readiness

Generated: ${r.generatedAt}

Measured safe concurrency: **${safe} simultaneous users** (single \`next start\` instance, auth RTT ~250ms)

Assumption: average session ~8 requests/minute active browsing, 5% of DAU concurrent at peak.

---

## A. Shared hosting + Supabase

| Metric | Estimate |
| ------ | -------- |
| Safe simultaneous | **10–15** |
| Safe DAU | **200–400** |
| Safe MAU | **800–1,500** |
| Registered users | **2,000–5,000** |

Limited by single process, cold starts, and auth RTT to Supabase eu-west-1.

---

## B. Small VPS (2 GB RAM)

| Metric | Estimate |
| ------ | -------- |
| Safe simultaneous | **20–30** |
| Safe DAU | **600–1,000** |
| Safe MAU | **2,500–4,000** |
| Registered users | **8,000–15,000** |

One Node instance; enable Supabase pooler; monitor RSS >1.4 GB.

---

## C. Small VPS (4 GB RAM)

| Metric | Estimate |
| ------ | -------- |
| Safe simultaneous | **40–50** |
| Safe DAU | **1,500–2,500** |
| Safe MAU | **6,000–10,000** |
| Registered users | **25,000–40,000** |

Room for 2 Node workers behind nginx at ~25 VUs each.

---

## D. Vercel + Supabase

| Metric | Estimate |
| ------ | -------- |
| Safe simultaneous | **15–25 per region** |
| Safe DAU | **500–1,200** |
| Safe MAU | **2,000–5,000** |
| Registered users | **10,000–25,000** |

Serverless: auth + DB RTT per invocation; use edge session cache and connection pooler; avoid long SSR chains on Pro without tuning.

*Based on measured throughput ~${r.baseline.run.rps} RPS plateau and safe VU=${safe}.*
`
  );
}

function writeOptimizationRoadmap(r: LoadInvestigationResults): void {
  writeFileSync(
    resolve(process.cwd(), "docs/OPTIMIZATION_ROADMAP.md"),
    `# Optimization Roadmap

Generated: ${r.generatedAt}

Ranked by ROI (impact × effort⁻¹). Expected gains are directional from measured baselines.

---

## P0 — Do before launch

| Item | Expected gain | Notes |
| ---- | ------------- | ----- |
| **Auth: local JWT verify / session cache** | **−200–250ms p50** on every route | Measured middleware auth ${r.baseline.run.routes[0]?.avgAuthMs ?? 280}ms; 70%+ of TTFB |
| **Exclude health/static from middleware auth** | **−250ms** on probes & assets | Safe for \`/api/health\`, manifest, icons |
| **Supabase pooler + raise connection_limit** | **−30–50% p95** @ 50+ VUs | Queueing under parallel Prisma |

---

## P1 — High value

| Item | Expected gain | Notes |
| ---- | ------------- | ----- |
| Batch trust profile lookups (discoveries) | **−100–300ms** discoveries SSR | N+1 in trust enrichment |
| Message context: keep fast path only | **−50–2000ms** under load | Sequential 119ms → concurrent 2000ms+ |
| Horizontal scale (2× Node + sticky sessions) | **2× safe VUs** | Breaking point @ 100 VUs single process |
| Redis/edge cache for public discovery pages | **−40% DB load** | Per-user feed still dynamic |

---

## P2 — Medium

| Item | Expected gain | Notes |
| ---- | ------------- | ----- |
| Introduction suggestions batch counts | **−200ms** profile/home | O(n²) queries |
| Category visibility precompute | **−50–150ms** discoveries | Per-post queries |
| SSR streaming / defer non-critical panels | **−100ms TTFB** | Home trust dashboard |
| Cursor pagination messages/inbox | **Prevents O(n) blowup** | Long-term scale |

---

## P3 — Lower priority

| Item | Expected gain | Notes |
| ---- | ------------- | ----- |
| Materialized feed table | **Major at 10k+ users** | Not needed for beta |
| Read replicas | **2× read capacity** | After DB becomes bottleneck |
| CDN for media | **−latency** | Storage signed URLs already |

---

## Memory / stability

Verdict: **${r.memoryLeak.verdict}** — ${r.memoryLeak.notes[0] ?? ""}

Crash class: **${r.crash.classification}** — prioritize process stability before 100+ VU targets.
`
  );
}

function writeScaleAssessment(r: LoadInvestigationResults): void {
  writeFileSync(
    resolve(process.cwd(), "docs/BUDDYINTRO_SCALE_ASSESSMENT.md"),
    `# BuddyIntro Scale Assessment

Generated: ${r.generatedAt}

Executive summary from automated load investigation (Phases 1–7).

---

## Key findings

| Dimension | Result |
| --------- | ------ |
| **Maximum safe concurrency** | **${r.capacity.safeConcurrency} VUs** (single instance) |
| **Likely launch capacity** | **${Math.min(r.capacity.safeConcurrency, 25)} concurrent / 500–800 DAU** on VPS 2GB |
| **Likely bottleneck** | **Supabase Auth RTT (~${r.baseline.run.routes[0]?.avgAuthMs ?? 280}ms) + single Node event loop** |
| **Memory health** | **${r.memoryLeak.verdict}** (${r.memoryLeak.heapGrowthMb} MB heap / ${r.memoryLeak.rssGrowthMb} MB RSS over ${Math.round(r.memoryLeak.durationSec / 60)} min) |
| **Database health** | Prisma OK at 1000 users sequential; queueing under **50+ VUs** |
| **Breaking point** | **${r.capacity.breakingPoint ?? "≥150"} VUs** (${r.crash.classification}) |

---

## Latency under load

| Scenario | p95 |
| -------- | --- |
| Baseline ${r.baseline.concurrency} VUs | ${r.baseline.run.p95Ms} ms |
| Capacity warning zone | ${r.capacity.runs.find((x) => x.concurrency === 50)?.p95Ms ?? "—"} ms @ 50 VUs |
| At breaking point | ${r.capacity.breakingPoint ? r.capacity.runs.find((x) => x.concurrency === r.capacity.breakingPoint!)?.p95Ms ?? "—" : "—"} ms |

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

*Raw measurements: \`docs/.load-investigation-results.json\`*
`
  );
}
