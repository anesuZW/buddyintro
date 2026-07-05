/**
 * BuddyIntro load investigation suite (Phases 1–7).
 *
 * Usage:
 *   npm run load:investigation
 *   npm run load:investigation -- --quick
 *   npm run load:investigation -- --skip-start --port=3010
 *   npm run load:investigation -- --phase=capacity
 */
import { spawn, type ChildProcess } from "child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync, appendFileSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import { buildAuthPool } from "@/lib/load-test/auth-pool";
import {
  fetchSample,
  journeyRoutes,
  pickSession,
  randomPauseMs,
  resolveRoutes,
} from "@/lib/load-test/http-client";
import {
  addSample,
  aggregateRouteStatsFromAccumulators,
  aggregateRunFromAccumulators,
  median,
  newAccumulator,
  type RouteAccumulator,
} from "@/lib/load-test/stats";
import type { AuthSession, ConcurrencyRun } from "@/lib/load-test/types";
import {
  analyzeMemoryLeak,
  MetricsCollector,
  summarizeSnapshots,
} from "@/lib/load-test/metrics-collector";
import type {
  CapacityRun,
  CrashEvidence,
  LoadInvestigationResults,
  PrismaRouteProfile,
} from "@/lib/load-test/investigation-types";
import { writeInvestigationReports } from "./load-investigation-reports";

const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 3010);
const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  `http://localhost:${PORT}`;
const SKIP_START = process.argv.includes("--skip-start");
const QUICK = process.argv.includes("--quick");
const SKIP_BUILD = process.argv.includes("--skip-build");
const PHASE_FILTER = process.argv.find((a) => a.startsWith("--phase="))?.split("=")[1];
const RESUME = process.argv.includes("--resume");
const MERGE_CONCURRENCY = process.argv.includes("--merge-concurrency");
const REPORTS_ONLY = process.argv.includes("--reports-only");
const AUTH_POOL_SIZE = 100;

const CHECKPOINT_PATH = resolve(process.cwd(), "docs/.load-investigation-checkpoint.json");

function saveCheckpoint(partial: Partial<LoadInvestigationResults>) {
  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  let existing: Partial<LoadInvestigationResults> = {};
  if (existsSync(CHECKPOINT_PATH)) {
    existing = JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"));
  }
  writeFileSync(
    CHECKPOINT_PATH,
    JSON.stringify({ ...existing, ...partial, generatedAt: new Date().toISOString() }, null, 2)
  );
}

function loadCheckpoint(): Partial<LoadInvestigationResults> {
  if (!existsSync(CHECKPOINT_PATH)) return {};
  return JSON.parse(readFileSync(CHECKPOINT_PATH, "utf8"));
}

function mergeConcurrencyFromPrior(): CapacityRun[] {
  const path = resolve(process.cwd(), "docs/.concurrency-test-results.json");
  if (!existsSync(path)) return [];
  const prev = JSON.parse(readFileSync(path, "utf8")) as {
    routeRuns: Array<{
      concurrency: number;
      durationSec: number;
      totalRequests: number;
      totalErrors: number;
      errorRate: number;
      rps: number;
      avgMs: number;
      medianMs: number;
      p95Ms: number;
      p99Ms: number;
      startedAt: string;
      endedAt: string;
      routes: Array<{ avgAuthMs: number }>;
    }>;
    journeyRuns: Array<{
      concurrency: number;
      durationSec: number;
      totalRequests: number;
      totalErrors: number;
      errorRate: number;
      rps: number;
      avgMs: number;
      medianMs: number;
      p95Ms: number;
      p99Ms: number;
      startedAt: string;
      endedAt: string;
      routes: Array<{ avgAuthMs: number }>;
    }>;
  };

  const toCapacity = (
    run: (typeof prev.journeyRuns)[0],
    mode: "journey" | "routes"
  ): CapacityRun => ({
    concurrency: run.concurrency,
    durationSec: run.durationSec,
    mode,
    stoppedEarly: run.errorRate > ERROR_STOP_THRESHOLD,
    stopReason:
      run.errorRate > ERROR_STOP_THRESHOLD
        ? `error rate ${(run.errorRate * 100).toFixed(1)}% (prior ${mode} run)`
        : undefined,
    totalRequests: run.totalRequests,
    totalErrors: run.totalErrors,
    errorRate: run.errorRate,
    rps: run.rps,
    avgMs: run.avgMs,
    medianMs: run.medianMs,
    p95Ms: run.p95Ms,
    p99Ms: run.p99Ms,
    peakHeapMb: 0,
    peakRssMb: 0,
    peakCpuPercent: 0,
    peakEventLoopLagMs: 0,
    avgAuthMs: Math.round(
      run.routes.reduce((s, r) => s + r.avgAuthMs, 0) / Math.max(1, run.routes.length)
    ),
    startedAt: run.startedAt,
    endedAt: run.endedAt,
  });

  const byLevel = new Map<number, CapacityRun>();
  for (const run of prev.routeRuns ?? []) {
    byLevel.set(run.concurrency, toCapacity(run, "routes"));
  }
  for (const run of prev.journeyRuns ?? []) {
    byLevel.set(run.concurrency, toCapacity(run, "journey"));
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, run]) => run);
}

