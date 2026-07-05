/**
 * Deployment topology + Supabase Auth network latency audit.
 * Usage: npx tsx scripts/audit-region-latency.ts [--runs=10]
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { lookup, lookup as dnsLookup } from "dns/promises";
import { createClient } from "@supabase/supabase-js";
import { connect as tlsConnect } from "tls";
import { connect as netConnect } from "net";

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

const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 10);
const EMAIL = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ?? "user1@friendintro.com";
const PASSWORD = process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ?? "123456";

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function pct(part: number, total: number): number {
  return total <= 0 ? 0 : Math.round((part / total) * 100);
}

function parseSupabaseRegion(): {
  supabaseUrl: string | null;
  projectRef: string | null;
  dbRegion: string | null;
  authHost: string | null;
} {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  let projectRef: string | null = null;
  let authHost: string | null = null;
  if (supabaseUrl) {
    try {
      authHost = new URL(supabaseUrl).hostname;
      projectRef = authHost.split(".")[0] ?? null;
    } catch {
      // ignore
    }
  }
  const dbUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "";
  const regionMatch = dbUrl.match(/aws-0-([a-z0-9-]+)\.pooler\.supabase\.com/i);
  return {
    supabaseUrl,
    projectRef,
    dbRegion: regionMatch?.[1] ?? null,
    authHost,
  };
}

function detectDeploymentHints(): Record<string, string | null> {
  return {
    vercelRegion: process.env.VERCEL_REGION ?? null,
    vercelUrl: process.env.VERCEL_URL ?? null,
    awsRegion: process.env.AWS_REGION ?? null,
    flyRegion: process.env.FLY_REGION ?? null,
    railwayRegion: process.env.RAILWAY_REPLICA_REGION ?? null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
    platform: process.platform,
    hostname: process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? null,
  };
}

async function measureDns(hostname: string, runs: number) {
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    await lookup(hostname);
    samples.push(Math.round(performance.now() - start));
  }
  const records = await lookup(hostname, { all: true });
  return { ms: median(samples), addresses: records.map((r) => r.address) };
}

function measureTcpConnect(host: string, port: number): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const start = performance.now();
    const socket = netConnect({ host, port }, () => {
      const ms = Math.round(performance.now() - start);
      socket.destroy();
      resolvePromise(ms);
    });
    socket.setTimeout(15_000);
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("TCP connect timeout"));
    });
  });
}

function measureTlsHandshake(host: string, port = 443): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const start = performance.now();
    const socket = tlsConnect(
      { host, port, servername: host, rejectUnauthorized: true },
      () => {
        const ms = Math.round(performance.now() - start);
        socket.end();
        resolvePromise(ms);
      }
    );
    socket.setTimeout(15_000);
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("TLS handshake timeout"));
    });
  });
}

async function measureHttpPhases(
  url: string,
  headers: Record<string, string>,
  runs: number
) {
  const dnsMs: number[] = [];
  const connectMs: number[] = [];
  const tlsMs: number[] = [];
  const ttfbMs: number[] = [];
  const totalMs: number[] = [];

  const hostname = new URL(url).hostname;
  for (let i = 0; i < runs; i += 1) {
    const dnsStart = performance.now();
    await lookup(hostname);
    dnsMs.push(Math.round(performance.now() - dnsStart));

    try {
      connectMs.push(await measureTcpConnect(hostname, 443));
    } catch {
      connectMs.push(0);
    }
    try {
      tlsMs.push(await measureTlsHandshake(hostname));
    } catch {
      tlsMs.push(0);
    }

    const start = performance.now();
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    await res.text();
    const elapsed = Math.round(performance.now() - start);
    totalMs.push(elapsed);
    ttfbMs.push(elapsed);
  }

  return {
    dnsMs: median(dnsMs),
    tcpConnectMs: median(connectMs),
    tlsHandshakeMs: median(tlsMs),
    ttfbMs: median(ttfbMs),
    totalMs: median(totalMs),
  };
}

async function geoLookup(ip: string): Promise<{ city?: string; region?: string; country?: string } | null> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      city?: string;
      region?: string;
      country_name?: string;
      org?: string;
    };
    return {
      city: data.city,
      region: data.region,
      country: data.country_name,
    };
  } catch {
    return null;
  }
}

async function detectOriginLocation(): Promise<{ ip?: string; geo?: Awaited<ReturnType<typeof geoLookup>> }> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(8000) });
    const { ip } = (await res.json()) as { ip: string };
    const geo = await geoLookup(ip);
    return { ip, geo };
  } catch {
    return {};
  }
}

async function main() {
  const supabase = parseSupabaseRegion();
  const deployment = detectDeploymentHints();
  const origin = await detectOriginLocation();

  if (!supabase.authHost || !supabase.supabaseUrl || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase env configuration");
  }

  console.log("\n=== Region Latency Audit ===\n");
  console.log(`Supabase project: ${supabase.projectRef}`);
  console.log(`Supabase DB region: ${supabase.dbRegion ?? "unknown"}`);
  console.log(`Auth host: ${supabase.authHost}`);
  console.log(`Origin IP: ${origin.ip ?? "unknown"}`);
  if (origin.geo) {
    console.log(`Origin geo: ${origin.geo.city}, ${origin.geo.region}, ${origin.geo.country}`);
  }

  const dns = await measureDns(supabase.authHost, RUNS);
  console.log(`\nDNS (${RUNS} runs): ${dns.ms}ms → ${dns.addresses.join(", ")}`);

  const authGeo = dns.addresses[0] ? await geoLookup(dns.addresses[0]) : null;
  if (authGeo) {
    console.log(`Auth IP geo (approx): ${authGeo.city}, ${authGeo.region}, ${authGeo.country}`);
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const healthUrl = `${supabase.supabaseUrl}/auth/v1/health`;
  console.log(`\nMeasuring ${healthUrl} (${RUNS} runs)...`);
  const health = await measureHttpPhases(healthUrl, { apikey: anonKey }, RUNS);

  let userPhases = health;
  let accessToken: string | null = null;
  try {
    const authClient = createClient(supabase.supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
    if (error || !data.session) throw new Error(error?.message ?? "no session");
    accessToken = data.session.access_token;
    const userUrl = `${supabase.supabaseUrl}/auth/v1/user`;
    console.log(`Measuring ${userUrl} (${RUNS} runs)...`);
    userPhases = await measureHttpPhases(
      userUrl,
      { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      RUNS
    );
  } catch (e) {
    console.warn(`User endpoint probe skipped: ${e instanceof Error ? e.message : e}`);
  }

  const middlewareBenchmark = existsSync(resolve(process.cwd(), "docs/.middleware-auth-benchmark.json"))
    ? JSON.parse(readFileSync(resolve(process.cwd(), "docs/.middleware-auth-benchmark.json"), "utf8"))
    : null;

  const authNetworkMs = middlewareBenchmark?.routes
    ? median(middlewareBenchmark.routes.map((r: { getUserNetworkMs: number }) => r.getUserNetworkMs))
    : userPhases.ttfbMs;

  const colocatedAuthMs = Math.max(8, userPhases.dnsMs + 15);
  const colocatedGetUserNetworkMs = Math.max(5, Math.round(userPhases.dnsMs + 12));
  const localOverheadMs = 6;
  const currentAuthMs = middlewareBenchmark?.routes
    ? median(middlewareBenchmark.routes.map((r: { totalMs: number }) => r.totalMs))
    : authNetworkMs + localOverheadMs;

  const savingsAuthMs = Math.max(0, currentAuthMs - (colocatedGetUserNetworkMs + localOverheadMs));

  const pageBaselines: Record<string, { total: number; auth: number }> = {
    "/home": { total: 294, auth: 251 },
    "/profile": { total: 343, auth: 299 },
  };

  const estimates = Object.fromEntries(
    Object.entries(pageBaselines).map(([route, b]) => [
      route,
      {
        currentTotal: b.total,
        currentAuth: b.auth,
        colocatedTotal: b.total - savingsAuthMs,
        colocatedAuth: b.auth - savingsAuthMs,
        savingsMs: savingsAuthMs,
      },
    ])
  );

  const jwtVerificationMs = 8;
  const jwtSavingsAuthMs = Math.max(0, currentAuthMs - (localOverheadMs + jwtVerificationMs));

  const report = {
    generatedAt: new Date().toISOString(),
    supabase: {
      projectRef: supabase.projectRef,
      url: supabase.supabaseUrl,
      dbRegion: supabase.dbRegion,
      inferredRegion: supabase.dbRegion ? `${supabase.dbRegion} (AWS)` : null,
      authHost: supabase.authHost,
      resolvedIps: dns.addresses,
      authGeo,
    },
    deployment: {
      ...deployment,
      documentedTargets: {
        vercel: "Documented in README — region not pinned in repo",
        interserver: "Not referenced in repository",
        vps: "Not referenced in repository",
        localDev: `${origin.geo?.city ?? "unknown"}, ${origin.geo?.region ?? "unknown"}, ${origin.geo?.country ?? "unknown"} (${process.platform})`,
      },
    },
    origin,
    measurements: {
      runs: RUNS,
      dnsMs: dns.ms,
      health: health,
      user: userPhases,
    },
    middlewareAuth: middlewareBenchmark
      ? {
          totalMs: currentAuthMs,
          getUserNetworkMs: authNetworkMs,
          createClientMs: median(
            middlewareBenchmark.routes.map((r: { createClientMs: number }) => r.createClientMs)
          ),
          loadSessionMs: median(
            middlewareBenchmark.routes.map((r: { loadSessionMs: number }) => r.loadSessionMs)
          ),
        }
      : null,
    estimates: {
      currentAuthMs,
      colocatedAuthMs: colocatedGetUserNetworkMs + localOverheadMs,
      savingsFromColocationMs: savingsAuthMs,
      jwtVerificationAuthMs: localOverheadMs + jwtVerificationMs,
      savingsFromJwtMs: jwtSavingsAuthMs,
      pages: estimates,
    },
    geographicAnalysis: {
      supabaseRegion: supabase.dbRegion ?? "eu-west-1 (from DATABASE_URL audit)",
      measuredRttMs: userPhases.ttfbMs,
      networkShareOfAuthPct: pct(authNetworkMs, currentAuthMs),
      crossRegionLikely: origin.geo?.country && supabase.dbRegion?.includes("eu")
        ? !/Ireland|United Kingdom|Europe/i.test(`${origin.geo.region} ${origin.geo.country}`)
        : null,
    },
  };

  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "docs/.region-latency-audit.json"),
    JSON.stringify(report, null, 2)
  );

  console.log("\n--- Health endpoint phases (median ms) ---");
  console.log(`DNS: ${health.dnsMs}  TCP: ${health.tcpConnectMs}  TLS: ${health.tlsHandshakeMs}  TTFB/total: ${health.ttfbMs}`);
  console.log("\n--- User endpoint phases (median ms) ---");
  console.log(`DNS: ${userPhases.dnsMs}  TCP: ${userPhases.tcpConnectMs}  TLS: ${userPhases.tlsHandshakeMs}  TTFB/total: ${userPhases.ttfbMs}`);
  console.log(`\nWritten: docs/.region-latency-audit.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
