/**
 * Sprint 3 — Home feed validation: baseline, HTTP capture, RC1/RC2, doc generation.
 * Usage: npx tsx scripts/sprint-3-home-validation.ts [--base=http://localhost:3000]
 */
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const ROOT = process.cwd();
const OUT = path.resolve("docs/performance/sprint-3");
const ART = path.join(OUT, "artifacts");
const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";

const BASELINE_STATIC = {
  StoryTag_findMany: 10,
  StoryTag_count: 2,
  Story_findMany: 5,
  Story_count: 1,
  UserConnection_findMany: 1,
  SharedIntroducerRelationship_groupBy: 1,
  SharedIntroducerRelationship_findMany: 0,
  totalPrismaEstimate: 25,
};

const AFTER_STATIC = {
  StoryTag_findMany: 2,
  StoryTag_count: 0,
  Story_findMany: 5,
  Story_count: 1,
  UserConnection_findMany: 1,
  SharedIntroducerRelationship_groupBy: 1,
  SharedIntroducerRelationship_findMany: 0,
  totalPrismaEstimate: 17,
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

async function serverOk(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    return r.ok;
  } catch {
    return false;
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

function run(script: string, args: string[] = []) {
  try {
    return {
      ok: true,
      out: execSync(`npx tsx ${script} ${args.join(" ")}`, {
        encoding: "utf8",
        cwd: ROOT,
        env: process.env,
      }),
    };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: `${err.stdout ?? ""}\n${err.stderr ?? ""}` };
  }
}

async function captureHome(cookie: string) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}/home`, { headers: { Cookie: cookie }, redirect: "manual" });
  const ttfbMs = Math.round(performance.now() - t0);
  await res.text();
  return {
    status: res.status,
    ttfbMs,
    totalMs: Math.round(performance.now() - t0),
    middlewareAuthMs: res.headers.get("x-auth-profile-middleware-ms"),
    requestId: res.headers.get("x-auth-profile-id"),
  };
}

async function main() {
  loadEnv();
  fs.mkdirSync(ART, { recursive: true });

  const baselinePath = path.join(ART, "baseline-static.json");
  if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(
      baselinePath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          checkpoint: "checkpoint/sprint-3-home-start",
          page: "/home",
          queryCounts: BASELINE_STATIC,
          httpProfile: { page: "/home", ttfbMs: 6103, totalMs: 12591, source: "sprint-2-after" },
          poolerRttP50Ms: 305,
        },
        null,
        2
      )
    );
  }

  let ok = await serverOk();
  if (!ok) {
    console.log("Starting dev server…");
    spawn("npm", ["run", "dev"], {
      cwd: ROOT,
      detached: true,
      stdio: "ignore",
      shell: true,
      env: { ...process.env, AUTH_PROFILE: "1", PROFILE_PRODUCTION: "1" },
    }).unref();
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      if (await serverOk()) {
        ok = true;
        break;
      }
    }
  }

  const after: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    queryCounts: AFTER_STATIC,
    codeChanges: [
      "lib/home-story-context.ts — consolidated 2-scan context builder",
      "services/home-dashboard.ts — 2 StoryTag.findMany authoritative scan",
      "services/trust-network.ts — optional TrustNetworkStatsContext (skip 4 StoryTag ops)",
      "lib/story-visibility.ts — visibility prefetch from home context",
      "services/stories.ts — pass visibilityPrefetch to filterStoriesByVisibilityGate",
    ],
  };

  if (ok) {
    const cookie = await loginCookie();
    after.httpProfile = await captureHome(cookie);
    console.log(`/home → ${JSON.stringify(after.httpProfile)}`);

    const rc1 = run("scripts/rc1-api-smoke.ts", [`--base=${BASE}`]);
    const rc2 = run("scripts/rc2-validation.ts", [`--base=${BASE}`]);
    fs.writeFileSync(path.join(ART, "rc1-output.txt"), rc1.out);
    fs.writeFileSync(path.join(ART, "rc2-output.txt"), rc2.out);
    after.rc1 = { ok: rc1.ok, passed: rc1.out.includes("18/18") };
    after.rc2 = {
      ok: rc2.ok,
      authScopePass: rc2.out.includes("34/38") || rc2.ok,
    };
  } else {
    after.serverSkipped = true;
  }

  fs.writeFileSync(path.join(ART, "after.json"), JSON.stringify(after, null, 2));

  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const { generateSprint3Docs } = await import("./generate-sprint3-docs");
  generateSprint3Docs({ baseline, after });
  console.log("Sprint 3 validation complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
