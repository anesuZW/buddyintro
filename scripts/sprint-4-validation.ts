/**
 * Sprint 4 — Story/graph consolidation validation.
 * Usage: npx tsx scripts/sprint-4-validation.ts [--base=http://localhost:3000]
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const OUT = path.resolve("docs/performance/sprint-4");
const ART = path.join(OUT, "artifacts");
const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";

const SPRINT3_HOME = {
  StoryTag_findMany: 2,
  Story_findMany: 5,
  UserConnection_findMany: 2,
  SharedIntroducerRelationship_groupBy: 1,
  Post_findMany: 1,
  totalPrismaEstimate: 17,
};

const SPRINT4_HOME_STATIC = {
  StoryTag_findMany: 2,
  Story_findMany: 4,
  UserConnection_findMany: 1,
  UserConnection_findFirst: 1,
  SharedIntroducerRelationship_groupBy: 1,
  Post_findMany: 1,
  totalPrismaEstimate: 15,
};

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.resolve(name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

async function loginCookie() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.signInWithPassword({
    email: "user1@friendintro.com",
    password: "123456",
  });
  if (error || !data.session) throw new Error(error?.message ?? "login failed");
  const jar: Record<string, string> = {};
  const sb = createServerClient(url, key, {
    cookies: {
      get: (n) => jar[n],
      set: (n, v) => {
        jar[n] = v;
      },
      remove: (n) => {
        delete jar[n];
      },
    },
  });
  await sb.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function capture(page: string, cookie: string) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${page}`, { headers: { Cookie: cookie }, redirect: "manual" });
  const ttfbMs = Math.round(performance.now() - t0);
  await res.text();
  return {
    status: res.status,
    ttfbMs,
    totalMs: Math.round(performance.now() - t0),
    requestId: res.headers.get("x-bench-request-id") ?? res.headers.get("x-auth-profile-id"),
  };
}

function runTests() {
  return execSync("npx tsx --test tests/home-graph-context.test.ts tests/home-story-context.test.ts", {
    encoding: "utf8",
    stdio: "pipe",
  });
}

async function main() {
  loadEnv();
  fs.mkdirSync(ART, { recursive: true });

  let testsOk = false;
  try {
    runTests();
    testsOk = true;
  } catch (e) {
    console.error("Unit tests failed", e);
  }

  let http: Record<string, unknown> = { note: "Server not reachable" };
  try {
    const health = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (health.ok) {
      const cookie = await loginCookie();
      const home = await capture("/home", cookie);
      const discoveries = await capture("/discoveries", cookie);
      http = { base: BASE, capturedAt: new Date().toISOString(), home, discoveries };
    }
  } catch (e) {
    http = { error: String(e) };
  }

  const artifact = {
    generatedAt: new Date().toISOString(),
    sprint3Home: SPRINT3_HOME,
    sprint4HomeStatic: SPRINT4_HOME_STATIC,
    unitTests: testsOk,
    http,
    codeChanges: [
      "lib/home-graph-context.ts — request-scoped UserConnection load",
      "lib/home-story-loader.ts — shared visible story pool",
      "lib/home-projection.ts — pure projection helpers",
      "lib/discoveries-graph-context.ts — discoveries UserConnection load",
      "services/home-dashboard.ts — getHomeRequestBundle",
      "services/trust-network.ts — graphCtx connection rows",
      "services/trust-recommendations.ts — graphCtx + cached pair lookup",
      "services/feed.ts — reuse story pool for co-tag feed",
      "services/discoveries.ts + discoveries/page.tsx — shared connections",
    ],
  };

  fs.writeFileSync(path.join(ART, "baseline-after.json"), JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify({ testsOk, http }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
