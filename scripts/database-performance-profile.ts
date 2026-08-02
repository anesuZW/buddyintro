/**
 * Database Performance Profiling Sprint — READ-ONLY orchestrator.
 *
 * Collects latency benchmarks, EXPLAIN ANALYZE, index/connection audits,
 * static N+1/duplicate analysis, and optional HTTP page profiling.
 *
 * Usage:
 *   npx tsx scripts/database-performance-profile.ts
 *   npx tsx scripts/database-performance-profile.ts --start-server --runs=3
 *   npx tsx scripts/database-performance-profile.ts --skip-server
 *
 * Prerequisites: .env.local with DATABASE_URL, Supabase keys.
 * Does NOT modify application code, queries, indexes, or caching.
 */
import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 5);
const START_SERVER = process.argv.includes("--start-server");
const SKIP_SERVER = process.argv.includes("--skip-server");
const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 3010);
const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  `http://localhost:${PORT}`;
const EMAIL =
  process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ??
  "user1@friendintro.com";
const PASSWORD =
  process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ?? "123456";

const OUT_DIR = path.resolve(process.cwd(), "docs/performance");
const DATA_PATH = path.join(OUT_DIR, ".profile-data.json");

const BENCH = {
  requestId: "x-bench-request-id",
  authMs: "x-bench-auth-ms",
  prismaMs: "x-bench-prisma-ms",
  externalMs: "x-bench-external-ms",
  serializeMs: "x-bench-serialize-ms",
  totalMs: "x-bench-total-ms",
} as const;

type Stats = { min: number; avg: number; p95: number; max: number; samples: number[] };

type ProfileData = Record<string, unknown>;

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

function stats(label: string, samplesMs: number[]): Stats & { label: string } {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const avg = sorted.length
    ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length)
    : 0;
  const p95Index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  const p95 = sorted[p95Index] ?? 0;
  return { label, min, avg, p95, max, samples: sorted };
}

async function timed(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return Math.round(performance.now() - t0);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function verifyProfilingConfig() {
  const prismaTracking =
    process.env.NODE_ENV === "development" ||
    process.env.PROFILE_PRODUCTION === "1" ||
    process.env.PROFILE_API === "1" ||
    process.env.PROFILE_PHASE2 === "1";

  return {
    prismaQueryTiming: prismaTracking,
    slowQueryThresholdMs: 200,
    slowQueryLog:
      process.env.NODE_ENV === "development"
        ? "[prisma:slow] Model.operation Xms (console.warn)"
        : "disabled unless NODE_ENV=development",
    phase2Profiler:
      process.env.PROFILE_PHASE2 === "1" ||
      process.env.PROFILE_API === "1" ||
      process.env.PROFILE_PRODUCTION === "1",
    authProfile: process.env.AUTH_PROFILE === "1",
    productionBenchmark: process.env.PROFILE_PRODUCTION === "1",
    perfContext: "runWithPerf() on pages — queryCount + slowQueries via lib/perf/context.ts",
    recommendationForMeasurement:
      "PROFILE_PRODUCTION=1 PROFILE_PHASE2=1 AUTH_PROFILE=1 NODE_ENV=development npm run dev",
    trackPrismaSource: "lib/prisma.ts $extends query timing → trackPrismaQuery → recordPhase2PrismaQuery",
  };
}

async function runLatencyBenchmarks(prisma: PrismaClient, userId: string) {
  const benchmarks: Array<Stats & { label: string; model: string; operation: string }> = [];

  const cases: Array<{ label: string; model: string; operation: string; fn: () => Promise<unknown> }> =
    [
      { label: "SELECT 1", model: "raw", operation: "queryRaw", fn: () => prisma.$queryRaw`SELECT 1` },
      {
        label: "AdminSettings.findUnique",
        model: "AdminSettings",
        operation: "findUnique",
        fn: () => prisma.adminSettings.findUnique({ where: { id: 1 } }),
      },
      {
        label: "User.findUnique",
        model: "User",
        operation: "findUnique",
        fn: () => prisma.user.findUnique({ where: { id: userId } }),
      },
      {
        label: "Story.count",
        model: "Story",
        operation: "count",
        fn: () => prisma.story.count(),
      },
      {
        label: "Story.findMany (published, take 20)",
        model: "Story",
        operation: "findMany",
        fn: () =>
          prisma.story.findMany({
            where: { status: "published" },
            take: 20,
            orderBy: { createdAt: "desc" },
          }),
      },
      {
        label: "StoryTag.findMany (tagged user)",
        model: "StoryTag",
        operation: "findMany",
        fn: () =>
          prisma.storyTag.findMany({
            where: { taggedUserId: userId },
            take: 50,
          }),
      },
      {
        label: "DiscoveriesPost.findMany (network feed)",
        model: "DiscoveriesPost",
        operation: "findMany",
        fn: () =>
          prisma.discoveriesPost.findMany({
            take: 11,
            orderBy: { createdAt: "desc" },
          }),
      },
      {
        label: "SharedIntroducerRelationship.findMany",
        model: "SharedIntroducerRelationship",
        operation: "findMany",
        fn: () =>
          prisma.sharedIntroducerRelationship.findMany({
            where: { OR: [{ userAId: userId }, { userBId: userId }] },
            take: 50,
          }),
      },
      {
        label: "Notification.count (unread)",
        model: "Notification",
        operation: "count",
        fn: () =>
          prisma.notification.count({
            where: { userId, readAt: null },
          }),
      },
      {
        label: "Message.count (unread inbox)",
        model: "Message",
        operation: "count",
        fn: () =>
          prisma.message.count({
            where: { receiverId: userId, readAt: null },
          }),
      },
      {
        label: "AnalyticsEvent.count (24h)",
        model: "AnalyticsEvent",
        operation: "count",
        fn: () =>
          prisma.analyticsEvent.count({
            where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
          }),
      },
      {
        label: "UserConnection.findMany (1st degree)",
        model: "UserConnection",
        operation: "findMany",
        fn: () =>
          prisma.userConnection.findMany({
            where: { sourceUserId: userId, degree: 1 },
            take: 100,
          }),
      },
    ];

  for (const c of cases) {
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      samples.push(await timed(c.fn));
    }
    benchmarks.push({ ...stats(c.label, samples), model: c.model, operation: c.operation });
  }

  const select1 = benchmarks.find((b) => b.label === "SELECT 1")!;
  const infraBaseline = select1.avg;

  return {
    runs: RUNS,
    databaseUrl: redactUrl(process.env.DATABASE_URL),
    directUrl: redactUrl(process.env.DIRECT_URL),
    infraBaselineMs: infraBaseline,
    infraP95Ms: select1.p95,
    poolerBottleneck: select1.p95 > 500,
    benchmarks,
    interpretation: benchmarks.map((b) => ({
      query: b.label,
      avgMs: b.avg,
      p95Ms: b.p95,
      queryCostAboveInfraMs: b.avg - infraBaseline,
      mostlyInfra: b.avg - infraBaseline < 100,
    })),
  };
}