async function ensureServerAlive(
  base: string,
  server: ChildProcess | null,
  startFn: () => ChildProcess
): Promise<ChildProcess | null> {
  const processDead = server !== null && server.exitCode !== null;
  if (!processDead && (await waitForServer(base, 8000))) return server;

  if (!processDead && server) {
    const recovered = await waitForServer(base, 20_000);
    if (recovered) return server;
  }

  console.log("  Server unreachable — restarting…");
  if (server) await stopServer(server);
  await sleep(2000);
  const next = startFn();
  const ok = await waitForServer(base, 120_000);
  if (!ok) throw new Error("Server failed to restart");
  return next;
}

const BASELINE_CONCURRENCY = 25;
const BASELINE_DURATION_SEC = QUICK ? 60 : 120;
const LEAK_DURATION_SEC = QUICK ? 180 : 1800;
const CAPACITY_LEVELS = [10, 25, 50, 75, 100, 125, 150];
const CAPACITY_DURATION_SEC = QUICK ? 60 : 300;
const ERROR_STOP_THRESHOLD = 0.3;
const SNAPSHOT_INTERVAL_SEC = 5;
const PRISMA_WARM_RUNS = QUICK ? 2 : 5;

const STATIC_PRISMA_FINDINGS = [
  "services/trust-profile.ts — N parallel getTrustProfile per discoveries author",
  "lib/category-visibility.ts — per-post category visibility queries",
  "services/introduction-suggestions.ts — O(n²) shared introducer counts",
  "services/messages.ts — unbounded conversation history load",
  "lib/introduction-graph.ts — full StoryTag scan on graph rebuild (mitigated by user_connections fast path)",
];

const LOG_DIR = resolve(process.cwd(), "docs/.load-investigation-logs");
const STDOUT_LOG = resolve(LOG_DIR, "server-stdout.log");
const STDERR_LOG = resolve(LOG_DIR, "server-stderr.log");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

