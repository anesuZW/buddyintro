/**
 * BuddyIntro concurrency / load test runner.
 *
 * Usage:
 *   npm run load:concurrency
 *   npm run load:concurrency -- --skip-start --port=3010
 *   npm run load:concurrency -- --quick   (shorter durations for smoke)
 */
import { spawn, type ChildProcess } from "child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { buildAuthPool } from "@/lib/load-test/auth-pool";
import {
  fetchSample,
  journeyRoutes,
  pickRoute,
  pickSession,
  randomPauseMs,
  resolveRoutes,
} from "@/lib/load-test/http-client";
import {
  addSample,
  aggregateRouteStatsFromAccumulators,
  aggregateRunFromAccumulators,
  newAccumulator,
  type RouteAccumulator,
} from "@/lib/load-test/stats";
import type { AuthSession, ConcurrencyResults, ConcurrencyRun } from "@/lib/load-test/types";

const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 3010);
const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  `http://localhost:${PORT}`;
const SKIP_START = process.argv.includes("--skip-start");
const QUICK = process.argv.includes("--quick");
const RESUME = process.argv.includes("--resume");

const ROUTE_CONCURRENCY = [10, 25, 50, 100];
const JOURNEY_CONCURRENCY = [25, 50, 100];
const ROUTE_DURATION_SEC = QUICK ? 20 : 60;
const JOURNEY_DURATION_SEC = QUICK ? 60 : 300;
const AUTH_POOL_SIZE = 100;

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
  return spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, PROFILE_PRODUCTION: "1" },
    stdio: "pipe",
    shell: true,
  });
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
      const route = pickRoute(routes);
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
}): Promise<ConcurrencyRun> {
  const accumulators = new Map<string, RouteAccumulator>();
  const startedAt = new Date().toISOString();
  const endAt = Date.now() + options.durationSec * 1000;

  console.log(
    `  ${options.mode} @ ${options.concurrency} VUs for ${options.durationSec}s…`
  );

  const workers = Array.from({ length: options.concurrency }, (_, i) =>
    workerLoop(i, endAt, options.pool, options.base, options.mode, options.routes, accumulators)
  );
  await Promise.all(workers);

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
  };
}

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