function redactUrl(url: string | undefined): string {
  if (!url) return "(unset)";
  try {
    const parsed = new URL(url.replace(/^postgresql:/, "http:"));
    const user = parsed.username ? `${parsed.username.split(".")[0]}.***` : "***";
    return `postgresql://${user}:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return "(invalid)";
  }
}

async function runExplainAnalyze(userId: string) {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return { error: "No DATABASE_URL", plans: [] };

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const queries: Array<{ name: string; sql: string; params?: unknown[] }> = [
    {
      name: "AdminSettings.findUnique",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM admin_settings WHERE id = 1`,
    },
    {
      name: "User.findUnique",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM users WHERE id = $1`,
      params: [userId],
    },
    {
      name: "Story.findMany (published)",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM stories WHERE status = 'published' ORDER BY created_at DESC LIMIT 20`,
    },
    {
      name: "StoryTag.findMany (tagged_user_id)",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM story_tags WHERE tagged_user_id = $1 LIMIT 50`,
      params: [userId],
    },
    {
      name: "DiscoveriesPost.findMany",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM discoveries_posts ORDER BY created_at DESC LIMIT 11`,
    },
    {
      name: "Notification.count (unread)",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      params: [userId],
    },
    {
      name: "Message.count (unread)",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND read_at IS NULL`,
      params: [userId],
    },
    {
      name: "SharedIntroducerRelationship.findMany",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT * FROM shared_introducer_relationships WHERE user_a_id = $1 OR user_b_id = $1 LIMIT 50`,
      params: [userId],
    },
    {
      name: "Story.count (intro badge pattern)",
      sql: `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT COUNT(*) FROM stories s JOIN story_tags t ON t.story_id = s.id WHERE t.tagged_user_id = $1`,
      params: [userId],
    },
  ];

  const plans: Array<{
    name: string;
    executionTimeMs: number | null;
    planningTimeMs: number | null;
    scanTypes: string[];
    rowsReturned: number | null;
    missingIndexHints: string[];
    raw: string;
  }> = [];

  for (const q of queries) {
    try {
      const res = await client.query(q.sql, q.params ?? []);
      const raw = res.rows.map((r) => r["QUERY PLAN"] as string).join("\n");
      const execMatch = raw.match(/Execution Time: ([\d.]+) ms/);
      const planMatch = raw.match(/Planning Time: ([\d.]+) ms/);
      const scanTypes = ["Seq Scan", "Index Scan", "Index Only Scan", "Bitmap Heap Scan", "Bitmap Index Scan", "Nested Loop", "Hash Join", "Merge Join", "Sort"]
        .filter((s) => raw.includes(s));
      const rowsMatch = raw.match(/rows=(\d+)/);
      const missingIndexHints: string[] = [];
      if (raw.includes("Seq Scan") && !raw.includes("Index Scan")) {
        missingIndexHints.push("Sequential scan detected — verify index coverage for WHERE/JOIN columns");
      }
      plans.push({
        name: q.name,
        executionTimeMs: execMatch ? Number(execMatch[1]) : null,
        planningTimeMs: planMatch ? Number(planMatch[1]) : null,
        scanTypes,
        rowsReturned: rowsMatch ? Number(rowsMatch[1]) : null,
        missingIndexHints,
        raw,
      });
    } catch (err) {
      plans.push({
        name: q.name,
        executionTimeMs: null,
        planningTimeMs: null,
        scanTypes: [],
        rowsReturned: null,
        missingIndexHints: [(err as Error).message],
        raw: String(err),
      });
    }
  }

  await client.end();
  return { connection: redactUrl(url), plans };
}

