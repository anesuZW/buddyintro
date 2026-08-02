/**
 * READ-ONLY auth + page capture for Production Readiness.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "http://127.0.0.1:3010";
const OUT = path.resolve(
  "docs/performance/production-readiness/artifacts/auth-runtime-capture.json"
);

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

async function cookieHeader() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = createClient(url, key, { auth: { persistSession: false } });
  const signInStart = performance.now();
  const { data, error } = await auth.auth.signInWithPassword({
    email: "user1@friendintro.com",
    password: "123456",
  });
  const signInMs = Math.round(performance.now() - signInStart);
  if (error || !data.session) throw new Error(error?.message ?? "no session");

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
  return {
    cookie: Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; "),
    signInMs,
  };
}

function pickHeaders(res: Response) {
  const names = [
    "x-auth-profile-id",
    "x-auth-profile-middleware-ms",
    "x-auth-create-client-ms",
    "x-auth-session-ms",
    "x-auth-get-user-ms",
    "x-auth-refresh-ms",
    "x-auth-response-ms",
    "x-auth-profile-route-getuser-ms",
    "x-auth-profile-prisma-ms",
    "x-auth-profile-serialize-ms",
    "x-auth-profile-other-ms",
    "x-auth-profile-total-ms",
    "x-auth-profile-getuser-calls",
    "x-bench-auth-ms",
    "x-bench-prisma-ms",
    "x-bench-request-id",
    "x-bench-total-ms",
    "server-timing",
  ];
  const out: Record<string, string | null> = {};
  for (const n of names) out[n] = res.headers.get(n);
  return out;
}

async function hit(page: string, cookie: string) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${page}`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  const ttfbMs = Math.round(performance.now() - t0);
  const buf = await res.arrayBuffer();
  const totalMs = Math.round(performance.now() - t0);
  return {
    page,
    status: res.status,
    ttfbMs,
    totalMs,
    bodyBytes: buf.byteLength,
    headers: pickHeaders(res),
  };
}

async function main() {
  loadEnv();
  const { cookie, signInMs } = await cookieHeader();

  // Direct Auth API RTT (external)
  const authUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`;
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const s = performance.now();
    await fetch(authUrl, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${cookie.match(/sb-[^=]+-auth-token[^;]*/)?.[0] ?? ""}`,
      },
    }).catch(() => null);
    samples.push(Math.round(performance.now() - s));
  }

  const pages = ["/", "/home", "/discoveries", "/messages", "/profile", "/login"];
  const results = [];
  for (const p of pages) {
    results.push(await hit(p, cookie));
    console.log(
      `${p} status=${results[results.length - 1].status} ttfb=${results[results.length - 1].ttfbMs} auth=${results[results.length - 1].headers["x-bench-auth-ms"] ?? results[results.length - 1].headers["x-auth-profile-middleware-ms"]}`
    );
  }

  const out = {
    capturedAt: new Date().toISOString(),
    base: BASE,
    signInMs,
    authUserProbeSamplesMs: samples,
    pages: results,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log("wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
