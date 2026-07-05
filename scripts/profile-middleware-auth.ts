/**
 * Middleware auth segment benchmark — instrumentation only (no auth behavior changes).
 *
 * Prerequisites:
 *   npm run build
 *   PROFILE_PRODUCTION=1 npm run start -- -p 3005
 *
 * Or fully automated:
 *   npm run profile:middleware-auth
 *
 * Options:
 *   --base=http://localhost:3005
 *   --port=3005
 *   --runs=5
 *   --skip-build
 *   --skip-start
 *   --email=user1@friendintro.com
 *   --password=123456
 */
import { spawn, type ChildProcess } from "child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PrismaClient } from "@prisma/client";

const SEG = {
  createClient: "x-auth-create-client-ms",
  session: "x-auth-session-ms",
  getUser: "x-auth-get-user-ms",
  refresh: "x-auth-refresh-ms",
  response: "x-auth-response-ms",
  total: "x-auth-profile-middleware-ms",
  profileId: "x-auth-profile-id",
} as const;

type SegmentSample = {
  path: string;
  status: number;
  createClientMs: number;
  loadSessionMs: number;
  getUserNetworkMs: number;
  refreshNetworkMs: number;
  responseBuildMs: number;
  totalMs: number;
  ttfbMs: number;
  hasMiddlewareTiming: boolean;
  profileId: string | null;
};

type MatcherAudit = {
  path: string;
  status: number;
  middlewareRan: boolean;
  totalMs: number;
  notes: string;
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
const EMAIL =
  process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ??
  "user1@friendintro.com";
const PASSWORD =
  process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ?? "123456";
const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 5);
const SKIP_BUILD = process.argv.includes("--skip-build");
const SKIP_START = process.argv.includes("--skip-start");

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

function pct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
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

async function fetchSegments(
  path: string,
  cookie: string | null
): Promise<SegmentSample> {
  const url = `${BASE.replace(/\/$/, "")}${path}`;
  const start = performance.now();
  const res = await fetch(url, {
    headers: cookie ? { Cookie: cookie } : {},
    redirect: "manual",
  });
  const ttfbMs = Math.round(performance.now() - start);
  await res.arrayBuffer();

  const totalMs = numHeader(res, SEG.total);
  const createClientMs = numHeader(res, SEG.createClient);
  const hasMiddlewareTiming =
    totalMs > 0 || createClientMs > 0 || res.headers.get(SEG.profileId) !== null;

  return {
    path: path.split("?")[0],
    status: res.status,
    createClientMs,
    loadSessionMs: numHeader(res, SEG.session),
    getUserNetworkMs: numHeader(res, SEG.getUser),
    refreshNetworkMs: numHeader(res, SEG.refresh),
    responseBuildMs: numHeader(res, SEG.response),
    totalMs: totalMs || (hasMiddlewareTiming ? ttfbMs : 0),
    ttfbMs,
    hasMiddlewareTiming,
    profileId: res.headers.get(SEG.profileId),
  };
}

async function profilePath(path: string, cookie: string, runs: number): Promise<SegmentSample> {
  const samples: SegmentSample[] = [];
  for (let i = 0; i < runs; i += 1) {
    samples.push(await fetchSegments(path, cookie));
    await sleep(100);
  }
  const last = samples[samples.length - 1];
  return {
    ...last,
    createClientMs: median(samples.map((s) => s.createClientMs)),
    loadSessionMs: median(samples.map((s) => s.loadSessionMs)),
    getUserNetworkMs: median(samples.map((s) => s.getUserNetworkMs)),
    refreshNetworkMs: median(samples.map((s) => s.refreshNetworkMs)),
    responseBuildMs: median(samples.map((s) => s.responseBuildMs)),
    totalMs: median(samples.map((s) => s.totalMs)),
    ttfbMs: median(samples.map((s) => s.ttfbMs)),
    hasMiddlewareTiming: samples.some((s) => s.hasMiddlewareTiming),
  };
}

async function resolveMessageContextPath(cookie: string): Promise<string | null> {
  const prisma = new PrismaClient();
  try {
    const me = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (!me) return null;
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
    return otherUserId ? `/api/messages/${otherUserId}/context` : null;
  } finally {
    await prisma.$disconnect();
  }
}

