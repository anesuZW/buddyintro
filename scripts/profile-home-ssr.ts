/**
 * Verify Home SSR streaming + consolidated dashboard loader.
 *
 * Usage: PROFILE_PRODUCTION=1 npm run start -- -p 3008
 *        npm run profile:home-ssr -- --base=http://localhost:3008
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const HOME_QUERY_ESTIMATES = {
  beforeFragmented: { min: 20, max: 25 },
  afterConsolidated: { min: 14, max: 18 },
} as const;

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

const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "http://localhost:3000";
const EMAIL =
  process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ??
  "user1@friendintro.com";
const PASSWORD =
  process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ?? "123456";
const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 5);

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function buildSessionCookieHeader(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message}`);

  const cookieJar: Record<string, string> = {};
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get: (name) => cookieJar[name],
      set: (name, value) => {
        cookieJar[name] = value;
      },
      remove: (name) => {
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

async function timeHomePage(cookie: string) {
  const url = `${BASE.replace(/\/$/, "")}/home`;
  const start = performance.now();
  const res = await fetch(url, { headers: { Cookie: cookie }, redirect: "manual" });
  const ttfbMs = Math.round(performance.now() - start);
  const html = await res.text();
  const totalMs = Math.round(performance.now() - start);
  return { status: res.status, ttfbMs, totalMs, html };
}

async function main() {
  const cookie = await buildSessionCookieHeader();

  console.log("\n=== Home SSR + streaming profile ===\n");
  console.log(`Page: ${BASE}/home`);
  console.log(`Runs: ${RUNS}\n`);

  const ttfbSamples: number[] = [];
  const totalSamples: number[] = [];
  let lastHtml = "";

  for (let i = 0; i < RUNS; i += 1) {
    const sample = await timeHomePage(cookie);
    ttfbSamples.push(sample.ttfbMs);
    totalSamples.push(sample.totalMs);
    lastHtml = sample.html;
    console.log(`  run ${i + 1} ttfb=${sample.ttfbMs}ms total=${sample.totalMs}ms`);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    runs: RUNS,
    ttfbMs: median(ttfbSamples),
    totalMs: median(totalSamples),
    beforeWarmTotalMs: 469,
    beforeWarmTtfbMs: 469,
    estimatedQueryCountBefore: HOME_QUERY_ESTIMATES.beforeFragmented,
    estimatedQueryCountAfter: HOME_QUERY_ESTIMATES.afterConsolidated,
    streamingMarkers: {
      homePageStreamed: lastHtml.includes('data-home-page="streamed"'),
      statsHydrated: lastHtml.includes('data-home-stats="hydrated"'),
      secondaryHydrated: lastHtml.includes('data-home-secondary="hydrated"'),
      feedHydrated: lastHtml.includes('data-home-feed="hydrated"'),
    },
  };

  writeFileSync(
    resolve(process.cwd(), "docs/.home-ssr-profile.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\nMedian TTFB: ${summary.ttfbMs}ms (baseline ~469ms)`);
  console.log(`Median total: ${summary.totalMs}ms`);
  console.log(
    `Query estimate: ${summary.estimatedQueryCountBefore.min}-${summary.estimatedQueryCountBefore.max} → ${summary.estimatedQueryCountAfter.min}-${summary.estimatedQueryCountAfter.max}`
  );
  console.log(`Streaming markers: ${JSON.stringify(summary.streamingMarkers)}`);
  console.log(`\nWritten docs/.home-ssr-profile.json\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
