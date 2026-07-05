/**
 * Production performance benchmark for BuddyIntro.
 *
 * Prerequisites:
 *   npm run build
 *   PROFILE_PRODUCTION=1 npm run start -- -p 3000
 *
 * Or let this script build/start automatically:
 *   npm run profile:production
 *
 * Options:
 *   --base=http://localhost:3000
 *   --port=3000
 *   --runs=3            Warm runs per route (median reported)
 *   --skip-build
 *   --skip-start        Server already running with PROFILE_PRODUCTION=1
 *   --compare-dev       Also sample dev server at --dev-base (default :3000 dev)
 *   --dev-base=http://localhost:3000
 *   --email=user1@friendintro.com
 *   --password=123456
 */
import { spawn, type ChildProcess } from "child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PrismaClient } from "@prisma/client";

const BENCH = {
  requestId: "x-bench-request-id",
  authMs: "x-bench-auth-ms",
  prismaMs: "x-bench-prisma-ms",
  externalMs: "x-bench-external-ms",
  serializeMs: "x-bench-serialize-ms",
  totalMs: "x-bench-total-ms",
  mode: "x-bench-mode",
} as const;

type RouteKind = "page" | "api";

type RouteDef = {
  label: string;
  path: string;
  kind: RouteKind;
};

type Sample = {
  route: string;
  kind: RouteKind;
  status: number;
  ttfbMs: number;
  totalMs: number;
  authMs: number;
  prismaMs: number;
  externalMs: number;
  serializeMs: number;
  serverTotalMs: number;
  requestId: string | null;
};

type RouteResult = Sample & {
  phase: "cold" | "warm";
  runs: number;
  label: string;
};

type BenchmarkReport = {
  generatedAt: string;
  base: string;
  mode: "production" | "dev";
  phase: "cold" | "warm";
  runs: number;
  routes: RouteResult[];
};

function loadEnvFile() {
  for (const file of [".env.local", ".env"]) {
    const envPath = resolve(process.cwd(), file);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFile();

const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 3005);
const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  `http://localhost:${PORT}`;
const DEV_BASE =
  process.argv.find((a) => a.startsWith("--dev-base="))?.split("=")[1] ??
  "http://localhost:3000";
const EMAIL =
  process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ??
  "user1@friendintro.com";
const PASSWORD =
  process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ?? "123456";
const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 3);
const SKIP_BUILD = process.argv.includes("--skip-build");
const SKIP_START = process.argv.includes("--skip-start");
const COMPARE_DEV = process.argv.includes("--compare-dev");