async function runIndexAudit() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return { error: "No DATABASE_URL" };

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = [
    "users",
    "stories",
    "story_tags",
    "discoveries_posts",
    "messages",
    "notifications",
    "analytics_events",
    "invitations",
    "user_connections",
    "shared_introducer_relationships",
    "admin_settings",
  ];

  const indexes = await client.query(
    `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ANY($1::text[]) ORDER BY tablename, indexname`,
    [tables]
  );

  const tableStats = await client.query(
    `SELECT relname, seq_scan, idx_scan, n_live_tup, pg_total_relation_size(relid) AS bytes
     FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = ANY($1::text[])`,
    [tables]
  );

  const dupIndexes = await client.query(`
    SELECT indexdef, COUNT(*) AS cnt, array_agg(indexname) AS names
    FROM pg_indexes WHERE schemaname = 'public' AND tablename = ANY($1::text[])
    GROUP BY indexdef HAVING COUNT(*) > 1
  `, [tables]);

  const unused = await client.query(`
    SELECT schemaname, relname, indexrelname, idx_scan, pg_relation_size(indexrelid) AS bytes
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public' AND relname = ANY($1::text[]) AND idx_scan = 0
    ORDER BY pg_relation_size(indexrelid) DESC
    LIMIT 20
  `, [tables]);

  await client.end();

  return {
    indexesByTable: Object.fromEntries(
      tables.map((t) => [
        t,
        indexes.rows.filter((r) => r.tablename === t).map((r) => ({
          name: r.indexname,
          def: r.indexdef,
        })),
      ])
    ),
    tableStats: tableStats.rows.map((r) => ({
      table: r.relname,
      seqScan: Number(r.seq_scan),
      idxScan: Number(r.idx_scan),
      rowEstimate: Number(r.n_live_tup ?? 0),
      sizeMb: Math.round(Number(r.bytes) / (1024 * 1024) * 10) / 10,
    })),
    duplicateIndexes: dupIndexes.rows.map((r) => ({
      names: r.names,
      count: Number(r.cnt),
    })),
    unusedIndexes: unused.rows.map((r) => ({
      table: r.relname,
      index: r.indexrelname,
      idxScan: Number(r.idx_scan),
      sizeMb: Math.round(Number(r.bytes) / (1024 * 1024) * 10) / 10,
    })),
    compositeOpportunities: [
      { table: "messages", columns: "(receiver_id, read_at)", reason: "Unread badge count in layout" },
      { table: "messages", columns: "(sender_id, receiver_id, created_at)", reason: "Conversation list latest message" },
      { table: "story_tags", columns: "(tagged_user_id, story_id)", reason: "Home feed + intro badge" },
      { table: "discoveries_posts", columns: "(visibility, created_at)", reason: "Feed ordering + filter" },
      { table: "user_connections", columns: "(source_user_id, degree)", reason: "Network depth filtering" },
      { table: "shared_introducer_relationships", columns: "(user_a_id, user_b_id)", reason: "Trust enrichment bulk lookup" },
      { table: "notifications", columns: "(user_id, read_at)", reason: "Unread notification count" },
    ],
  };
}