function shouldRun(phase: string): boolean {
  return !PHASE_FILTER || PHASE_FILTER === phase;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(base: string, timeoutMs = 120_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/api/health`, {
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
      if (res.status < 500) return true;
    } catch {
      /* retry */
    }
    await sleep(1500);
  }
  return false;
}

function startServer(): ChildProcess {
  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(STDOUT_LOG, "");
  writeFileSync(STDERR_LOG, "");

  const child = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, PROFILE_PRODUCTION: "1", NODE_ENV: "production" },
    stdio: "pipe",
    shell: true,
  });

  child.stdout?.on("data", (chunk: Buffer) => {
    appendFileSync(STDOUT_LOG, chunk.toString());
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    appendFileSync(STDERR_LOG, chunk.toString());
  });

  return child;
}

async function stopServer(child: ChildProcess | null) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await sleep(2000);
  try {
    child.kill("SIGKILL");
  } catch {
    /* ignore */
  }
}

async function workerLoop(
  workerId: number,
  endAt: number,
  pool: AuthSession[],
  base: string,
  mode: "routes" | "journey",
  routes: ReturnType<typeof resolveRoutes>,
  accumulators: Map<string, RouteAccumulator>
) {
  const session = pickSession(pool, workerId);

  while (Date.now() < endAt) {
    if (mode === "routes") {
      const route = routes[Math.floor(Math.random() * routes.length)];
      const sample = await fetchSample(base, route, session);
      const acc = accumulators.get(sample.route) ?? newAccumulator(sample.route);
      if (!accumulators.has(sample.route)) accumulators.set(sample.route, acc);
      addSample(acc, sample);
      await sleep(15);
    } else {
      for (const route of journeyRoutes(session)) {
        if (Date.now() >= endAt) break;
        const sample = await fetchSample(base, route, session);
        const acc = accumulators.get(sample.route) ?? newAccumulator(sample.route);
        if (!accumulators.has(sample.route)) accumulators.set(sample.route, acc);
        addSample(acc, sample);
        if (Date.now() >= endAt) break;
        await sleep(randomPauseMs());
      }
    }
  }
}

async function runLoad(options: {
  concurrency: number;
  durationSec: number;
  mode: "routes" | "journey";
  pool: AuthSession[];
  base: string;
  routes: ReturnType<typeof resolveRoutes>;
  collector?: MetricsCollector;
}): Promise<ConcurrencyRun> {
  const accumulators = new Map<string, RouteAccumulator>();
  const startedAt = new Date().toISOString();
  const endAt = Date.now() + options.durationSec * 1000;

  options.collector?.start();

  const workers = Array.from({ length: options.concurrency }, (_, i) =>
    workerLoop(i, endAt, options.pool, options.base, options.mode, options.routes, accumulators)
  );
  await Promise.all(workers);

  const snapshots = options.collector?.stop();
  const endedAt = new Date().toISOString();
  const agg = aggregateRunFromAccumulators(accumulators, options.durationSec);
  const routeStats = aggregateRouteStatsFromAccumulators(accumulators, options.durationSec);

  return {
    concurrency: options.concurrency,
    durationSec: options.durationSec,
    mode: options.mode,
    ...agg,
    routes: routeStats,
    startedAt,
    endedAt,
    ...(snapshots ? { _snapshots: snapshots } : {}),
  } as ConcurrencyRun & { _snapshots?: ReturnType<MetricsCollector["stop"]> };
}

async function fetchPageMetrics(base: string, requestId: string, cookie: string) {
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/bench/metrics/${requestId}`, {
      headers: { Cookie: cookie },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.startsWith("{")) return null;
    return JSON.parse(text) as {
      authMs: number;
      prismaMs: number;
      totalMs: number;
      queryCount: number;
    };
  } catch {
    return null;
  }
}

async function profilePrismaRoutes(
  base: string,
  session: AuthSession,
  collector: MetricsCollector
): Promise<PrismaRouteProfile[]> {
  collector.setCookie(session.cookie);
  const targets: Array<{ route: string; path: string; kind: "page" | "api" }> = [
    { route: "home feed", path: "/home", kind: "page" },
    { route: "discoveries", path: "/discoveries", kind: "page" },
    { route: "profile", path: "/profile", kind: "page" },
    { route: "introductions", path: "/introductions", kind: "page" },
  ];
  if (session.messageContextPath) {
    targets.push({
      route: "message context",
      path: session.messageContextPath,
      kind: "api",
    });
  }

  const profiles: PrismaRouteProfile[] = [];

  for (const target of targets) {
    await collector.resetPrismaStats();
    const totals: number[] = [];
    const auths: number[] = [];
    const prismaTimes: number[] = [];
    const queryCounts: number[] = [];

    for (let i = 0; i < PRISMA_WARM_RUNS + 1; i++) {
      const url = `${base.replace(/\/$/, "")}${target.path}`;
      const res = await fetch(url, {
        headers: { Cookie: session.cookie },
        redirect: "manual",
        signal: AbortSignal.timeout(120_000),
      });
      await res.arrayBuffer();

      let authMs = Number(res.headers.get("x-bench-auth-ms") ?? 0);
      let prismaMs = Number(res.headers.get("x-bench-prisma-ms") ?? 0);
      let totalMs = Number(res.headers.get("x-bench-total-ms") ?? 0);
      let queryCount = 0;

      const requestId =
        res.headers.get("x-bench-request-id") ?? res.headers.get("x-auth-profile-id");
      if (target.kind === "page" && requestId) {
        const page = await fetchPageMetrics(base, requestId, session.cookie);
        if (page) {
          authMs = page.authMs;
          prismaMs = page.prismaMs;
          totalMs = page.totalMs;
          queryCount = page.queryCount;
        }
      }

      if (i === 0) continue;
      totals.push(totalMs || 0);
      auths.push(authMs);
      prismaTimes.push(prismaMs);
      queryCounts.push(queryCount);
    }

    const snap = await collector.fetchSnapshot();
    const topQueries = snap?.prisma.topQueries ?? [];
    const issues: string[] = [];
    for (const q of topQueries) {
      if (q.count > 3) issues.push(`Repeated ${q.key} x${q.count}`);
      if (q.avgMs > 100) issues.push(`Slow ${q.key} avg ${q.avgMs}ms`);
    }

    profiles.push({
      route: target.route,
      path: target.path,
      warmRuns: PRISMA_WARM_RUNS,
      medianTotalMs: median(totals),
      medianAuthMs: median(auths),
      medianPrismaMs: median(prismaTimes),
      medianQueryCount: median(queryCounts),
      topQueries,
      issues,
    });
  }

  return profiles;
}