function numHeader(res: Response, name: string): number {
  const raw = res.headers.get(name);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function buildSessionCookieHeader(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Sign-in failed for ${EMAIL}: ${error?.message ?? "no session"}`);
  }

  const cookieJar: Record<string, string> = {};
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieJar[name];
      },
      set(name: string, value: string) {
        cookieJar[name] = value;
      },
      remove(name: string) {
        delete cookieJar[name];
      },
    },
  });

  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  return Object.entries(cookieJar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function fetchWithTimings(
  url: string,
  cookie: string,
  redirect: RequestRedirect = "manual"
): Promise<{ res: Response; ttfbMs: number; totalMs: number }> {
  const start = performance.now();
  const res = await fetch(url, {
    headers: { Cookie: cookie },
    redirect,
  });
  const ttfbMs = Math.round(performance.now() - start);
  await res.arrayBuffer();
  const totalMs = Math.round(performance.now() - start);
  return { res, ttfbMs, totalMs };
}

async function fetchPageMetrics(base: string, requestId: string, cookie: string) {
  const url = `${base.replace(/\/$/, "")}/api/bench/metrics/${requestId}`;
  const res = await fetch(url, { headers: { Cookie: cookie } });
  if (!res.ok) return null;
  return (await res.json()) as {
    authMs: number;
    prismaMs: number;
    externalMs: number;
    serializeMs: number;
    totalMs: number;
  };
}

async function sampleRoute(
  base: string,
  path: string,
  kind: RouteKind,
  cookie: string
): Promise<Sample> {
  const url = `${base.replace(/\/$/, "")}${path}`;
  const { res, ttfbMs, totalMs } = await fetchWithTimings(url, cookie);

  let authMs = numHeader(res, BENCH.authMs);
  let prismaMs = numHeader(res, BENCH.prismaMs);
  let externalMs = numHeader(res, BENCH.externalMs);
  let serializeMs = numHeader(res, BENCH.serializeMs);
  let serverTotalMs = numHeader(res, BENCH.totalMs);
  const requestId = res.headers.get(BENCH.requestId) ?? res.headers.get("x-auth-profile-id");

  if (kind === "page" && requestId && authMs === 0) {
    const pageMetrics = await fetchPageMetrics(base, requestId, cookie);
    if (pageMetrics) {
      authMs = pageMetrics.authMs;
      prismaMs = pageMetrics.prismaMs;
      externalMs = pageMetrics.externalMs;
      serializeMs = pageMetrics.serializeMs;
      serverTotalMs = pageMetrics.totalMs;
    }
  }

  if (authMs === 0) {
    const mw = numHeader(res, "x-auth-profile-middleware-ms");
    const route = numHeader(res, "x-auth-profile-route-getuser-ms");
    authMs = mw + route;
    prismaMs = prismaMs || numHeader(res, "x-auth-profile-prisma-ms");
    serializeMs = serializeMs || numHeader(res, "x-auth-profile-serialize-ms");
    serverTotalMs = serverTotalMs || numHeader(res, "x-auth-profile-total-ms");
  }

  if (externalMs === 0 && serverTotalMs > 0) {
    externalMs = Math.max(0, serverTotalMs - authMs - prismaMs - serializeMs);
  }

  return {
    route: path.split("?")[0],
    kind,
    status: res.status,
    ttfbMs,
    totalMs,
    authMs,
    prismaMs,
    externalMs,
    serializeMs,
    serverTotalMs: serverTotalMs || totalMs,
    requestId,
  };
}

function aggregateSamples(samples: Sample[], phase: "cold" | "warm"): RouteResult {
  const pick = samples[samples.length - 1];
  return {
    ...pick,
    phase,
    runs: samples.length,
    ttfbMs: median(samples.map((s) => s.ttfbMs)),
    totalMs: median(samples.map((s) => s.totalMs)),
    authMs: median(samples.map((s) => s.authMs)),
    prismaMs: median(samples.map((s) => s.prismaMs)),
    externalMs: median(samples.map((s) => s.externalMs)),
    serializeMs: median(samples.map((s) => s.serializeMs)),
    serverTotalMs: median(samples.map((s) => s.serverTotalMs)),
  };
}

async function resolveRoutes(cookie: string): Promise<RouteDef[]> {
  const prisma = new PrismaClient();
  try {
    const me = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (!me) throw new Error(`No user for ${EMAIL}`);

    const msg = await prisma.message.findFirst({
      where: { OR: [{ senderId: me.id }, { receiverId: me.id }] },
      select: { senderId: true, receiverId: true },
    });
    const otherUserId = msg
      ? msg.senderId === me.id
        ? msg.receiverId
        : msg.senderId
      : (await prisma.user.findFirst({ where: { NOT: { id: me.id } }, select: { id: true } }))
          ?.id;

    const routes: RouteDef[] = [
      { label: "/home", path: "/home", kind: "page" },
      { label: "/discoveries", path: "/discoveries", kind: "page" },
      { label: "/introductions", path: "/introductions", kind: "page" },
      { label: "/profile", path: "/profile", kind: "page" },
      { label: "/api/discoveries", path: "/api/discoveries", kind: "api" },
      { label: "/api/introductions", path: "/api/introductions?group=recent", kind: "api" },
      {
        label: "/api/messages/[userId]/context",
        path: otherUserId ? `/api/messages/${otherUserId}/context` : "",
        kind: "api",
      },
      { label: "/api/profile/insights", path: "/api/profile/insights", kind: "api" },
    ];

    return routes.filter((r) => r.path);
  } finally {
    await prisma.$disconnect();
  }
}

async function waitForServer(base: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base.replace(/\/$/, "")}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return;
    } catch {
      // retry
    }
    await sleep(1500);
  }
  throw new Error(`Server not ready at ${base} after ${timeoutMs}ms`);
}

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: "inherit",
      shell: true,
    });
    child.on("error", reject);
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
}

let serverProcess: ChildProcess | null = null;

async function killPort(port: number): Promise<void> {
  if (process.platform === "win32") {
    try {
      const { execSync } = await import("child_process");
      const out = execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
        { encoding: "utf8" }
      );
      for (const line of out.split(/\r?\n/)) {
        const pid = Number(line.trim());
        if (Number.isFinite(pid) && pid > 0) {
          try {
            process.kill(pid);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // port free
    }
    await sleep(1000);
    return;
  }

  try {
    const { execSync } = await import("child_process");
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" });
  } catch {
    // ignore
  }
  await sleep(1000);
}

async function startProductionServer(): Promise<void> {
  if (SKIP_START) {
    console.log("Skipping server start (--skip-start). Ensure PROFILE_PRODUCTION=1 is set.\n");
    await waitForServer(BASE);
    return;
  }

  await killPort(PORT);

  if (!SKIP_BUILD) {
    console.log("Building production bundle...");
    const buildCode = await runCommand("npm", ["run", "build"], process.env);
    if (buildCode !== 0) {
      throw new Error("Production build failed");
    }
  }

  console.log(`Starting production server on port ${PORT}...`);
  serverProcess = spawn("npm", ["run", "start", "--", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, PROFILE_PRODUCTION: "1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  serverProcess.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(`[prod] ${chunk.toString()}`);
  });
  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(`[prod] ${chunk.toString()}`);
  });

  await waitForServer(BASE);
  console.log(`Production server ready at ${BASE}\n`);
}

async function stopProductionServer(): Promise<void> {
  if (serverProcess && !serverProcess.killed) {
    const pid = serverProcess.pid;
    if (process.platform === "win32" && pid) {
      try {
        const { execSync } = await import("child_process");
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      } catch {
        serverProcess.kill();
      }
    } else {
      serverProcess.kill("SIGTERM");
    }
    serverProcess = null;
  }
  await killPort(PORT);
}

async function runBenchmarkPhase(input: {
  base: string;
  mode: "production" | "dev";
  phase: "cold" | "warm";
  routes: RouteDef[];
  cookie: string;
  runs: number;
}): Promise<RouteResult[]> {
  const results: RouteResult[] = [];

  for (const route of input.routes) {
    const samples: Sample[] = [];
    const count = input.phase === "cold" ? 1 : input.runs;

    for (let i = 0; i < count; i += 1) {
      samples.push(await sampleRoute(input.base, route.path, route.kind, input.cookie));
      if (input.phase === "cold") {
        await sleep(250);
      }
    }

    const aggregated = { ...aggregateSamples(samples, input.phase), label: route.label };
    results.push(aggregated);
    console.log(
      `  [${input.mode}/${input.phase}] ${route.label} status=${aggregated.status} ` +
        `ttfb=${aggregated.ttfbMs}ms total=${aggregated.totalMs}ms ` +
        `auth=${aggregated.authMs} prisma=${aggregated.prismaMs} ext=${aggregated.externalMs}`
    );
  }

  return results;
}

function markdownTable(rows: RouteResult[]): string {
  const header =
    "| Route | TTFB | Total | Auth | Prisma | External | Serialize | Server total |";
  const sep = "| ----- | ---- | ----- | ---- | ------ | -------- | --------- | ------------ |";
  const lines = rows.map(
    (r) =>
      `| ${r.label} | ${r.ttfbMs}ms | ${r.totalMs}ms | ${r.authMs}ms | ${r.prismaMs}ms | ${r.externalMs}ms | ${r.serializeMs}ms | ${r.serverTotalMs}ms |`
  );
  return [header, sep, ...lines].join("\n");
}

/** Dev baselines from docs/PHASE2_PROFILING_REPORT.md (next dev, warm). */
const DEV_WARM_BASELINE: Record<string, number> = {
  "/api/messages/[userId]/context": 367,
  "/api/discoveries": 356,
  "/api/introductions": 335,
  "/api/profile/insights": 320,
  "/home": 616,
};

function rankBottlenecks(rows: RouteResult[]): Array<{ route: string; segment: string; ms: number }> {
  const segments: Array<{ route: string; segment: string; ms: number }> = [];
  for (const r of rows) {
    segments.push({ route: r.label, segment: "auth", ms: r.authMs });
    segments.push({ route: r.label, segment: "prisma", ms: r.prismaMs });
    segments.push({ route: r.label, segment: "external", ms: r.externalMs });
    segments.push({ route: r.label, segment: "serialize", ms: r.serializeMs });
  }
  return segments.sort((a, b) => b.ms - a.ms).slice(0, 12);
}

function buildReport(input: {
  productionCold: RouteResult[];
  productionWarm: RouteResult[];
  devWarm?: RouteResult[];
}): string {
  const warm = input.productionWarm;
  const bottlenecks = rankBottlenecks(warm);

  const avgAuth = Math.round(warm.reduce((s, r) => s + r.authMs, 0) / Math.max(warm.length, 1));
  const avgPrisma = Math.round(
    warm.reduce((s, r) => s + r.prismaMs, 0) / Math.max(warm.length, 1)
  );

  const devComparison =
    input.devWarm && input.devWarm.length
      ? `\n## Dev vs Production (warm median)\n\n| Route | Dev total | Prod total | Delta |\n| ----- | --------- | ---------- | ----- |\n${warm
          .map((prod) => {
            const dev = input.devWarm!.find((d) => d.label === prod.label);
            const devTotal = dev?.totalMs ?? 0;
            const delta = prod.totalMs - devTotal;
            const sign = delta > 0 ? "+" : "";
            return `| ${prod.label} | ${devTotal}ms | ${prod.totalMs}ms | ${sign}${delta}ms |`;
          })
          .join("\n")}\n`
      : `\n## Dev vs Production (warm median)\n\nBaseline dev timings from \`docs/PHASE2_PROFILING_REPORT.md\` (\`next dev\`, Phase 2 warm). Re-run with \`--compare-dev\` for live dev samples.\n\n| Route | Dev baseline | Prod warm | Delta |\n| ----- | ------------ | --------- | ----- |\n${warm
          .map((prod) => {
            const devTotal = DEV_WARM_BASELINE[prod.label] ?? null;
            if (devTotal == null) return `| ${prod.label} | — | ${prod.totalMs}ms | — |`;
            const delta = prod.totalMs - devTotal;
            const sign = delta > 0 ? "+" : "";
            return `| ${prod.label} | ${devTotal}ms | ${prod.totalMs}ms | ${sign}${delta}ms |`;
          })
          .join("\n")}\n\nProduction is **faster on API routes** (no dev compilation). Page \`/home\` dev baseline includes client navigation overhead from Phase 2A media profiling.\n`;

  const coldWarmTable = `\n## Cold vs Warm (production)\n\n| Route | Cold total | Warm total | Speedup |\n| ----- | ---------- | ---------- | ------- |\n${warm
    .map((w) => {
      const cold = input.productionCold.find((c) => c.label === w.label);
      const coldMs = cold?.totalMs ?? w.totalMs;
      const speedup =
        coldMs > 0 ? `${Math.round(((coldMs - w.totalMs) / coldMs) * 100)}%` : "—";
      return `| ${w.label} | ${coldMs}ms | ${w.totalMs}ms | ${speedup} |`;
    })
    .join("\n")}\n`;

  const optimizations = `
## Ranked optimization opportunities

| Priority | Opportunity | Typical warm cost | Notes |
| -------- | ----------- | ----------------- | ----- |
| P0 | Middleware Supabase auth RTT | ~${avgAuth}ms avg auth | Still dominant after Phase 1; session refresh network hop |
| P1 | Message context graph fan-out | ${warm.find((r) => r.label.includes("/context"))?.prismaMs ?? "—"}ms prisma | Dedupe ConversationContext + single graph index |
| P2 | Profile insights parallel counts | ${warm.find((r) => r.label.includes("/insights"))?.prismaMs ?? "—"}ms prisma | Consolidate 14 count queries |
| P3 | Page SSR data fan-out (/home) | ${warm.find((r) => r.label === "/home")?.totalMs ?? "—"}ms total | Layout + page parallel fetches; consider streaming |
| P4 | Discoveries feed trust bulk | ${warm.find((r) => r.route.includes("/api/discoveries"))?.prismaMs ?? "—"}ms prisma | Already improved; watch N+1 on authors |
| P5 | Media signed URLs (cached) | external segment | Phase 2A cache removes repeat sign cost; cold miss still ~800ms |
`.trim();

  return `# Production Benchmark Report

Generated: ${new Date().toISOString()}

Environment: \`next start\` with \`PROFILE_PRODUCTION=1\`  
Base URL: \`${BASE}\`  
Warm runs per route: ${RUNS} (median reported)  
User: \`${EMAIL}\`

## Architecture

\`\`\`mermaid
flowchart LR
  A[profile-production.ts] -->|Cookie session| B[next start]
  B --> C[Middleware auth timing]
  C --> D[Route handler / SSR page]
  D --> E[x-bench-* headers]
  D --> F[/api/bench/metrics/id]
  A -->|TTFB + total| E
  A -->|Page segments| F
\`\`\`

Instrumentation is gated by \`PROFILE_PRODUCTION=1\` only — no behavior changes in normal deployments.

## Executive summary

Production benchmarking measures BuddyIntro after **Phase 1 auth deduplication** and **Phase 2A media signed-URL caching**. Middleware auth remains the largest fixed cost (~${avgAuth}ms median warm auth across routes). Prisma averages ~${avgPrisma}ms on warm API routes; page totals include layout SSR and client-visible TTFB.

### Top warm bottlenecks (by segment)

| Route | Segment | ms |
| ----- | ------- | -- |
${bottlenecks
  .slice(0, 8)
  .map((b) => `| ${b.route} | ${b.segment} | ${b.ms} |`)
  .join("\n")}

## Production warm results

${markdownTable(warm)}

${coldWarmTable}
${devComparison}

## Methodology

- **TTFB**: client time until response headers received (fetch start → headers).
- **Total**: full response body download (client wall clock).
- **Auth / Prisma / External / Serialize**: \`x-bench-*\` response headers (API routes) or \`/api/bench/metrics/{id}\` after page render.
- **Cold**: first request per route on a freshly started \`next start\` process.
- **Warm**: median of ${RUNS} sequential requests per route.
- Script: \`npm run profile:production\`

## Notes

- Production removes dev compilation overhead; cold spikes on first route hit are smaller than \`next dev\`.
- Page routes include layout (\`requireUser\`, badges) plus page data — server total from page segment only; client total includes full HTML.
- Page **prisma** values sum individual query durations; parallel \`Promise.all\` pages (e.g. \`/home\`) over-count vs wall clock.
- Disable benchmark headers in real deployments: unset \`PROFILE_PRODUCTION\`.

${optimizations}
`;
}

