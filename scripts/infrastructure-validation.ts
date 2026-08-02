/**
 * Sprint 1 — Infrastructure Validation (READ-ONLY measurement).
 * Usage: npx tsx scripts/infrastructure-validation.ts
 *
 * Outputs:
 *   docs/performance/sprint-1/artifacts/infrastructure-validation.json
 *   docs/performance/sprint-1/*.md (via generate script)
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 15);
const OUT_DIR = path.resolve("docs/performance/sprint-1");
const ARTIFACT = path.join(OUT_DIR, "artifacts/infrastructure-validation.json");

type LatencyStats = {
  samples: number[];
  min: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[idx];
}

function computeStats(samples: number[]): LatencyStats {
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = sorted.length
    ? Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length)
    : 0;
  return {
    samples: sorted,
    min: sorted[0] ?? 0,
    avg,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1] ?? 0,
  };
}

function redactUrl(url: string | undefined): string {
  if (!url) return "(unset)";
  try {
    const parsed = new URL(url.replace(/^postgresql:/, "http:"));
    const user = parsed.username ? `${parsed.username.split(".")[0]}.***` : "***";
    return `postgresql://${user}:***@${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return "(invalid)";
  }
}

function parseHost(url: string | undefined): { host: string; port: string; sameAsOther: boolean } {
  if (!url) return { host: "(unset)", port: "?", sameAsOther: false };
  try {
    const parsed = new URL(url.replace(/^postgresql:/, "http:"));
    return { host: parsed.hostname, port: parsed.port || "5432", sameAsOther: false };
  } catch {
    return { host: "(invalid)", port: "?", sameAsOther: false };
  }
}

async function timed(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return Math.round(performance.now() - t0);
}

async function benchmarkPg(label: string, connectionString: string | undefined, runs = RUNS) {
  if (!connectionString) {
    return { label, available: false, error: "URL not set" };
  }

  const connectSamples: number[] = [];
  const querySamples: number[] = [];
  const totalSamples: number[] = [];
  let explainExecutionMs: number | null = null;
  let error: string | undefined;

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    for (let i = 0; i < runs; i++) {
      const connectStart = performance.now();
      if (i === 0) {
        await client.connect();
      }
      const connectMs = i === 0 ? Math.round(performance.now() - connectStart) : 0;
      if (i === 0) connectSamples.push(connectMs);

      const queryStart = performance.now();
      await client.query("SELECT 1");
      const queryMs = Math.round(performance.now() - queryStart);
      querySamples.push(queryMs);
      totalSamples.push((i === 0 ? connectMs : 0) + queryMs);

      if (i === 0) {
        const explain = await client.query("EXPLAIN (ANALYZE, FORMAT JSON) SELECT 1");
        const plan = explain.rows[0]?.["QUERY PLAN"]?.[0];
        explainExecutionMs = plan?.["Execution Time"] ?? null;
      }
    }
  } catch (e) {
    error = (e as Error).message;
  } finally {
    await client.end().catch(() => {});
  }

  if (connectSamples.length === 0 && !error) {
    connectSamples.push(0);
  }

  return {
    label,
    available: !error,
    error,
    connectionString: redactUrl(connectionString),
    connect: computeStats(connectSamples.length ? connectSamples : [0]),
    queryExecution: computeStats(querySamples),
    totalRoundTrip: computeStats(totalSamples),
    sqlExecutionMs: explainExecutionMs,
  };
}

async function benchmarkPrismaUrl(label: string, url: string | undefined, runs = RUNS) {
  if (!url) return { label, available: false, error: "URL not set" };

  const samples: number[] = [];
  const adminSamples: number[] = [];
  let error: string | undefined;

  const prisma = new PrismaClient({
    datasources: { db: { url } },
    log: ["error"],
  });

  try {
    for (let i = 0; i < runs; i++) {
      samples.push(await timed(() => prisma.$queryRaw`SELECT 1`));
      adminSamples.push(
        await timed(() => prisma.adminSettings.findUnique({ where: { id: 1 } }))
      );
    }
  } catch (e) {
    error = (e as Error).message;
  } finally {
    await prisma.$disconnect();
  }

  return {
    label,
    available: !error,
    error,
    url: redactUrl(url),
    select1: computeStats(samples),
    adminSettingsFindUnique: computeStats(adminSamples),
  };
}

async function measurePrismaOverhead(runs = 10) {
  const url = process.env.DATABASE_URL;
  if (!url) return { error: "DATABASE_URL unset" };

  const rawSamples: number[] = [];
  const prismaNoExtSamples: number[] = [];
  const prismaExtSamples: number[] = [];

  const pgClient = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  for (let i = 0; i < runs; i++) {
    rawSamples.push(await timed(() => pgClient.query("SELECT 1")));
  }
  await pgClient.end();

  const base = new PrismaClient({ datasources: { db: { url } }, log: ["error"] });
  for (let i = 0; i < runs; i++) {
    prismaNoExtSamples.push(await timed(() => base.$queryRaw`SELECT 1`));
  }
  await base.$disconnect();

  const extended = new PrismaClient({ datasources: { db: { url } }, log: ["error"] }).$extends({
    query: {
      async $allOperations({ query, args }) {
        const t0 = performance.now();
        const result = await query(args);
        void Math.round(performance.now() - t0);
        return result;
      },
    },
  }) as unknown as PrismaClient;
  for (let i = 0; i < runs; i++) {
    prismaExtSamples.push(await timed(() => extended.$queryRaw`SELECT 1`));
  }
  await extended.$disconnect();

  const raw = computeStats(rawSamples);
  const noExt = computeStats(prismaNoExtSamples);
  const ext = computeStats(prismaExtSamples);

  return {
    runs,
    rawPg: raw,
    prismaBase: noExt,
    prismaWithExtension: ext,
    estimatedPrismaOverheadMs: noExt.avg - raw.avg,
    estimatedExtensionOverheadMs: ext.avg - noExt.avg,
    breakdown: {
      connectionAcquisition: "Included in round-trip (Prisma pool)",
      serialization: "<1ms typical for SELECT 1",
      middleware: "Query extension adds ~2× performance.now() per query",
      resultParsing: "Negligible for scalar results",
      network: `Dominant — ~${raw.avg}ms of ${noExt.avg}ms total`,
      sqlExecution: "<1ms per EXPLAIN ANALYZE",
    },
  };
}

async function measureNetworkLatency() {
  const dbUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const results: Record<string, unknown> = {
    localhost: { note: "App host", reachable: true },
  };

  async function tcpProbe(name: string, host: string, port: number) {
    const start = performance.now();
    try {
      const net = await import("net");
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect({ host, port, timeout: 8000 }, () => {
          socket.end();
          resolve();
        });
        socket.on("error", reject);
        socket.on("timeout", () => {
          socket.destroy();
          reject(new Error("timeout"));
        });
      });
      return { name, host, port, latencyMs: Math.round(performance.now() - start), ok: true };
    } catch (e) {
      return {
        name,
        host,
        port,
        latencyMs: Math.round(performance.now() - start),
        ok: false,
        error: (e as Error).message,
      };
    }
  }

  const probes: Array<{ name: string; host: string; port: number }> = [];
  if (dbUrl) {
    const h = parseHost(dbUrl);
    probes.push({ name: "DATABASE_URL (pooler)", host: h.host, port: Number(h.port) });
  }
  if (directUrl && directUrl !== dbUrl) {
    const h = parseHost(directUrl);
    probes.push({ name: "DIRECT_URL", host: h.host, port: Number(h.port) });
  } else if (directUrl) {
    results.directSameAsPooler = true;
  }

  results.tcpProbes = [];
  for (const p of probes) {
    (results.tcpProbes as unknown[]).push(await tcpProbe(p.name, p.host, p.port));
  }

  if (supabaseUrl) {
    try {
      const start = performance.now();
      const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/health`, {
        signal: AbortSignal.timeout(10000),
      });
      results.supabaseAuthHealth = {
        status: res.status,
        latencyMs: Math.round(performance.now() - start),
      };
    } catch (e) {
      results.supabaseAuthHealth = { error: (e as Error).message };
    }
  }

  const localPg = process.env.LOCAL_DATABASE_URL;
  if (localPg) {
    results.localPostgres = await benchmarkPg("LOCAL_DATABASE_URL", localPg, 5);
  } else {
    results.localPostgres = { available: false, note: "LOCAL_DATABASE_URL not configured" };
  }

  const vpsPg = process.env.VPS_DATABASE_URL;
  if (vpsPg) {
    results.vpsPostgres = await benchmarkPg("VPS_DATABASE_URL", vpsPg, 5);
  } else {
    results.vpsPostgres = { available: false, note: "VPS_DATABASE_URL not configured" };
  }

  return results;
}

async function benchmarkPages() {
  const base = process.env.BENCHMARK_BASE ?? "http://localhost:3000";
  const pages = ["/", "/home", "/discoveries", "/profile", "/messages", "/introductions"];
  const results: Array<Record<string, unknown>> = [];

  let cookie = "";
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const auth = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await auth.auth.signInWithPassword({
        email: "user1@friendintro.com",
        password: "123456",
      });
      if (data.session) {
        cookie = `sb-access-token=${data.session.access_token}; sb-refresh-token=${data.session.refresh_token}`;
      }
    }
  } catch {
    /* unauthenticated pages only */
  }

  for (const page of pages) {
    const needsAuth = page !== "/";
    const headers: Record<string, string> = {};
    if (needsAuth && cookie) headers.Cookie = cookie;

    try {
      const start = performance.now();
      const res = await fetch(`${base.replace(/\/$/, "")}${page}`, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(120_000),
      });
      const ttfbMs = Math.round(performance.now() - start);
      await res.arrayBuffer();
      const totalMs = Math.round(performance.now() - start);

      results.push({
        page,
        status: res.status,
        ttfbMs,
        totalMs,
        renderingEstimateMs: Math.max(0, totalMs - ttfbMs),
        prismaMs: res.headers.get("x-bench-prisma-ms") ?? res.headers.get("x-auth-profile-prisma-ms"),
        authMs: res.headers.get("x-bench-auth-ms") ?? res.headers.get("x-auth-profile-route-getuser-ms"),
        serverTiming: res.headers.get("server-timing"),
        note:
          res.status === 307 || res.status === 302
            ? "Redirect — auth required or locale"
            : undefined,
      });
    } catch (e) {
      results.push({ page, error: (e as Error).message, base });
    }
  }

  return { base, serverAvailable: !results.every((r) => r.error), pages: results };
}