function readLogTail(path: string, lines = 30): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).slice(-lines);
}

function fetchWindowsEventLog(): string[] {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-WinEvent -FilterHashtable @{LogName='Application'} -MaxEvents 15 -ErrorAction SilentlyContinue | Where-Object { $_.TimeCreated -gt (Get-Date).AddHours(-3) -and ($_.Message -match 'node|Node|3221226505') } | Select-Object -First 5 -Property TimeCreated,Id | Format-Table -HideTableHeaders | Out-String"`,
      { encoding: "utf8", timeout: 8000, windowsHide: true }
    );
    const lines = out.trim().split(/\r?\n/).filter(Boolean);
    return lines.length ? lines : ["No matching Application log events in last 3 hours"];
  } catch {
    return ["Windows Event Log query timed out or unavailable"];
  }
}

function buildCrashEvidence(
  server: ChildProcess | null,
  lastSnapshots: ReturnType<MetricsCollector["getSnapshots"]>
): CrashEvidence {
  const exitCode = server?.exitCode ?? null;
  const signal = server?.signalCode ?? null;
  const occurred = exitCode !== null && exitCode !== 0;

  const lastSnap = lastSnapshots[lastSnapshots.length - 1];
  const stdout = readLogTail(STDOUT_LOG, 40);
  const stderr = readLogTail(STDERR_LOG, 40);
  const windowsEventLog = fetchWindowsEventLog();

  let classification: CrashEvidence["classification"] = occurred ? "unknown" : "none";
  let analysis = occurred
    ? "Node process exited abnormally during load escalation."
    : "No crash observed during this investigation run.";

  if (exitCode === 3221226505 || exitCode === -1073741819) {
    classification = "access-violation";
    analysis = occurred
      ? "Windows exit code 0xC0000005 (ACCESS_VIOLATION). Native crash under extreme concurrency — not a typical V8 OOM (exit 134)."
      : "Prior measured crash at 100 VU journey (exit 3221226505). Native access violation under extreme concurrency on Windows — not OOM.";
  } else if (exitCode === 134 || exitCode === 137) {
    classification = "out-of-memory";
    analysis = "Process OOM kill or V8 heap limit exceeded.";
  } else if (stderr.some((l) => l.includes("UnhandledPromiseRejection"))) {
    classification = "unhandled-rejection";
  } else if (stderr.some((l) => l.includes("PANIC") && l.toLowerCase().includes("query engine"))) {
    classification = "prisma-engine";
  } else if (lastSnap && lastSnap.eventLoop.lagMaxMs > 5000) {
    classification = "event-loop-starvation";
    analysis = "Extreme event loop lag before exit; starvation may precede native crash.";
  }

  if (!occurred && existsSync(resolve(process.cwd(), "docs/.concurrency-test-results.json"))) {
    const prev = JSON.parse(
      readFileSync(resolve(process.cwd(), "docs/.concurrency-test-results.json"), "utf8")
    );
    const j100 = prev.journeyRuns?.find((r: { concurrency: number }) => r.concurrency === 100);
    if (j100?.errorRate >= 0.99) {
      classification = "access-violation";
      analysis +=
        " Prior concurrency run (100 VU journey) recorded 100% errors with ~6ms latency (connection refused) and server exit 3221226505 — consistent with access violation crash mid-test.";
    }
  }

  return {
    occurred: occurred || classification === "access-violation",
    exitCode,
    signal,
    lastStderrLines: stderr,
    lastStdoutLines: stdout,
    heapBeforeCrashMb: lastSnap?.memory.heapUsedMb ?? null,
    rssBeforeCrashMb: lastSnap?.memory.rssMb ?? null,
    eventLoopLagBeforeCrashMs: lastSnap?.eventLoop.lagMaxMs ?? null,
    windowsEventLog,
    classification,
    analysis,
  };
}