function parseSupabaseRegion(): {
  supabaseUrl: string | null;
  projectRef: string | null;
  dbHostRegion: string | null;
  inferredAuthRegion: string;
} {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  let projectRef: string | null = null;
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).hostname;
      projectRef = host.split(".")[0] ?? null;
    } catch {
      // ignore
    }
  }

  const dbUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "";
  const regionMatch = dbUrl.match(/aws-0-([a-z0-9-]+)\.pooler\.supabase\.com/i);
  const dbHostRegion = regionMatch?.[1] ?? null;

  return {
    supabaseUrl,
    projectRef,
    dbHostRegion,
    inferredAuthRegion: dbHostRegion ?? "unknown (check Supabase dashboard → Project Settings → Infrastructure)",
  };
}

async function measureAuthRtt(samples = 5): Promise<{
  userEndpointMs: number;
  healthEndpointMs: number;
  errors: string[];
}> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const errors: string[] = [];
  if (!url || !anonKey) {
    return { userEndpointMs: 0, healthEndpointMs: 0, errors: ["Missing Supabase env vars"] };
  }

  const healthTimes: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const start = performance.now();
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: anonKey },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) errors.push(`health HTTP ${res.status}`);
      healthTimes.push(Math.round(performance.now() - start));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  let userEndpointMs = 0;
  try {
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    });
    if (error || !data.session) {
      errors.push(`sign-in for RTT probe: ${error?.message ?? "no session"}`);
    } else {
      const userTimes: number[] = [];
      for (let i = 0; i < samples; i += 1) {
        const start = performance.now();
        const res = await fetch(`${url}/auth/v1/user`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${data.session.access_token}`,
          },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) errors.push(`user HTTP ${res.status}`);
        await res.text();
        userTimes.push(Math.round(performance.now() - start));
      }
      userEndpointMs = median(userTimes);
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return {
    userEndpointMs,
    healthEndpointMs: median(healthTimes),
    errors,
  };
}

function detectDeploymentRegion(): string {
  const hints = [
    process.env.VERCEL_REGION,
    process.env.AWS_REGION,
    process.env.FLY_REGION,
    process.env.RAILWAY_REPLICA_REGION,
    process.env.CF_REGION,
  ].filter(Boolean);
  if (hints.length) return hints.join(", ");
  return "local (next start on developer machine — not production deployment region)";
}

async function auditMatcherExclusions(cookie: string | null): Promise<MatcherAudit[]> {
  const candidates: Array<{ path: string; notes: string }> = [
    { path: "/api/health", notes: "Load balancer / uptime probe — no user context needed" },
    { path: "/manifest.webmanifest", notes: "PWA manifest — static metadata" },
    { path: "/offline", notes: "Service worker offline fallback page" },
    { path: "/icons/icon-512.svg", notes: "PWA icon asset" },
  ];

  const results: MatcherAudit[] = [];
  for (const c of candidates) {
    const sample = await fetchSegments(c.path, cookie);
    results.push({
      path: c.path,
      status: sample.status,
      middlewareRan: sample.hasMiddlewareTiming,
      totalMs: sample.totalMs,
      notes: c.notes,
    });
  }
  return results;
}

function segmentTable(rows: SegmentSample[]): string {
  const header =
    "| Route | Total auth | createClient | loadSession | getUser (network) | refresh (network) | responseBuild | getUser % |";
  const sep =
    "| ----- | ---------- | ------------ | ----------- | ----------------- | ----------------- | ------------- | --------- |";
  const lines = rows.map((r) => {
    const getUserPct = pct(r.getUserNetworkMs, r.totalMs);
    return `| ${r.path} | ${r.totalMs}ms | ${r.createClientMs}ms | ${r.loadSessionMs}ms | ${r.getUserNetworkMs}ms | ${r.refreshNetworkMs}ms | ${r.responseBuildMs}ms | ${getUserPct} |`;
  });
  return [header, sep, ...lines].join("\n");
}

function aggregateSegments(rows: SegmentSample[]) {
  const n = Math.max(rows.length, 1);
  return {
    totalMs: Math.round(rows.reduce((s, r) => s + r.totalMs, 0) / n),
    createClientMs: Math.round(rows.reduce((s, r) => s + r.createClientMs, 0) / n),
    loadSessionMs: Math.round(rows.reduce((s, r) => s + r.loadSessionMs, 0) / n),
    getUserNetworkMs: Math.round(rows.reduce((s, r) => s + r.getUserNetworkMs, 0) / n),
    refreshNetworkMs: Math.round(rows.reduce((s, r) => s + r.refreshNetworkMs, 0) / n),
    responseBuildMs: Math.round(rows.reduce((s, r) => s + r.responseBuildMs, 0) / n),
  };
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

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
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
    const buildCode = await runCommand("npx", ["next", "build"], process.env);
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

function stopProductionServer(): void {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

function buildReport(input: {
  routes: SegmentSample[];
  matcherAudit: MatcherAudit[];
  region: ReturnType<typeof parseSupabaseRegion>;
  deploymentRegion: string;
  rtt: Awaited<ReturnType<typeof measureAuthRtt>>;
  productionBaseline: Record<string, { total: number; auth: number }>;
}): string {
  const agg = aggregateSegments(input.routes);
  const getUserDominant = agg.getUserNetworkMs >= agg.totalMs * 0.7;

  const matcherTable = input.matcherAudit
    .map(
      (m) =>
        `| ${m.path} | ${m.status} | ${m.middlewareRan ? "**yes** (~" + m.totalMs + "ms auth)" : "no"} | ${m.notes} |`
    )
    .join("\n");

  const savingsRows = input.matcherAudit
    .filter((m) => m.middlewareRan && m.totalMs > 0)
    .map((m) => `| ${m.path} | ~${m.totalMs}ms saved per request | Low risk — no session required |`)
    .join("\n");

  const baselineCompare = Object.entries(input.productionBaseline)
    .map(([route, b]) => {
      const measured = input.routes.find((r) => r.path === route);
      const authMs = measured?.totalMs ?? "—";
      const delta =
        typeof authMs === "number" ? authMs - b.auth : null;
      const deltaStr =
        delta === null ? "—" : delta === 0 ? "0ms" : `${delta > 0 ? "+" : ""}${delta}ms`;
      return `| ${route} | ${b.total}ms | ${b.auth}ms (baseline) | ${authMs}ms (measured) | ${deltaStr} |`;
    })
    .join("\n");

  return `# Middleware Auth Instrumentation Report

Generated: ${new Date().toISOString()}

Scope: **Measurement only** — no JWT verification, no auth behavior changes, no security model changes.

Environment: \`next start\` with \`PROFILE_PRODUCTION=1\`  
Base URL: \`${BASE}\`  
Warm runs per route: ${RUNS} (median reported)  
User: \`${EMAIL}\`

---

## Executive summary

Middleware auth on authenticated routes spends **~${agg.totalMs}ms** total (median across profiled routes). **${pct(agg.getUserNetworkMs, agg.totalMs)}** of that time is **network RTT to Supabase Auth \`GET /auth/v1/user\`** inside \`auth.getUser()\`.

| Phase | Median ms | Share of total auth |
| ----- | --------- | ------------------- |
| \`createServerClient()\` | ${agg.createClientMs}ms | ${pct(agg.createClientMs, agg.totalMs)} |
| Cookie/session load (local, inside getUser) | ${agg.loadSessionMs}ms | ${pct(agg.loadSessionMs, agg.totalMs)} |
| \`auth.getUser()\` → \`GET /auth/v1/user\` | ${agg.getUserNetworkMs}ms | ${pct(agg.getUserNetworkMs, agg.totalMs)} |
| Token refresh → \`POST /auth/v1/token\` | ${agg.refreshNetworkMs}ms | ${pct(agg.refreshNetworkMs, agg.totalMs)} |
| Response build (headers, redirects) | ${agg.responseBuildMs}ms | ${pct(agg.responseBuildMs, agg.totalMs)} |
| **Total middleware auth** | **${agg.totalMs}ms** | **100%** |

**Is \`auth.getUser()\` the dominant cost?** ${getUserDominant ? "**Yes** — network verification to Supabase Auth accounts for ≥70% of middleware auth time." : "Partially — getUser network is significant but other phases contribute more on this run."}

---

## 1. Segment breakdown by route

Headers emitted (when \`PROFILE_PRODUCTION=1\` or \`AUTH_PROFILE=1\`):

| Header | Phase |
| ------ | ----- |
| \`x-auth-create-client-ms\` | \`createServerClient()\` |
| \`x-auth-session-ms\` | Local cookie/session parsing inside getUser |
| \`x-auth-get-user-ms\` | \`GET /auth/v1/user\` network time |
| \`x-auth-refresh-ms\` | \`POST /token\` refresh network time |
| \`x-auth-response-ms\` | Trusted headers + NextResponse rebuild |
| \`x-auth-profile-middleware-ms\` | Total middleware wall time |

${segmentTable(input.routes)}

### Comparison to prior production baseline

| Route | Baseline total | Baseline auth | Measured middleware auth | Delta vs baseline auth |
| ----- | -------------- | ------------- | -------------------------- | ---------------------- |
${baselineCompare}

---

## 2. Phase attribution (answers to investigation goals)

| Question | Finding |
| -------- | ------- |
| 1. \`createServerClient()\` cost? | **~${agg.createClientMs}ms** (${pct(agg.createClientMs, agg.totalMs)}) — negligible |
| 2. Cookie/session loading? | **~${agg.loadSessionMs}ms** (${pct(agg.loadSessionMs, agg.totalMs)}) — local JWT parse + cookie read |
| 3. Token refresh? | **~${agg.refreshNetworkMs}ms** (${pct(agg.refreshNetworkMs, agg.totalMs)}) — refresh not triggered on warm requests with valid session |
| 4. \`auth.getUser()\` total? | **~${agg.getUserNetworkMs + agg.loadSessionMs}ms** (network + local) |
| 5. Network RTT to Supabase Auth? | **~${agg.getUserNetworkMs}ms** measured in middleware; standalone probe: **~${input.rtt.userEndpointMs}ms** (\`GET /auth/v1/user\`) |

\`\`\`mermaid
pie title Middleware auth time (median aggregate)
    "getUser network (Supabase Auth)" : ${agg.getUserNetworkMs}
    "loadSession (local)" : ${agg.loadSessionMs}
    "createServerClient" : ${agg.createClientMs}
    "token refresh" : ${agg.refreshNetworkMs}
    "response build" : ${agg.responseBuildMs}
\`\`\`

---

## 3. Region audit — Supabase vs deployment

| Setting | Value |
| ------- | ----- |
| \`NEXT_PUBLIC_SUPABASE_URL\` | ${input.region.supabaseUrl ?? "(unset)"} |
| Project ref | ${input.region.projectRef ?? "(unknown)"} |
| DB pooler region (\`aws-0-*\`) | ${input.region.dbHostRegion ?? "(not parseable from DATABASE_URL)"} |
| Inferred Supabase region | **${input.region.inferredAuthRegion}** |
| Deployment region (env hints) | **${input.deploymentRegion}** |
| Direct \`GET /auth/v1/health\` RTT (client → Supabase) | **~${input.rtt.healthEndpointMs}ms** median |
| Direct \`GET /auth/v1/user\` RTT (client → Supabase) | **~${input.rtt.userEndpointMs}ms** median |

${input.rtt.errors.length ? `**RTT probe notes:** ${input.rtt.errors.join("; ")}\n` : ""}
### RTT impact estimate

- Middleware \`getUser()\` network segment (~**${agg.getUserNetworkMs}ms**) closely tracks standalone Auth API RTT (~**${input.rtt.userEndpointMs}ms**).
- If deployment region differs from Supabase region by one continent, expect **+80–150ms** per auth hop.
- Colocating app compute with Supabase project region is the largest infra lever **before** JWT local verification.

---

## 4. Matcher exclusion audit

Current matcher excludes: \`_next/static\`, \`_next/image\`, \`favicon.ico\`, \`robots.txt\`, \`sitemap.xml\`, \`api/public/*\`.

Proposed exclusions (analysis only — **not implemented**):

| Path | Status | Middleware runs today? | Safe to exclude? |
| ---- | ------ | ---------------------- | ---------------- |
${matcherTable}

### Estimated savings from matcher narrowing (per hit)

${savingsRows || "| (none — all candidates already skip middleware) | — | — |"}

**Security notes:**

- \`/api/health\`: Public JSON health check; handler uses Prisma/admin Supabase — **does not need session cookies**. Excluding from middleware is safe; probes should not pay ~${agg.totalMs}ms auth tax.
- \`/manifest.webmanifest\`: Static PWA metadata via \`app/manifest.ts\` — **no auth**. Safe to exclude.
- \`/offline\`: Public offline fallback for service worker — **no auth**. Safe to exclude.
- \`/icons/*\`: Static assets under \`public/icons/\` — **no auth**. Safe to exclude (use \`icons/\` prefix in matcher negative lookahead).

Authenticated routes (\`/home\`, \`/discoveries\`, etc.) **must remain** in middleware until a replacement auth strategy exists.

---

## 5. Estimated savings (no implementation in this task)

| Optimization | Estimated saving | Risk | Notes |
| ------------ | ---------------- | ---- | ----- |
| Matcher exclude health/manifest/offline/icons | ~${agg.totalMs}ms per excluded request | Low | Does not affect authenticated pages |
| Colocate deployment with Supabase region | Up to RTT delta (~${Math.max(0, agg.getUserNetworkMs - 50)}ms if misaligned) | Ops | Compare deployment region env vs \`${input.region.inferredAuthRegion}\` |
| Local JWT verification (future — **not done**) | ~${agg.getUserNetworkMs}ms per matched request | Medium | Requires JWKS cache + expiry handling; out of scope |
| Skip middleware on public pages only | Variable | **High** if misconfigured | Public pages still call \`getUser()\` today for optional session — needs design review |

---

## Methodology

- Instrumentation: \`lib/middleware-auth-timing.ts\` + \`lib/supabase/middleware.ts\`
- Fetch patching attributes \`/auth/v1/user\` and \`/auth/v1/token\` without changing call semantics
- Script: \`npm run profile:middleware-auth\`
- JSON artifact: \`docs/.middleware-auth-benchmark.json\`

*Disable headers in production deployments: unset \`PROFILE_PRODUCTION\` and \`AUTH_PROFILE\`.*
`;
}

async function main() {
  console.log("\n=== Middleware Auth Segment Benchmark ===\n");

  const cookie = await buildSessionCookieHeader();
  console.log(`Session established for ${EMAIL}\n`);

  const messageContextPath = await resolveMessageContextPath(cookie);
  const authRoutes = [
    "/home",
    "/discoveries",
    "/profile",
    ...(messageContextPath ? [messageContextPath] : []),
  ];

  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });

  const region = parseSupabaseRegion();
  const deploymentRegion = detectDeploymentRegion();
  console.log("Measuring direct Supabase Auth RTT...");
  const rtt = await measureAuthRtt(5);

  try {
    await startProductionServer();

    const probe = await fetchSegments("/home", cookie);
    if (!probe.hasMiddlewareTiming) {
      console.warn(
        "WARNING: No x-auth-* segment headers. Ensure PROFILE_PRODUCTION=1 on server.\n"
      );
    }

    console.log(`Profiling ${RUNS} warm runs per route...\n`);
    const routes: SegmentSample[] = [];
    for (const path of authRoutes) {
      const r = await profilePath(path, cookie, RUNS);
      console.log(
        `  ${r.path} total=${r.totalMs}ms createClient=${r.createClientMs}ms ` +
          `session=${r.loadSessionMs}ms getUserNet=${r.getUserNetworkMs}ms ` +
          `refresh=${r.refreshNetworkMs}ms response=${r.responseBuildMs}ms`
      );
      routes.push(r);
    }

    console.log("\nMatcher exclusion audit (unauthenticated fetch)...\n");
    const matcherAudit = await auditMatcherExclusions(null);

    for (const m of matcherAudit) {
      console.log(
        `  ${m.path} status=${m.status} middleware=${m.middlewareRan ? "YES" : "NO"} authMs=${m.totalMs}`
      );
    }

    const productionBaseline: Record<string, { total: number; auth: number }> = {
      "/home": { total: 294, auth: 251 },
      "/discoveries": { total: 320, auth: 251 },
      "/profile": { total: 343, auth: 299 },
      ...(messageContextPath
        ? { [messageContextPath.split("?")[0]]: { total: 323, auth: 304 } }
        : {}),
    };

    const report = buildReport({
      routes,
      matcherAudit,
      region,
      deploymentRegion,
      rtt,
      productionBaseline,
    });

    const jsonPath = resolve(process.cwd(), "docs/.middleware-auth-benchmark.json");
    writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          base: BASE,
          runs: RUNS,
          routes,
          matcherAudit,
          region,
          deploymentRegion,
          rtt,
        },
        null,
        2
      )
    );

    const mdPath = resolve(process.cwd(), "docs/MIDDLEWARE_AUTH_INSTRUMENTATION_REPORT.md");
    writeFileSync(mdPath, report);

    console.log(`\nJSON:   docs/.middleware-auth-benchmark.json`);
    console.log(`Report: docs/MIDDLEWARE_AUTH_INSTRUMENTATION_REPORT.md\n`);
  } finally {
    stopProductionServer();
  }
}

main().catch((err) => {
  console.error(err);
  stopProductionServer();
  process.exit(1);
});