async function runConnectionAudit(prisma: PrismaClient) {
  const concurrentSamples: number[] = [];
  const parallel = 10;
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    await Promise.all(
      Array.from({ length: parallel }, () => prisma.$queryRaw`SELECT 1`)
    );
    concurrentSamples.push(Math.round(performance.now() - start));
  }

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  let pgStats: Record<string, unknown> = {};
  if (url) {
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const activity = await client.query(`
        SELECT count(*) FILTER (WHERE state = 'active') AS active,
               count(*) FILTER (WHERE wait_event_type = 'Client') AS client_wait,
               count(*) AS total
        FROM pg_stat_activity WHERE datname = current_database()
      `);
      pgStats = activity.rows[0] ?? {};
    } catch {
      pgStats = { note: "pg_stat_activity limited on pooler" };
    }
    await client.end();
  }

  return {
    poolerHost: process.env.DATABASE_URL?.match(/@([^/]+)/)?.[1] ?? "unknown",
    pgbouncerParam: new URL(process.env.DATABASE_URL?.replace(/^postgresql:/, "http:") ?? "http://x").searchParams.get("pgbouncer"),
    connectionLimitParam: new URL(process.env.DATABASE_URL?.replace(/^postgresql:/, "http:") ?? "http://x").searchParams.get("connection_limit"),
    concurrentSelect1: stats("10× parallel SELECT 1", concurrentSamples),
    directUrlSameAsPooler: process.env.DIRECT_URL === process.env.DATABASE_URL,
    pgActivity: pgStats,
    findings: [
      process.env.DIRECT_URL === process.env.DATABASE_URL
        ? "DIRECT_URL points to pooler — migrations/EXPLAIN use same path as runtime"
        : "DIRECT_URL differs from DATABASE_URL",
      "Supabase pooler RTT dominates single-query latency (see SELECT 1 p95)",
      "Prisma default pool: connection_limit not set in DATABASE_URL query string",
    ],
  };
}

function staticCallSiteAnalysis() {
  return {
    tracingMechanism: {
      prismaExtension: "lib/prisma.ts — times every operation when PROFILE_* or development",
      perfContext: "lib/perf/context.ts — runWithPerf aggregates queryCount per page",
      phase2: "lib/profile/phase2-profiler.ts — aggregates Model.operation counts + detectPhase2Issues",
      authProfile: "lib/auth-profile.ts — getCurrentUserCalls, supabaseGetUser, prismaUserLookup",
      routeProfiler: "lib/profile/route-profiler.ts — optional segment timing",
    },
    executionTrees: STATIC_EXECUTION_TREES,
    prismaCallSites: STATIC_PRISMA_CALL_SITES,
  };
}

function staticNPlusOneAnalysis() {
  return { patterns: N_PLUS_ONE_PATTERNS, duplicatePatterns: DUPLICATE_PATTERNS };
}

function cacheRecommendations() {
  return CACHE_RECOMMENDATIONS;
}

function authAuditStatic() {
  return AUTH_AUDIT;
}

function analyticsAuditStatic() {
  return ANALYTICS_AUDIT;
}

function buildHotspots(latency: Awaited<ReturnType<typeof runLatencyBenchmarks>>) {
  const sorted = [...latency.benchmarks].sort((a, b) => b.p95 - a.p95);
  return {
    topSlowQueries: sorted.slice(0, 50).map((b, i) => ({
      rank: i + 1,
      query: b.label,
      avgMs: b.avg,
      p95Ms: b.p95,
      model: b.model,
      operation: b.operation,
    })),
    topDuplicated: DUPLICATE_PATTERNS.slice(0, 20),
    topNPlusOne: N_PLUS_ONE_PATTERNS.slice(0, 20),
    topRepeatedServices: [
      { service: "getAdminSettings", callsPerRequest: "3–8", files: ["services/admin.ts (cache)"] },
      { service: "getCurrentUser", callsPerRequest: "1–3", files: ["lib/auth.ts (cache)"] },
      { service: "getLayoutBadges", callsPerRequest: "1 (deduped)", files: ["services/layout-badges.ts"] },
      { service: "getHomeStoryContext", callsPerRequest: "1 (deduped)", files: ["services/home-dashboard.ts"] },
    ],
  };
}

function optimizationEstimates(latency: Awaited<ReturnType<typeof runLatencyBenchmarks>>) {
  const avgQuery = latency.infraBaselineMs;
  const queriesPerHomePage = 18;
  const queriesAfterDedupe = 14;
  return {
    currentState: {
      avgPoolerRttMs: avgQuery,
      estimatedQueriesHome: queriesPerHomePage,
      estimatedPrismaTimeHomeMs: queriesPerHomePage * avgQuery,
    },
    ifPoolerFixed: {
      expectedAvgRttMs: 50,
      estimatedPrismaTimeHomeMs: queriesPerHomePage * 50,
      pageLatencyReductionPercent: Math.round((1 - (50 / avgQuery)) * 100),
    },
    ifQueryCountHalved: {
      queriesPerHome: Math.round(queriesPerHomePage / 2),
      estimatedPrismaTimeHomeMs: Math.round((queriesPerHomePage / 2) * avgQuery),
      pageLatencyReductionPercent: 50,
    },
    ifBoth: {
      queriesPerHome: queriesAfterDedupe,
      expectedAvgRttMs: 50,
      estimatedPrismaTimeHomeMs: queriesAfterDedupe * 50,
      pageLatencyReductionPercent: Math.round((1 - (queriesAfterDedupe * 50) / (queriesPerHomePage * avgQuery)) * 100),
    },
    supabaseCost: "Pooler round-trips scale with query count × concurrent users — largest cost lever is query multiplication",
    note: "Estimates only — no changes made in this sprint",
  };
}

