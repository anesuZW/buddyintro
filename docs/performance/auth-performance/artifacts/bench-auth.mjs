/**
 * Auth latency benchmark — before/after Phase 2.
 * Captures middleware segment headers + TTFB for key pages.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "http://127.0.0.1:3030";
const LABEL =
  process.argv.find((a) => a.startsWith("--label="))?.split("=")[1] ?? "run";
const RUNS = Number(
  process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? "2"
);

async function cookie() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const auth = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.signInWithPassword({
    email: "user1@friendintro.com",
    password: "123456",
  });
  if (error || !data.session) throw new Error(error?.message ?? "login failed");
  const jar = {};
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

function num(h, name) {
  const v = h.get(name);
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function hit(page, cookieHeader) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${page}`, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });
  const ttfbMs = Math.round(performance.now() - t0);
  await res.arrayBuffer();
  const totalMs = Math.round(performance.now() - t0);
  return {
    page,
    status: res.status,
    ttfbMs,
    totalMs,
    middlewareMs: num(res.headers, "x-auth-profile-middleware-ms"),
    createClientMs: num(res.headers, "x-auth-create-client-ms"),
    sessionMs: num(res.headers, "x-auth-session-ms"),
    getUserNetworkMs: num(res.headers, "x-auth-get-user-ms"),
    refreshMs: num(res.headers, "x-auth-refresh-ms"),
    routeGetUserMs: num(res.headers, "x-auth-profile-route-getuser-ms"),
    prismaMs: num(res.headers, "x-auth-profile-prisma-ms"),
    getUserCalls: num(res.headers, "x-auth-profile-getuser-calls"),
    resolveMethod: res.headers.get("x-auth-resolve-method"),
    requestId: res.headers.get("x-auth-profile-id"),
  };
}

function median(vals) {
  const s = vals.filter((v) => v != null).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.floor(s.length / 2)];
}

async function main() {
  const c = await cookie();
  const pages = ["/home", "/discoveries", "/messages", "/profile"];
  const runs = [];
  for (let i = 0; i < RUNS; i++) {
    const batch = [];
    for (const p of pages) batch.push(await hit(p, c));
    runs.push(batch);
    console.log(`run ${i + 1}`, batch.map((r) => `${r.page}:${r.status}/${r.ttfbMs}`).join(" "));
  }

  const summary = {};
  for (const p of pages) {
    const rows = runs.map((r) => r.find((x) => x.page === p)).filter(Boolean);
    summary[p] = {
      status: rows.map((r) => r.status),
      ttfbMs: { samples: rows.map((r) => r.ttfbMs), median: median(rows.map((r) => r.ttfbMs)) },
      middlewareMs: {
        samples: rows.map((r) => r.middlewareMs),
        median: median(rows.map((r) => r.middlewareMs)),
      },
      getUserNetworkMs: {
        samples: rows.map((r) => r.getUserNetworkMs),
        median: median(rows.map((r) => r.getUserNetworkMs)),
      },
      createClientMs: { median: median(rows.map((r) => r.createClientMs)) },
      sessionMs: { median: median(rows.map((r) => r.sessionMs)) },
      routeGetUserMs: { median: median(rows.map((r) => r.routeGetUserMs)) },
      getUserCalls: { median: median(rows.map((r) => r.getUserCalls)) },
      last: rows[rows.length - 1],
    };
  }

  const out = {
    label: LABEL,
    capturedAt: new Date().toISOString(),
    base: BASE,
    runs: RUNS,
    summary,
    raw: runs,
  };
  const dir = "docs/performance/auth-performance/artifacts";
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `bench-${LABEL}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("wrote", file);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
