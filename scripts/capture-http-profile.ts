/** Quick HTTP page capture — merges into .profile-data.json */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3010";
const OUT = path.resolve("docs/performance/.profile-data.json");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

async function cookie() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await auth.auth.signInWithPassword({
    email: "user1@friendintro.com",
    password: "123456",
  });
  const jar: Record<string, string> = {};
  const sb = createServerClient(url, key, {
    cookies: { get: (n) => jar[n], set: (n, v) => { jar[n] = v; }, remove: (n) => { delete jar[n]; } },
  });
  await sb.auth.setSession({ access_token: data.session!.access_token, refresh_token: data.session!.refresh_token });
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function main() {
  loadEnv();
  const c = await cookie();
  const pages = ["/home", "/discoveries", "/messages", "/introductions", "/profile", "/create-story", "/maindash"];
  const results = [];
  for (const p of pages) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}${p}`, { headers: { Cookie: c }, redirect: "manual" });
    const ttfb = Math.round(performance.now() - t0);
    await res.arrayBuffer();
    const total = Math.round(performance.now() - t0);
    results.push({
      page: p,
      status: res.status,
      ttfbMs: ttfb,
      totalMs: total,
      authMs: res.headers.get("x-bench-auth-ms") ?? res.headers.get("x-auth-profile-route-getuser-ms"),
      prismaMs: res.headers.get("x-bench-prisma-ms") ?? res.headers.get("x-auth-profile-prisma-ms"),
      requestId: res.headers.get("x-bench-request-id"),
    });
    console.log(`${p} ${res.status} total=${total}ms prisma=${results[results.length - 1].prismaMs ?? "?"}`);
  }
  const data = JSON.parse(fs.readFileSync(OUT, "utf8"));
  data.httpProfile = { base: BASE, capturedAt: new Date().toISOString(), pages: results };
  data.profilingConfig = {
    ...data.profilingConfig,
    note: "HTTP captured with PROFILE_PRODUCTION=1 dev server",
  };
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
  const { generatePerformanceDocs } = await import("./generate-performance-profile-docs");
  generatePerformanceDocs(data);
}

main().catch(console.error);