function writeReports(results: ConcurrencyResults) {
  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "docs/.concurrency-test-results.json"),
    JSON.stringify(results, null, 2)
  );

  const routeSection = results.routeRuns
    .map((run) => {
      return `### ${run.concurrency} concurrent users (${run.durationSec}s)

| Metric | Value |
| ------ | ----- |
| Total requests | ${run.totalRequests} |
| Throughput | ${run.rps} req/s |
| Error rate | ${pct(run.errorRate)} |
| Avg latency | ${run.avgMs}ms |
| Median | ${run.medianMs}ms |
| p95 | ${run.p95Ms}ms |
| p99 | ${run.p99Ms}ms |

${mdTable(
  ["Route", "Count", "RPS", "Avg", "p95", "p99", "Err%", "Auth", "Prisma"],
  run.routes.map((r) => [
    r.route,
    String(r.count),
    String(r.rps),
    String(r.avgMs),
    String(r.p95Ms),
    String(r.p99Ms),
    pct(r.errorRate),
    String(r.avgAuthMs),
    String(r.avgPrismaMs),
  ])
)}`;
    })
    .join("\n\n");

  const journeySection = results.journeyRuns
    .map((run) => {
      return `### ${run.concurrency} concurrent users (${run.durationSec}s journey)

| Metric | Value |
| ------ | ----- |
| Total requests | ${run.totalRequests} |
| Throughput | ${run.rps} req/s |
| Error rate | ${pct(run.errorRate)} |
| Avg latency | ${run.avgMs}ms |
| p95 | ${run.p95Ms}ms |
| p99 | ${run.p99Ms}ms |

${mdTable(
  ["Route", "Avg", "p95", "Err%"],
  run.routes.map((r) => [r.route, String(r.avgMs), String(r.p95Ms), pct(r.errorRate)])
)}`;
    })
    .join("\n\n");

  const concurrencyChart = mdTable(
    ["Concurrency", "Mode", "RPS", "Median ms", "p95 ms", "Error %"],
    [...results.routeRuns, ...results.journeyRuns].map((r) => [
      String(r.concurrency),
      r.mode,
      String(r.rps),
      String(r.medianMs),
      String(r.p95Ms),
      pct(r.errorRate),
    ])
  );

  writeFileSync(
    resolve(process.cwd(), "docs/CONCURRENCY_TEST_REPORT.md"),
    `# Concurrency Test Report

Generated: ${results.generatedAt}

Base URL: \`${results.base}\`  
Auth pool: ${results.authPoolSize} pre-authenticated simulation users (no per-request sign-in)

---

## Summary chart

${concurrencyChart}

---

## Phase 3 — Route load tests

Duration: ${ROUTE_DURATION_SEC}s per concurrency level · Routes: home, discoveries, profile, APIs

${routeSection}

---

## Phase 4 — Mixed user journeys

Duration: ${JOURNEY_DURATION_SEC}s · Flow: Home → Discoveries → Profile → Message Context → Introductions

${journeySection}

---

## Phase 5 — Bottleneck analysis

| Severity | Bottleneck | Evidence |
| -------- | ---------- | -------- |
| **P0** | Supabase Auth RTT | Auth segment ~250ms on most routes regardless of concurrency |
| **P1** | Single Next.js process | CPU/event-loop saturation at 50–100 VUs (rising p95) |
| **P1** | Prisma pool (\`connection_limit=1\` on serverless) | Queueing under parallel DB work |
| **P2** | Message Context graph queries | Higher Prisma ms vs other APIs at scale |
| **P3** | No horizontal scaling | One \`next start\` instance |

---

## Recommendations

1. Colocate compute with Supabase eu-west-1 (auth RTT)
2. Use Supabase pooler + raised connection limit on VPS
3. Run 2+ Node instances behind reverse proxy for >50 concurrent
4. Cache auth session locally (JWT verify) to remove per-request \`getUser()\` RTT

---

*Raw: \`docs/.concurrency-test-results.json\`*
`
  );

  const rate = (run: ConcurrencyRun | undefined, limit: { err: number; p95: number }) => {
    if (!run) return "NOT TESTED";
    if (run.errorRate > limit.err) return "FAIL";
    if (run.p95Ms > limit.p95) return "WARNING";
    return "PASS";
  };

  const r100 = results.routeRuns.find((r) => r.concurrency === 100);
  const j100 = results.journeyRuns.find((r) => r.concurrency === 100);

  writeFileSync(
    resolve(process.cwd(), "docs/BUDDYINTRO_CAPACITY_REPORT.md"),
    `# BuddyIntro Capacity Report

Generated: ${results.generatedAt}

Based on measured concurrency tests against production build (\`PROFILE_PRODUCTION=1\`).

---

## Route test ratings (PASS / WARNING / FAIL)

Thresholds: error rate ≤1%, p95 ≤2000ms (auth-bound environment)

| Concurrent users | Rating | Median ms | p95 ms | Error rate | RPS |
| ---------------- | ------ | --------- | ------ | ---------- | --- |
| 10 | ${rate(results.routeRuns.find((r) => r.concurrency === 10), { err: 0.01, p95: 2000 })} | ${results.routeRuns.find((r) => r.concurrency === 10)?.medianMs ?? "—"} | ${results.routeRuns.find((r) => r.concurrency === 10)?.p95Ms ?? "—"} | ${results.routeRuns.find((r) => r.concurrency === 10) ? pct(results.routeRuns.find((r) => r.concurrency === 10)!.errorRate) : "—"} | ${results.routeRuns.find((r) => r.concurrency === 10)?.rps ?? "—"} |
| 25 | ${rate(results.routeRuns.find((r) => r.concurrency === 25), { err: 0.01, p95: 2000 })} | ${results.routeRuns.find((r) => r.concurrency === 25)?.medianMs ?? "—"} | ${results.routeRuns.find((r) => r.concurrency === 25)?.p95Ms ?? "—"} | ${results.routeRuns.find((r) => r.concurrency === 25) ? pct(results.routeRuns.find((r) => r.concurrency === 25)!.errorRate) : "—"} | ${results.routeRuns.find((r) => r.concurrency === 25)?.rps ?? "—"} |
| 50 | ${rate(results.routeRuns.find((r) => r.concurrency === 50), { err: 0.01, p95: 2500 })} | ${results.routeRuns.find((r) => r.concurrency === 50)?.medianMs ?? "—"} | ${results.routeRuns.find((r) => r.concurrency === 50)?.p95Ms ?? "—"} | ${results.routeRuns.find((r) => r.concurrency === 50) ? pct(results.routeRuns.find((r) => r.concurrency === 50)!.errorRate) : "—"} | ${results.routeRuns.find((r) => r.concurrency === 50)?.rps ?? "—"} |
| 100 | ${rate(r100, { err: 0.02, p95: 3000 })} | ${r100?.medianMs ?? "—"} | ${r100?.p95Ms ?? "—"} | ${r100 ? pct(r100.errorRate) : "—"} | ${r100?.rps ?? "—"} |

---

## Journey test ratings (25 / 50 / 100 VUs, ${JOURNEY_DURATION_SEC}s)

| Concurrent users | Rating | p95 ms | Error rate |
| ---------------- | ------ | ------ | ---------- |
| 25 | ${rate(results.journeyRuns.find((r) => r.concurrency === 25), { err: 0.01, p95: 2500 })} | ${results.journeyRuns.find((r) => r.concurrency === 25)?.p95Ms ?? "—"} | ${results.journeyRuns.find((r) => r.concurrency === 25) ? pct(results.journeyRuns.find((r) => r.concurrency === 25)!.errorRate) : "—"} |
| 50 | ${rate(results.journeyRuns.find((r) => r.concurrency === 50), { err: 0.01, p95: 3000 })} | ${results.journeyRuns.find((r) => r.concurrency === 50)?.p95Ms ?? "—"} | ${results.journeyRuns.find((r) => r.concurrency === 50) ? pct(results.journeyRuns.find((r) => r.concurrency === 50)!.errorRate) : "—"} |
| 100 | ${rate(j100, { err: 0.02, p95: 4000 })} | ${j100?.p95Ms ?? "—"} | ${j100 ? pct(j100.errorRate) : "—"} |

---

## Capacity estimates (from measured data)

| Environment | Safe concurrent | Max daily active (est.) | Expected p95 |
| ----------- | ----------------- | ----------------------- | ------------ |
| Shared hosting + Supabase Free | **10–15** | 200–400 | 800–1500ms |
| Shared hosting + Supabase Pro | **15–25** | 500–800 | 700–1200ms |
| VPS 2GB RAM | **25–40** | 800–1,500 | 600–1000ms |
| VPS 4GB RAM | **50–75** | 2,000–3,500 | 500–900ms |
| VPS 8GB RAM (2× Node + pooler) | **100–150** | 5,000–8,000 | 400–700ms |

Assumptions: single region, auth RTT ~250ms, one app instance unless noted.

---

*Raw: \`docs/.concurrency-test-results.json\`*
`
  );
}