async function main() {
  loadEnv();
  fs.mkdirSync(path.join(OUT_DIR, "artifacts"), { recursive: true });

  console.log("\n=== Sprint 1: Infrastructure Validation ===\n");
  console.log(`Runs per benchmark: ${RUNS}\n`);

  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;

  console.log("Phase 1: Connection benchmarks…");
  const phase1 = {
    config: {
      databaseUrl: redactUrl(databaseUrl),
      directUrl: redactUrl(directUrl),
      urlsIdentical: databaseUrl === directUrl,
      databaseHost: parseHost(databaseUrl),
      directHost: parseHost(directUrl),
    },
    pgDatabaseUrl: await benchmarkPg("DATABASE_URL (pg)", databaseUrl),
    pgDirectUrl: await benchmarkPg("DIRECT_URL (pg)", directUrl),
    prismaDatabaseUrl: await benchmarkPrismaUrl("DATABASE_URL (Prisma)", databaseUrl),
    prismaDirectUrl: await benchmarkPrismaUrl("DIRECT_URL (Prisma)", directUrl),
  };

  console.log("Phase 2: Prisma overhead…");
  const phase2 = await measurePrismaOverhead(Math.min(10, RUNS));

  console.log("Phase 3: Network latency…");
  const phase3 = await measureNetworkLatency();

  console.log("Phase 4: Page benchmarks…");
  const phase4 = await benchmarkPages();

  const checkpoint = {
    branch: "checkpoint/sprint-1-infra-start",
    head: fs.existsSync(".git/HEAD")
      ? fs.readFileSync(".git/HEAD", "utf8").trim()
      : "unknown",
    capturedAt: new Date().toISOString(),
  };

  const priorProfile = fs.existsSync("docs/performance/.profile-data.json")
    ? JSON.parse(fs.readFileSync("docs/performance/.profile-data.json", "utf8"))
    : null;

  const report = {
    sprint: "Sprint 1 — Infrastructure Validation",
    generatedAt: new Date().toISOString(),
    mode: "READ-ONLY — no optimizations applied",
    checkpoint,
    runs: RUNS,
    phase1,
    phase2,
    phase3,
    phase4,
    priorProfilingReference: priorProfile
      ? {
          generatedAt: priorProfile.generatedAt,
          infraBaselineMs: priorProfile.latency?.infraBaselineMs,
          infraP95Ms: priorProfile.latency?.infraP95Ms,
          homeQueries: 18,
          httpCapture: priorProfile.httpProfile?.pages,
        }
      : null,
    queryCountsFromPlanning: {
      home: 18,
      discoveries: 12,
      profile: 10,
      introductions: 8,
      messages: 9,
    },
  };

  fs.writeFileSync(ARTIFACT, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${ARTIFACT}`);

  const { generateSprint1Docs } = await import("./generate-sprint1-docs");
  generateSprint1Docs(report);
  console.log("\nSprint 1 documentation generated in docs/performance/sprint-1/\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
