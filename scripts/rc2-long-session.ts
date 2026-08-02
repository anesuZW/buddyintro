/**
 * RC2 long-session soak (~30 min). Polls key endpoints and logs anomalies.
 * Usage: npx tsx scripts/rc2-long-session.ts [--minutes=30]
 */
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
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
loadEnv();

const BASE = "http://localhost:3000";
const minutes = Number(process.argv.find((a) => a.startsWith("--minutes="))?.split("=")[1] ?? 30);
const logPath = resolve(process.cwd(), "docs/qa/rc2-long-session.log");

async function login(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: "user1@friendintro.com",
    password: "123456",
  });
  if (error || !data.session) throw new Error(error?.message ?? "login failed");
  const jar: Record<string, string> = {};
  const sb = createServerClient(url, anonKey, {
    cookies: { get: (n) => jar[n], set: (n, v) => (jar[n] = v), remove: (n) => delete jar[n] },
  });
  await sb.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  return Object.entries(jar)
    .map(([n, v]) => `${n}=${v}`)
    .join("; ");
}

function log(line: string) {
  const row = `[${new Date().toISOString()}] ${line}\n`;
  appendFileSync(logPath, row);
  console.log(line);
}

async function probe(cookie: string, path: string) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
  return { status: res.status, ms: Math.round(performance.now() - t0) };
}

async function main() {
  mkdirSync(resolve(process.cwd(), "docs/qa"), { recursive: true });
  appendFileSync(logPath, `\n--- RC2 long session start ${new Date().toISOString()} (${minutes}m) ---\n`);
  const cookie = await login();
  const end = Date.now() + minutes * 60 * 1000;
  let iteration = 0;
  while (Date.now() < end) {
    iteration++;
    for (const path of ["/api/health", "/api/feed", "/api/messages", "/api/notifications?limit=5"]) {
      try {
        const r = await probe(cookie, path);
        if (r.status >= 500) log(`WARN iter=${iteration} ${path} status=${r.status} ms=${r.ms}`);
        else if (iteration === 1 || iteration % 5 === 0) log(`OK iter=${iteration} ${path} ${r.status} ${r.ms}ms`);
      } catch (e) {
        log(`ERR iter=${iteration} ${path} ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await new Promise((r) => setTimeout(r, 60_000));
  }
  log(`Complete after ${iteration} iterations`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
