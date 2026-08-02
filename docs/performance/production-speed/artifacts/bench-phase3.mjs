#!/usr/bin/env node
/**
 * Phase 3 production speed bench: TTFB, encoding, cache headers, auth pages.
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
  "http://127.0.0.1:3050";
const LABEL =
  process.argv.find((a) => a.startsWith("--label="))?.split("=")[1] ?? "after";

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

async function hit(url, headers = {}) {
  const t0 = performance.now();
  const res = await fetch(url, {
    headers: {
      "Accept-Encoding": "gzip, deflate, br",
      ...headers,
    },
    redirect: "manual",
  });
  const ttfbMs = Math.round(performance.now() - t0);
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    url,
    status: res.status,
    ttfbMs,
    bytes: buf.length,
    contentEncoding: res.headers.get("content-encoding"),
    cacheControl: res.headers.get("cache-control"),
    xPoweredBy: res.headers.get("x-powered-by"),
    location: res.headers.get("location"),
  };
}

function median(nums) {
  const a = [...nums].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)] ?? null;
}

async function main() {
  const ck = await cookie();
  const pages = ["/login", "/home", "/discoveries", "/messages", "/profile"];
  const pageResults = {};
  for (const page of pages) {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      samples.push(await hit(`${BASE}${page}`, { Cookie: ck }));
    }
    pageResults[page] = {
      status: samples.map((s) => s.status),
      ttfbMs: samples.map((s) => s.ttfbMs),
      medianTtfbMs: median(samples.map((s) => s.ttfbMs)),
      contentEncoding: samples[2].contentEncoding,
      xPoweredBy: samples[2].xPoweredBy,
      samples,
    };
  }

  const sharedChunk = "static/chunks/fd9d1056-f3c5f4be60681c42.js";
  const staticHit = await hit(`${BASE}/_next/${sharedChunk}`);
  const swHit = await hit(`${BASE}/sw.js`);

  const out = {
    label: LABEL,
    base: BASE,
    measuredAt: new Date().toISOString(),
    pages: pageResults,
    staticAsset: staticHit,
    serviceWorker: swHit,
  };
  const outDir = path.join(
    process.cwd(),
    "docs/performance/production-speed/artifacts"
  );
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `runtime-${LABEL}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