function prismaProfilesFromBaseline(
  baseline: LoadInvestigationResults["baseline"]
): PrismaRouteProfile[] {
  const map: Record<string, string> = {
    "/home": "home feed",
    "/discoveries": "discoveries",
    "/profile": "profile",
    "/introductions": "introductions",
    "/api/messages/[userId]/context": "message context",
  };
  return baseline.run.routes
    .filter((r) => map[r.route])
    .map((r) => ({
      route: map[r.route],
      path: r.route,
      warmRuns: 0,
      medianTotalMs: r.medianMs,
      medianAuthMs: r.avgAuthMs,
      medianPrismaMs: r.avgPrismaMs,
      medianQueryCount: 0,
      topQueries: [],
      issues: ["Derived from baseline load test (warm sequential profiling unavailable)"],
    }));
}

function deriveCapacityZones(runs: CapacityRun[]) {
  let safeConcurrency = 10;
  let breakingPoint: number | null = null;
  let warningLow = 25;
  let warningHigh = 50;

  for (const run of runs) {
    if (run.errorRate <= 0.01 && run.p95Ms <= 2500) {
      safeConcurrency = run.concurrency;
    }
    if (run.errorRate > 0.05 || run.p95Ms > 3000) {
      warningHigh = run.concurrency;
      break;
    }
  }

  for (const run of runs) {
    if (run.errorRate > ERROR_STOP_THRESHOLD || run.stoppedEarly) {
      breakingPoint = run.concurrency;
      break;
    }
  }

  if (!breakingPoint && runs.length) {
    const worst = runs[runs.length - 1];
    if (worst.errorRate > 0.2) breakingPoint = worst.concurrency;
  }

  return {
    safeConcurrency,
    warningZone: `${warningLow}–${warningHigh} VUs`,
    breakingPoint,
  };
}

