/**
 * Verify Profile SSR: page HTML should include insights and notification prefs
 * without requiring first-load GET /api/profile/insights or /api/notifications/preferences.
 *
 * Usage: PROFILE_PRODUCTION=1 npm run start -- -p 3007
 *        npm run profile:profile-ssr -- --base=http://localhost:3007
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

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
const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 3);

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

async function timeFetch(url: string, cookie: string) {
  const start = performance.now();
  const res = await fetch(url, { headers: { Cookie: cookie }, redirect: "manual" });
  const ttfbMs = Math.round(performance.now() - start);
  const html = await res.text();
  const totalMs = Math.round(performance.now() - start);
  return { status: res.status, ttfbMs, totalMs, html };
}

async function timeApi(url: string, cookie: string) {
  const start = performance.now();
  const res = await fetch(url, { headers: { Cookie: cookie } });
  await res.arrayBuffer();
  return Math.round(performance.now() - start);
}

async function main() {
  const cookie = await buildSessionCookieHeader();
  const pageUrl = `${BASE.replace(/\/$/, "")}/profile`;
  const insightsUrl = `${BASE.replace(/\/$/, "")}/api/profile/insights`;
  const prefsUrl = `${BASE.replace(/\/$/, "")}/api/notifications/preferences`;

  console.log("\n=== Profile SSR profile ===\n");
  console.log(`Page: ${pageUrl}`);
  console.log(`Runs: ${RUNS}\n`);

  const pageSamples: number[] = [];
  const pageTtfbSamples: number[] = [];
  const insightsSamples: number[] = [];
  const prefsSamples: number[] = [];
  let lastHtml = "";

  for (let i = 0; i < RUNS; i += 1) {
    const page = await timeFetch(pageUrl, cookie);
    pageSamples.push(page.totalMs);
    pageTtfbSamples.push(page.ttfbMs);
    lastHtml = page.html;

    const [insightsMs, prefsMs] = await Promise.all([
      timeApi(insightsUrl, cookie),
      timeApi(prefsUrl, cookie),
    ]);
    insightsSamples.push(insightsMs);
    prefsSamples.push(prefsMs);

    console.log(
      `  run ${i + 1} page=${page.totalMs}ms ttfb=${page.ttfbMs}ms insights=${insightsMs}ms prefs=${prefsMs}ms`
    );
  }

  const pageTotalMs = median(pageSamples);
  const pageTtfbMs = median(pageTtfbSamples);
  const insightsApiMs = median(insightsSamples);
  const prefsApiMs = median(prefsSamples);
  const oldWaterfallMs = Math.max(insightsApiMs, prefsApiMs);

  const hasInsightsSsr = lastHtml.includes('data-profile-insights="hydrated"');
  const hasPrefsSsr = lastHtml.includes('data-notification-preferences="hydrated"');
  const hasInsightsLoading = lastHtml.includes("Loading your insights");

  const summary = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    runs: RUNS,
    pageTotalMs,
    pageTtfbMs,
    insightsApiMs,
    prefsApiMs,
    beforePerceivedMs: pageTotalMs + oldWaterfallMs,
    afterPerceivedMs: pageTotalMs,
    estimatedSavingsMs: oldWaterfallMs,
    ssrIncludesInsights: hasInsightsSsr && !hasInsightsLoading,
    ssrIncludesNotificationPrefs: hasPrefsSsr,
  };

  writeFileSync(
    resolve(process.cwd(), "docs/.profile-ssr-profile.json"),
    JSON.stringify(summary, null, 2)
  );

  console.log(`\nMedian page total: ${pageTotalMs}ms`);
  console.log(`Median /api/profile/insights (old waterfall): ${insightsApiMs}ms`);
  console.log(`Median /api/notifications/preferences (old waterfall): ${prefsApiMs}ms`);
  console.log(`Before perceived (page + max client APIs): ${summary.beforePerceivedMs}ms`);
  console.log(`After perceived (page only): ${summary.afterPerceivedMs}ms`);
  console.log(`Estimated savings: ${summary.estimatedSavingsMs}ms`);
  console.log(`SSR insights (no loading spinner): ${summary.ssrIncludesInsights ? "yes" : "no"}`);
  console.log(`SSR notification prefs: ${summary.ssrIncludesNotificationPrefs ? "yes" : "no"}`);
  console.log(`\nWritten docs/.profile-ssr-profile.json\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