async function buildSessionCookieHeader(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message}`);

  const cookieJar: Record<string, string> = {};
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get: (n) => cookieJar[n],
      set: (n, v) => {
        cookieJar[n] = v;
      },
      remove: (n) => {
        delete cookieJar[n];
      },
    },
  });
  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function profilePagesHttp(base: string, cookie: string, prisma: PrismaClient) {
  const me = await prisma.user.findUnique({ where: { email: EMAIL } });
  const story = await prisma.story.findFirst({ select: { id: true } });
  const msg = await prisma.message.findFirst({
    where: me ? { OR: [{ senderId: me.id }, { receiverId: me.id }] } : undefined,
    select: { senderId: true, receiverId: true },
  });
  const otherId = msg && me ? (msg.senderId === me.id ? msg.receiverId : msg.senderId) : null;

  const pages: Array<{ label: string; path: string }> = [
    { label: "/", path: "/" },
    { label: "/home", path: "/home" },
    { label: "/discoveries", path: "/discoveries" },
    { label: "/messages", path: "/messages" },
    { label: "/introductions", path: "/introductions" },
    { label: "/profile", path: "/profile" },
    { label: "/create-story", path: "/create-story" },
    { label: "/stories/view/[id]", path: story ? `/stories/view/${story.id}` : "" },
    { label: "/settings (profile panels)", path: "/profile" },
    { label: "/admin → /maindash", path: "/maindash" },
  ].filter((p) => p.path);

  const results: Array<Record<string, unknown>> = [];

  for (const page of pages) {
    const samples: Array<Record<string, number | string | null>> = [];
    for (let i = 0; i < Math.min(RUNS, 3); i++) {
      const url = `${base.replace(/\/$/, "")}${page.path}`;
      const start = performance.now();
      const res = await fetch(url, { headers: { Cookie: cookie }, redirect: "manual" });
      const ttfb = Math.round(performance.now() - start);
      await res.arrayBuffer();
      const total = Math.round(performance.now() - start);
      const requestId = res.headers.get(BENCH.requestId);
      samples.push({
        status: res.status,
        ttfbMs: ttfb,
        totalMs: total,
        authMs: res.headers.get(BENCH.authMs) ?? res.headers.get("x-auth-profile-route-getuser-ms"),
        prismaMs: res.headers.get(BENCH.prismaMs) ?? res.headers.get("x-auth-profile-prisma-ms"),
        requestId,
      });
    }
    const staticEstimate = PAGE_QUERY_ESTIMATES[page.label] ?? PAGE_QUERY_ESTIMATES.default;
    results.push({
      page: page.label,
      path: page.path,
      samples,
      medianTtfbMs: median(samples.map((s) => Number(s.ttfbMs))),
      medianTotalMs: median(samples.map((s) => Number(s.totalMs))),
      medianPrismaMs: median(samples.map((s) => Number(s.prismaMs ?? 0))),
      estimatedPrismaQueries: staticEstimate,
    });
  }

  return { base, pages: results };
}

let serverProcess: ChildProcess | null = null;

async function startProfileServer(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    serverProcess = spawn("npm", ["run", "start", "--", "-p", String(port)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PROFILE_PRODUCTION: "1",
        PROFILE_PHASE2: "1",
        AUTH_PROFILE: "1",
        NODE_ENV: "production",
      },
      stdio: "pipe",
      shell: true,
    });
    const deadline = Date.now() + 120_000;
    const check = async () => {
      try {
        const res = await fetch(`http://localhost:${port}/api/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) return resolve();
      } catch {
        /* retry */
      }
      if (Date.now() > deadline) return reject(new Error("Server start timeout"));
      setTimeout(check, 2000);
    };
    setTimeout(check, 3000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// --- Static analysis data (code-derived, read-only) ---

const STATIC_EXECUTION_TREES: Record<string, string[]> = {
  "/home": [
    "app/[locale]/(main)/home/page.tsx → runWithPerf",
    "  → requireUser → getCurrentUser → getAuthUser (Supabase) → User.findUnique/upsert",
    "  → HomeTrustDashboard → loadHomeDashboardStats → getTrustNetworkStats",
    "      → StoryTag.findMany ×2, UserConnection.findMany, Story.count",
    "  → HomeSecondaryPanels → loadHomeDashboardSecondary",
    "      → getHomeStoryContext (4× StoryTag.findMany) → getIntroductionSuggestions + getTrustRecommendations",
    "  → HomeFeedPanels → loadHomeDashboardFeed",
    "      → getHomeStoryContext (deduped) → getStoryBarForViewer → Story.findMany + StoryTag.findMany",
    "      → getMutualTagFeed → Story.findMany + StoryTag.findMany",
    "  layout: TopBarWithBadges + BottomNavWithBadge → getLayoutBadges (deduped)",
    "      → Story.count, Message.count, Notification.count",
  ],
  "/discoveries": [
    "app/[locale]/(main)/discoveries/page.tsx → runWithPerf",
    "  → requireUser → getCurrentUser",
    "  → getAdminSettings (AdminSettings.findUnique)",
    "  → getTrustRecommendations → UserConnection.findMany + getAdminSettings",
    "  → getDiscoveriesFeed",
    "      → getDiscoveriesNetworkAuthorIds → UserConnection.findMany",
    "      → User.findUnique (viewer verification fields)",
    "      → listBlockedUserIds → UserBlock.findMany",
    "      → filterDiscoveryAuthorIds → verification gates",
    "      → DiscoveriesPost.findMany (includes likes, bookmarks, _count)",
    "      → filterByCategoryVisibility → Story.findMany (batched) + SharedIntroducerRelationship",
    "      → getConnectionReasonsBulk + getTrustProfilesBulk",
    "          → UserConnection.findMany, User.findMany, SharedIntroducerRelationship.findMany",
  ],
  "/messages": [
    "app/[locale]/(main)/messages/page.tsx (client shell)",
    "  → MessagesInboxClient → GET /api/messages",
    "      → getCurrentUser → getConversationList",
    "          → Message.findMany (all user messages) + User.findMany + getTrustProfilesBulk",
  ],
  "/profile": [
    "app/[locale]/(main)/profile/page.tsx → runWithPerf",
    "  → requireUser",
    "  → getProfileTrustNetwork → StoryTag.findMany + UserConnection.findMany",
    "  → getTrustRecommendations",
    "  → analyticsService.queryUserInsights → AnalyticsEvent aggregations",
    "  → notificationService.getPreferences → NotificationPreferences.findUnique",
  ],
};

const STATIC_PRISMA_CALL_SITES: Array<{
  model: string;
  operation: string;
  file: string;
  function: string;
  lineHint: string;
}> = [
  { model: "Story", operation: "findMany", file: "services/home-dashboard.ts", function: "getHomeStoryContext", lineHint: "21-53" },
  { model: "StoryTag", operation: "findMany", file: "services/home-dashboard.ts", function: "getHomeStoryContext", lineHint: "21-53" },
  { model: "Story", operation: "findMany", file: "services/stories.ts", function: "getStoryBarForViewer", lineHint: "290" },
  { model: "AdminSettings", operation: "findUnique", file: "services/admin.ts", function: "getAdminSettings", lineHint: "cached" },
  { model: "User", operation: "findUnique", file: "lib/auth.ts", function: "getCurrentUser", lineHint: "124" },
  { model: "DiscoveriesPost", operation: "findMany", file: "services/discoveries.ts", function: "getDiscoveriesFeed", lineHint: "74" },
  { model: "SharedIntroducerRelationship", operation: "findMany", file: "services/trust-profile.ts", function: "getTrustProfilesBulk", lineHint: "146" },
  { model: "Notification", operation: "count", file: "services/notifications/notification-service.ts", function: "getUnreadNotificationCount", lineHint: "via layout-badges" },
  { model: "Message", operation: "count", file: "services/layout-badges.ts", function: "getLayoutBadges", lineHint: "22" },
  { model: "Story", operation: "count", file: "services/layout-badges.ts", function: "getLayoutBadges", lineHint: "15" },
  { model: "UserConnection", operation: "findMany", file: "lib/discoveries-network.ts", function: "getDiscoveriesNetworkAuthorIds", lineHint: "network depth" },
  { model: "AnalyticsEvent", operation: "count", file: "services/analytics/analytics-service.ts", function: "queryUserInsights", lineHint: "profile page" },
];

const N_PLUS_ONE_PATTERNS = [
  {
    page: "/home",
    service: "getIntroductionSuggestions",
    loop: "O(n²) pair scan over introducedByViewer tags",
    estimatedDuplicates: "Up to 400 SharedIntroducerCount lookups without ctx batching",
    file: "services/introduction-suggestions.ts",
    severity: "medium",
  },
  {
    page: "/discoveries",
    service: "filterByCategoryVisibility",
    loop: "Per-post category gate (partially batched)",
    estimatedDuplicates: "0–2 queries per post when cross-category disabled",
    file: "lib/category-visibility.ts",
    severity: "medium",
  },
  {
    page: "/discoveries",
    service: "getTrustProfilesBulk",
    loop: "Bulk fetch but OR clause per author for SharedIntroducerRelationship",
    estimatedDuplicates: "1 bulk query (not N+1) — OR array scales with author count",
    file: "services/trust-profile.ts",
    severity: "low",
  },
  {
    page: "/messages",
    service: "getConversationList",
    loop: "Loads all messages then dedupes in JS",
    estimatedDuplicates: "1 unbounded findMany — not N+1 but O(all messages)",
    file: "services/messages.ts",
    severity: "high",
  },
  {
    page: "/home",
    service: "getHomeStoryContext",
    loop: "4 parallel StoryTag.findMany — same tags scanned multiple ways",
    estimatedDuplicates: "4 queries/request (by design, not loop N+1)",
    file: "services/home-dashboard.ts",
    severity: "medium",
  },
  {
    page: "layout (all pages)",
    service: "getLayoutBadges",
    loop: "Called from TopBar + BottomNav — React cache dedupes",
    estimatedDuplicates: "1× effective (2 call sites, 1 execution)",
    file: "components/layout/LayoutBadges.tsx",
    severity: "info",
  },
  {
    page: "all authenticated",
    service: "getAdminSettings",
    loop: "Called from many services without always passing settingsOverride",
    estimatedDuplicates: "1× per request (React cache) but 3–8 call sites",
    file: "services/admin.ts",
    severity: "info",
  },
  {
    page: "/discoveries",
    service: "getDiscoveriesFeed",
    loop: "getAdminSettings called in page AND inside feed if no override",
    estimatedDuplicates: "1× when settingsOverride passed (page does pass)",
    file: "app/[locale]/(main)/discoveries/page.tsx",
    severity: "info",
  },
];

const DUPLICATE_PATTERNS = [
  {
    query: "AdminSettings.findUnique",
    firstExecution: "First getAdminSettings() in request",
    repeatedExecution: "Subsequent getAdminSettings() via React cache() — same row",
    reason: "Multiple services read admin flags independently",
    caller: "getAdminSettings (cache dedupes within request)",
    callSites: 15,
  },
  {
    query: "User.findUnique",
    firstExecution: "getCurrentUser in layout requireUser",
    repeatedExecution: "requireUser/getCurrentUser in page (cache dedupes)",
    reason: "Layout + page both call requireUser",
    caller: "lib/auth.ts cache()",
    callSites: 2,
  },
  {
    query: "StoryTag.findMany",
    firstExecution: "getHomeStoryContext (4 variants)",
    repeatedExecution: "getStoryBarForViewer + getMutualTagFeed may rescan tags",
    reason: "Overlapping home feed loaders",
    caller: "services/home-dashboard.ts, services/stories.ts, services/feed.ts",
    callSites: 6,
  },
  {
    query: "Notification.count",
    firstExecution: "getLayoutBadges → getUnreadNotificationCount",
    repeatedExecution: "Notifications page / API may recount",
    reason: "Badge + inbox use separate code paths",
    caller: "services/layout-badges.ts",
    callSites: 2,
  },
  {
    query: "Message.count",
    firstExecution: "getLayoutBadges unread badge",
    repeatedExecution: "Messages API list may load messages differently",
    reason: "Count vs full findMany for inbox",
    caller: "services/layout-badges.ts vs services/messages.ts",
    callSites: 2,
  },
];

const CACHE_RECOMMENDATIONS = [
  { target: "getAdminSettings", mechanism: "React cache()", status: "already cached", priority: "done" },
  { target: "getCurrentUser", mechanism: "React cache()", status: "already cached", priority: "done" },
  { target: "getLayoutBadges", mechanism: "React cache(userId)", status: "already cached", priority: "done" },
  { target: "getHomeStoryContext", mechanism: "React cache(userId)", status: "already cached", priority: "done" },
  { target: "getDiscoveriesNetworkAuthorIds", mechanism: "React cache(viewerId)", status: "recommend", priority: "high" },
  { target: "listBlockedUserIds", mechanism: "React cache(viewerId)", status: "recommend", priority: "medium" },
  { target: "getTrustProfilesBulk", mechanism: "unstable_cache 60s per viewer+authorSet hash", status: "recommend", priority: "medium" },
  { target: "Introduction graph edges", mechanism: "unstable_cache + background refresh", status: "recommend", priority: "high" },
  { target: "NotificationPreferences", mechanism: "React cache(userId)", status: "recommend", priority: "low" },
  { target: "AnalyticsEvent.create", mechanism: "async queue (not blocking SSR)", status: "recommend", priority: "high" },
];

const AUTH_AUDIT = {
  perAuthenticatedRequest: {
    middleware: "Supabase getUser via middleware (x-auth-profile-middleware-ms header)",
    layout: "requireUser → getCurrentUser → getAuthUser + User.findUnique (1× cached)",
    page: "requireUser again (cache hit) or getCurrentUser in API routes",
    estimatedUserFindUnique: "1 effective (React cache)",
    estimatedSupabaseGetUser: "1–2 (middleware + fallback if headers missing)",
    estimatedAdminSettings: "1 effective (React cache)",
    estimatedNotificationPreferences: "0 on most pages; 1 on /profile",
  },
  note: "AUTH_PROFILE=1 logs [AUTH-PROFILE] lines with getCurrentUser, prismaUserLookup, supabaseGetUser",
};

const ANALYTICS_AUDIT = {
  blockingPaths: [
    { path: "/profile", call: "analyticsService.queryUserInsights", blocking: true },
    { path: "POST /api/analytics", call: "AnalyticsEvent.create", blocking: "sync write" },
  ],
  recommendation: "Move AnalyticsEvent.create to fire-and-forget queue; keep insights on profile async",
  measuredLatency: "See AnalyticsEvent.count benchmark — pooler RTT dominates",
};

const PAGE_QUERY_ESTIMATES: Record<string, { totalQueries: number; sqlTimeMsEstimate: number; slowest: string; duplicates: number }> = {
  "/home": { totalQueries: 18, sqlTimeMsEstimate: 18 * 564, slowest: "StoryTag.findMany", duplicates: 4 },
  "/discoveries": { totalQueries: 12, sqlTimeMsEstimate: 12 * 564, slowest: "DiscoveriesPost.findMany", duplicates: 2 },
  "/messages": { totalQueries: 8, sqlTimeMsEstimate: 8 * 564, slowest: "Message.findMany", duplicates: 1 },
  "/profile": { totalQueries: 10, sqlTimeMsEstimate: 10 * 564, slowest: "AnalyticsEvent aggregations", duplicates: 1 },
  "/introductions": { totalQueries: 8, sqlTimeMsEstimate: 8 * 564, slowest: "Story.findMany", duplicates: 2 },
  "/create-story": { totalQueries: 4, sqlTimeMsEstimate: 4 * 564, slowest: "AdminSettings.findUnique", duplicates: 1 },
  default: { totalQueries: 6, sqlTimeMsEstimate: 6 * 564, slowest: "AdminSettings.findUnique", duplicates: 1 },
};

async function main() {
  loadEnv();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("\n=== Database Performance Profiling Sprint (READ-ONLY) ===\n");

  const profilingConfig = verifyProfilingConfig();
  console.log("Profiling config:", JSON.stringify(profilingConfig, null, 2));

  const prisma = new PrismaClient({ log: ["error"] });
  let userId = "";
  try {
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (!user) throw new Error(`No user ${EMAIL} — run seed:demo`);
    userId = user.id;
    console.log(`\nProfile user: ${EMAIL} (${userId.slice(0, 8)}…)\n`);

    console.log("Phase: Latency benchmarks…");
    const latency = await runLatencyBenchmarks(prisma, userId);

    console.log("Phase: EXPLAIN ANALYZE…");
    const explain = await runExplainAnalyze(userId);

    console.log("Phase: Index audit…");
    const indexes = await runIndexAudit();

    console.log("Phase: Connection audit…");
    const connection = await runConnectionAudit(prisma);

    let httpProfile: Record<string, unknown> = { skipped: true, reason: "Server not probed" };
    if (!SKIP_SERVER) {
      try {
        if (START_SERVER) {
          console.log(`Starting server on :${PORT} with PROFILE_* flags…`);
          await startProfileServer(PORT);
        } else {
          const health = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
          if (!health?.ok) throw new Error(`No server at ${BASE}`);
        }
        console.log("Phase: HTTP page profiling…");
        const cookie = await buildSessionCookieHeader();
        httpProfile = await profilePagesHttp(BASE, cookie, prisma);
      } catch (err) {
        httpProfile = { skipped: true, reason: String(err) };
        console.warn("HTTP profiling skipped:", err);
      } finally {
        stopServer();
      }
    }

    const data: ProfileData = {
      generatedAt: new Date().toISOString(),
      sprint: "Database Performance Profiling — READ-ONLY",
      branch: "performance-recovery-sprint",
      profilingConfig,
      latency,
      explain,
      indexes,
      connection,
      staticAnalysis: staticCallSiteAnalysis(),
      nPlusOne: staticNPlusOneAnalysis(),
      cacheRecommendations: cacheRecommendations(),
      authAudit: authAuditStatic(),
      analyticsAudit: analyticsAuditStatic(),
      httpProfile,
      hotspots: buildHotspots(latency),
      optimizationEstimates: optimizationEstimates(latency),
      observedSlowLogs: [
        { query: "Story.findMany", reportedMs: 3328, source: "user observation / [prisma:slow]" },
        { query: "StoryTag.findMany", reportedMs: 4341, source: "user observation" },
        { query: "User.findUnique", reportedMs: 2567, source: "user observation" },
        { query: "DiscoveriesPost.findMany", reportedMs: 2450, source: "user observation" },
        { query: "SharedIntroducerRelationship.findMany", reportedMs: 2956, source: "user observation" },
        { query: "AdminSettings.findUnique", reportedMs: 2768, source: "user observation" },
        { query: "Notification.count", reportedMs: 1140, source: "user observation" },
        { query: "Message.count", reportedMs: 953, source: "user observation" },
      ],
    };

    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    console.log(`\nWrote ${DATA_PATH}`);

    console.log("\nGenerating markdown reports…");
    const { generatePerformanceDocs } = await import("./generate-performance-profile-docs");
    generatePerformanceDocs(data);
    console.log("\nDone. See docs/performance/*.md\n");
  } finally {
    await prisma.$disconnect();
    stopServer();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