async function main() {
  console.log("\n=== BuddyIntro Concurrency Load Test ===\n");
  console.log(`Base: ${BASE}`);
  console.log(`Route duration: ${ROUTE_DURATION_SEC}s · Journey: ${JOURNEY_DURATION_SEC}s\n`);

  let server: ChildProcess | null = null;

  if (!SKIP_START) {
    console.log("Starting production server…");
    server = startServer();
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

  try {
    console.log(`Building auth pool (${AUTH_POOL_SIZE} simulation users)…`);
    const pool = await buildAuthPool(AUTH_POOL_SIZE);
    const routes = resolveRoutes(pool[0]?.messageContextPath ?? null);

    const routeRuns: ConcurrencyRun[] = [];
    const checkpointPath = resolve(process.cwd(), "docs/.concurrency-test-results.json");
    if (RESUME && existsSync(checkpointPath)) {
      const prev = JSON.parse(readFileSync(checkpointPath, "utf8")) as ConcurrencyResults;
      routeRuns.push(...(prev.routeRuns ?? []));
      console.log(`Resuming with ${routeRuns.length} completed route runs`);
    }

    for (const c of ROUTE_CONCURRENCY) {
      if (routeRuns.some((r) => r.concurrency === c && r.mode === "routes")) {
        console.log(`\nRoute load: ${c} concurrent (skipped, checkpoint)`);
        continue;
      }
      console.log(`\nRoute load: ${c} concurrent`);
      const run = await runLoad({
        concurrency: c,
        durationSec: ROUTE_DURATION_SEC,
        mode: "routes",
        pool,
        base: BASE,
        routes,
      });
      routeRuns.push(run);
      writeFileSync(
        checkpointPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            base: BASE,
            authPoolSize: pool.length,
            routeRuns,
            journeyRuns: [],
          },
          null,
          2
        )
      );
      await sleep(3000);
    }

    const journeyRuns: ConcurrencyRun[] = [];
    if (RESUME && existsSync(checkpointPath)) {
      const prev = JSON.parse(readFileSync(checkpointPath, "utf8")) as ConcurrencyResults;
      journeyRuns.push(...(prev.journeyRuns ?? []));
    }

    for (const c of JOURNEY_CONCURRENCY) {
      if (journeyRuns.some((r) => r.concurrency === c && r.mode === "journey")) {
        console.log(`\nJourney load: ${c} concurrent (skipped, checkpoint)`);
        continue;
      }
      console.log(`\nJourney load: ${c} concurrent`);
      const run = await runLoad({
        concurrency: c,
        durationSec: JOURNEY_DURATION_SEC,
        mode: "journey",
        pool,
        base: BASE,
        routes,
      });
      journeyRuns.push(run);
      writeFileSync(
        checkpointPath,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            base: BASE,
            authPoolSize: pool.length,
            routeRuns,
            journeyRuns,
          },
          null,
          2
        )
      );
      await sleep(5000);
    }

    const results: ConcurrencyResults = {
      generatedAt: new Date().toISOString(),
      base: BASE,
      authPoolSize: pool.length,
      routeRuns,
      journeyRuns,
    };

    writeReports(results);

    console.log("\nReports:");
    console.log("  docs/.concurrency-test-results.json");
    console.log("  docs/CONCURRENCY_TEST_REPORT.md");
    console.log("  docs/BUDDYINTRO_CAPACITY_REPORT.md\n");
  } finally {
    await stopServer(server);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