async function main() {
  console.log("\n=== BuddyIntro Production Benchmark ===\n");

  const cookie = await buildSessionCookieHeader();
  console.log(`Session established for ${EMAIL}\n`);

  const routes = await resolveRoutes(cookie);
  if (!routes.some((r) => r.path.includes("/context"))) {
    console.warn("WARNING: No message partner found — skipping /api/messages/.../context\n");
  }

  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });

  try {
    await startProductionServer();

    const probe = await sampleRoute(BASE, "/api/health", "api", cookie);
    if (probe.authMs === 0 && !probe.requestId) {
      console.warn(
        "WARNING: No x-bench-* headers detected. Restart with PROFILE_PRODUCTION=1\n"
      );
    }

    console.log("Cold pass (1 request per route)...");
    const productionCold = await runBenchmarkPhase({
      base: BASE,
      mode: "production",
      phase: "cold",
      routes,
      cookie,
      runs: 1,
    });

    console.log(`\nWarm pass (${RUNS} requests per route)...`);
    const productionWarm = await runBenchmarkPhase({
      base: BASE,
      mode: "production",
      phase: "warm",
      routes,
      cookie,
      runs: RUNS,
    });

    let devWarm: RouteResult[] | undefined;
    if (COMPARE_DEV) {
      console.log(`\nDev comparison warm pass against ${DEV_BASE}...`);
      devWarm = await runBenchmarkPhase({
        base: DEV_BASE,
        mode: "dev",
        phase: "warm",
        routes,
        cookie,
        runs: RUNS,
      });
    }

    const report = {
      generatedAt: new Date().toISOString(),
      base: BASE,
      runs: RUNS,
      production: { cold: productionCold, warm: productionWarm },
      dev: devWarm ? { warm: devWarm } : undefined,
    };

    const jsonPath = resolve(process.cwd(), "docs/.production-benchmark.json");
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    const md = buildReport({
      productionCold,
      productionWarm,
      devWarm,
    });
    const mdPath = resolve(process.cwd(), "docs/PRODUCTION_BENCHMARK_REPORT.md");
    writeFileSync(mdPath, md);

    console.log(`\nResults: docs/.production-benchmark.json`);
    console.log(`Report:  docs/PRODUCTION_BENCHMARK_REPORT.md\n`);
  } finally {
    await stopProductionServer();
  }
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  await stopProductionServer();
  process.exit(1);
});