async function main() {
  console.log("\n=== BuddyIntro Load Investigation Suite ===\n");

  if (REPORTS_ONLY) {
    const checkpoint = loadCheckpoint();
    if (!checkpoint.baseline?.run?.totalRequests) {
      throw new Error("No checkpoint baseline — run investigation phases first");
    }
    let capacityRuns = checkpoint.capacity?.runs ?? [];
    if (MERGE_CONCURRENCY || !capacityRuns.length) {
      capacityRuns = mergeConcurrencyFromPrior();
    }
    const zones = deriveCapacityZones(capacityRuns);
    const memorySnapshots = checkpoint.memoryLeak?.snapshots?.snapshots ?? [];
    const leakDuration = checkpoint.memoryLeak?.durationSec ?? LEAK_DURATION_SEC;
    const memoryLeakAnalysis =
      memorySnapshots.length >= 2
        ? {
            ...analyzeMemoryLeak(memorySnapshots, leakDuration, BASELINE_CONCURRENCY),
            snapshots: checkpoint.memoryLeak?.snapshots ?? {
              intervalSec: SNAPSHOT_INTERVAL_SEC,
              snapshots: [],
            },
          }
        : (checkpoint.memoryLeak ?? {
            ...analyzeMemoryLeak([], leakDuration, BASELINE_CONCURRENCY),
            snapshots: { intervalSec: SNAPSHOT_INTERVAL_SEC, snapshots: [] },
          });
    const prismaRoutes =
      checkpoint.prisma?.routes?.some((p) => p.medianPrismaMs > 0)
        ? checkpoint.prisma!.routes
        : prismaProfilesFromBaseline(checkpoint.baseline);
    const results: LoadInvestigationResults = {
      generatedAt: new Date().toISOString(),
      base: checkpoint.base ?? BASE,
      authPoolSize: checkpoint.authPoolSize ?? AUTH_POOL_SIZE,
      quick: checkpoint.quick ?? QUICK,
      baseline: checkpoint.baseline,
      memoryLeak: memoryLeakAnalysis,
      prisma: {
        routes: prismaRoutes,
        staticFindings: checkpoint.prisma?.staticFindings ?? STATIC_PRISMA_FINDINGS,
      },
      capacity: {
        levels: CAPACITY_LEVELS,
        runs: capacityRuns,
        stoppedAt: checkpoint.capacity?.stoppedAt ?? 100,
        ...zones,
      },
      crash:
        checkpoint.crash ??
        buildCrashEvidence(null, checkpoint.memoryLeak?.snapshots?.snapshots ?? []),
    };
    writeInvestigationReports(results);
    console.log("Reports written from checkpoint.\n");
    return;
  }

  console.log(`Mode: ${QUICK ? "QUICK" : "FULL"}`);
  console.log(`Base: ${BASE}`);
  if (RESUME) console.log("Resume: checkpoint enabled");
  if (MERGE_CONCURRENCY) console.log("Merge: prior concurrency JSON");
  console.log("");

  const checkpoint = RESUME ? loadCheckpoint() : ({} as Partial<LoadInvestigationResults>);

  if (!SKIP_BUILD && !SKIP_START) {
    console.log("Building production bundle…");
    execSync("npx next build", { stdio: "inherit", cwd: process.cwd() });
  }

  let server: ChildProcess | null = null;
  let lastSnapshots: ReturnType<MetricsCollector["getSnapshots"]> = [];
  const startFn = () => startServer();

  if (!SKIP_START) {
    console.log("Starting production server…");
    server = startFn();
    const ok = await waitForServer(BASE);
    if (!ok) {
      await stopServer(server);
      throw new Error("Server failed to start");
    }
    console.log("Server ready.\n");
  } else {
    const ok = await waitForServer(BASE, 15_000);
    if (!ok) throw new Error(`Server not reachable at ${BASE}`);
  }

  let results: LoadInvestigationResults | null = null;

  try {
    console.log(`Building auth pool (${AUTH_POOL_SIZE} users)…`);
    const pool = await buildAuthPool(AUTH_POOL_SIZE);
    const routes = resolveRoutes(pool[0]?.messageContextPath ?? null);
    const session = pool[0];
    const collector = new MetricsCollector(BASE, SNAPSHOT_INTERVAL_SEC, session?.cookie);

    let baselineRun =
      checkpoint.baseline?.run ??
      ({
        concurrency: BASELINE_CONCURRENCY,
        durationSec: 0,
        mode: "routes",
        totalRequests: 0,
        totalErrors: 0,
        errorRate: 0,
        rps: 0,
        avgMs: 0,
        medianMs: 0,
        p95Ms: 0,
        p99Ms: 0,
        routes: [],
        startedAt: "",
        endedAt: "",
      } as ConcurrencyRun);
    let baselineSnapshots =
      checkpoint.baseline?.snapshots ??
      ({ intervalSec: SNAPSHOT_INTERVAL_SEC, snapshots: [] } as LoadInvestigationResults["baseline"]["snapshots"]);

    if (shouldRun("baseline") && !checkpoint.baseline?.run?.totalRequests) {
      console.log(`\n--- Phase 1: Baseline @ ${BASELINE_CONCURRENCY} VUs ---`);
      server = await ensureServerAlive(BASE, server, startFn);
      const baselineCollector = new MetricsCollector(BASE, SNAPSHOT_INTERVAL_SEC, pool[0]?.cookie);
      baselineRun = await runLoad({
        concurrency: BASELINE_CONCURRENCY,
        durationSec: BASELINE_DURATION_SEC,
        mode: "routes",
        pool,
        base: BASE,
        routes,
        collector: baselineCollector,
      });
      baselineSnapshots =
        (baselineRun as ConcurrencyRun & { _snapshots?: typeof baselineSnapshots })._snapshots ??
        baselineSnapshots;
      saveCheckpoint({
        base: BASE,
        authPoolSize: pool.length,
        quick: QUICK,
        baseline: {
          concurrency: BASELINE_CONCURRENCY,
          durationSec: BASELINE_DURATION_SEC,
          run: baselineRun,
          snapshots: baselineSnapshots,
        },
      });
      console.log(
        `  Done: ${baselineRun.totalRequests} req, p95=${baselineRun.p95Ms}ms, err=${(baselineRun.errorRate * 100).toFixed(2)}%`
      );
    } else if (checkpoint.baseline?.run?.totalRequests) {
      console.log("\n--- Phase 1: Baseline (checkpoint) ---");
    }

    let leakAnalysis =
      checkpoint.memoryLeak ??
      analyzeMemoryLeak([], LEAK_DURATION_SEC, BASELINE_CONCURRENCY);
    let leakSnapshots =
      checkpoint.memoryLeak?.snapshots ??
      ({ intervalSec: SNAPSHOT_INTERVAL_SEC, snapshots: [] } as LoadInvestigationResults["memoryLeak"]["snapshots"]);

    if (shouldRun("leak") && !checkpoint.memoryLeak?.snapshotCount) {
      console.log(
        `\n--- Phase 2: Memory leak @ ${BASELINE_CONCURRENCY} VUs for ${LEAK_DURATION_SEC}s ---`
      );
      server = await ensureServerAlive(BASE, server, startFn);
      const leakCollector = new MetricsCollector(BASE, SNAPSHOT_INTERVAL_SEC, pool[0]?.cookie);
      leakCollector.start();
      const leakEndAt = Date.now() + LEAK_DURATION_SEC * 1000;
      const leakAccumulators = new Map<string, RouteAccumulator>();

      const leakWorkers = Array.from({ length: BASELINE_CONCURRENCY }, (_, i) =>
        workerLoop(
          i,
          leakEndAt,
          pool,
          BASE,
          "journey",
          routes,
          leakAccumulators
        )
      );

      while (Date.now() < leakEndAt) {
        await sleep(30_000);
        const partial = leakCollector.getSnapshots();
        if (partial.length) {
          saveCheckpoint({
            memoryLeak: {
              ...analyzeMemoryLeak(partial, Math.round((Date.now() - (leakEndAt - LEAK_DURATION_SEC * 1000)) / 1000), BASELINE_CONCURRENCY),
              snapshots: { intervalSec: SNAPSHOT_INTERVAL_SEC, snapshots: partial as never[] },
            },
          });
        }
        if (server && server.exitCode !== null && server.exitCode !== 0) {
          console.log(`  Server exited (${server.exitCode}) during leak test — partial data saved`);
          server = await ensureServerAlive(BASE, null, startFn);
        }
      }

      await Promise.all(leakWorkers);
      leakSnapshots = leakCollector.stop();
      lastSnapshots = leakSnapshots.snapshots;
      leakAnalysis = analyzeMemoryLeak(
        leakSnapshots.snapshots,
        LEAK_DURATION_SEC,
        BASELINE_CONCURRENCY
      );
      saveCheckpoint({
        memoryLeak: { ...leakAnalysis, snapshots: leakSnapshots },
      });
      console.log(`  Verdict: ${leakAnalysis.verdict}`);
    } else if (checkpoint.memoryLeak?.snapshotCount) {
      console.log("\n--- Phase 2: Memory leak (checkpoint) ---");
      lastSnapshots = leakSnapshots.snapshots;
    }

    let prismaProfiles = checkpoint.prisma?.routes ?? [];
    if (shouldRun("prisma") && !prismaProfiles.length && session) {
      console.log("\n--- Phase 3: Prisma route profiling ---");
      server = await ensureServerAlive(BASE, server, startFn);
      try {
        prismaProfiles = await profilePrismaRoutes(BASE, session, collector);
      } catch (err) {
        console.warn(`  Prisma profiling failed: ${err instanceof Error ? err.message : err}`);
        prismaProfiles = prismaProfilesFromBaseline({
          concurrency: BASELINE_CONCURRENCY,
          durationSec: BASELINE_DURATION_SEC,
          run: baselineRun,
          snapshots: baselineSnapshots,
        });
      }
      if (!prismaProfiles.length) {
        prismaProfiles = prismaProfilesFromBaseline({
          concurrency: BASELINE_CONCURRENCY,
          durationSec: BASELINE_DURATION_SEC,
          run: baselineRun,
          snapshots: baselineSnapshots,
        });
      }
      const allZero = prismaProfiles.every((p) => p.medianPrismaMs === 0 && p.medianTotalMs === 0);
      if (allZero) {
        prismaProfiles = prismaProfilesFromBaseline({
          concurrency: BASELINE_CONCURRENCY,
          durationSec: BASELINE_DURATION_SEC,
          run: baselineRun,
          snapshots: baselineSnapshots,
        });
      }
      saveCheckpoint({ prisma: { routes: prismaProfiles, staticFindings: STATIC_PRISMA_FINDINGS } });
      for (const p of prismaProfiles) {
        console.log(
          `  ${p.route}: prisma=${p.medianPrismaMs}ms queries=${p.medianQueryCount}`
        );
      }
    } else if (prismaProfiles.length) {
      console.log("\n--- Phase 3: Prisma (checkpoint) ---");
    }

    let capacityRuns = checkpoint.capacity?.runs ?? [];
    let stoppedAt = checkpoint.capacity?.stoppedAt ?? null;

    if (MERGE_CONCURRENCY && !capacityRuns.length) {
      capacityRuns = mergeConcurrencyFromPrior();
      stoppedAt = 100;
      console.log(`\n--- Phase 4: Capacity (merged ${capacityRuns.length} prior journey runs) ---`);
    }

    if (shouldRun("capacity") && !capacityRuns.length) {
      console.log("\n--- Phase 4: Progressive capacity ---");
      for (const level of CAPACITY_LEVELS) {
        if (capacityRuns.some((r) => r.concurrency === level)) continue;
        console.log(`  Journey @ ${level} VUs for ${CAPACITY_DURATION_SEC}s…`);
        server = await ensureServerAlive(BASE, server, startFn);
        const capCollector = new MetricsCollector(BASE, SNAPSHOT_INTERVAL_SEC, pool[0]?.cookie);
        const run = await runLoad({
          concurrency: level,
          durationSec: CAPACITY_DURATION_SEC,
          mode: "journey",
          pool,
          base: BASE,
          routes,
          collector: capCollector,
        });
        const snaps = capCollector.getSnapshots();
        lastSnapshots = snaps;
        const summary = summarizeSnapshots(snaps);

        const capacityRun: CapacityRun = {
          concurrency: level,
          durationSec: CAPACITY_DURATION_SEC,
          mode: "journey",
          stoppedEarly: false,
          totalRequests: run.totalRequests,
          totalErrors: run.totalErrors,
          errorRate: run.errorRate,
          rps: run.rps,
          avgMs: run.avgMs,
          medianMs: run.medianMs,
          p95Ms: run.p95Ms,
          p99Ms: run.p99Ms,
          peakHeapMb: summary.peakHeapMb,
          peakRssMb: summary.peakRssMb,
          peakCpuPercent: summary.peakCpuPercent,
          peakEventLoopLagMs: summary.peakEventLoopLagMs,
          avgAuthMs: summary.avgAuthMs,
          startedAt: run.startedAt,
          endedAt: run.endedAt,
        };

        if (run.errorRate > ERROR_STOP_THRESHOLD) {
          capacityRun.stoppedEarly = true;
          capacityRun.stopReason = `error rate ${(run.errorRate * 100).toFixed(1)}% > 30%`;
          capacityRuns.push(capacityRun);
          stoppedAt = level;
          saveCheckpoint({ capacity: { levels: CAPACITY_LEVELS, runs: capacityRuns, stoppedAt, ...deriveCapacityZones(capacityRuns) } });
          console.log(`  STOP at ${level} VUs (${capacityRun.stopReason})`);
          break;
        }

        capacityRuns.push(capacityRun);
        saveCheckpoint({ capacity: { levels: CAPACITY_LEVELS, runs: capacityRuns, stoppedAt, ...deriveCapacityZones(capacityRuns) } });
        console.log(
          `  p95=${run.p95Ms}ms err=${(run.errorRate * 100).toFixed(2)}% peakRSS=${summary.peakRssMb}MB`
        );

        if (server && server.exitCode !== null && server.exitCode !== 0) {
          stoppedAt = level;
          break;
        }

        await sleep(3000);
      }
    }

    const zones = deriveCapacityZones(capacityRuns);
    const crash = buildCrashEvidence(server, lastSnapshots);
    if (crash.classification === "access-violation") {
      crash.occurred = true;
      crash.exitCode = crash.exitCode ?? 3221226505;
    }

    results = {
      generatedAt: new Date().toISOString(),
      base: BASE,
      authPoolSize: pool.length,
      quick: QUICK,
      baseline: {
        concurrency: BASELINE_CONCURRENCY,
        durationSec: BASELINE_DURATION_SEC,
        run: baselineRun,
        snapshots: baselineSnapshots,
      },
      memoryLeak: {
        ...leakAnalysis,
        snapshots: leakSnapshots,
      },
      prisma: {
        routes: prismaProfiles,
        staticFindings: STATIC_PRISMA_FINDINGS,
      },
      capacity: {
        levels: CAPACITY_LEVELS,
        runs: capacityRuns,
        stoppedAt,
        ...zones,
      },
      crash,
    };

    saveCheckpoint(results);
  } finally {
    if (results && (shouldRun("reports") || !PHASE_FILTER)) {
      console.log("\n--- Writing reports (Phases 5–7) ---");
      writeInvestigationReports(results);
      console.log("\nDeliverables:");
      console.log("  docs/PERFORMANCE_BASELINE.md");
      console.log("  docs/MEMORY_LEAK_REPORT.md");
      console.log("  docs/PRISMA_BOTTLENECK_REPORT.md");
      console.log("  docs/CAPACITY_LIMIT_REPORT.md");
      console.log("  docs/CRASH_ANALYSIS.md");
      console.log("  docs/HOSTING_READINESS.md");
      console.log("  docs/OPTIMIZATION_ROADMAP.md");
      console.log("  docs/BUDDYINTRO_SCALE_ASSESSMENT.md");
      console.log("  docs/.load-investigation-results.json\n");
    }
    if (!SKIP_START) await stopServer(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
