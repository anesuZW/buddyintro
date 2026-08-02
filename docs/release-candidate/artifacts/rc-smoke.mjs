#!/usr/bin/env node
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://127.0.0.1:3060";

async function cookieHeader() {
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

async function hit(path, cookie, accept = "*/*") {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookie, Accept: accept },
    redirect: "manual",
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    path,
    status: res.status,
    ttfbMs: Date.now() - t0,
    bytes: buf.length,
    contentType: res.headers.get("content-type"),
    location: res.headers.get("location"),
    encoding: res.headers.get("content-encoding"),
    snippet: buf.toString("utf8").slice(0, 160),
  };
}

const cookie = await cookieHeader();
const pages = [
  "/home",
  "/discoveries",
  "/messages",
  "/profile",
  "/notifications",
  "/create-story",
  "/introductions",
  "/manifest.webmanifest",
  "/sw.js",
];
const apis = [
  "/api/health",
  "/api/version",
  "/api/feed",
  "/api/discoveries",
  "/api/messages",
  "/api/notifications?limit=5",
  "/api/stories",
  "/api/trust/recommendations",
];

const out = { at: new Date().toISOString(), base: BASE, pages: [], apis: [] };
for (const p of pages) out.pages.push(await hit(p, cookie, "text/html,*/*"));
for (const p of apis) out.apis.push(await hit(p, cookie, "application/json"));

// unauth security probes
out.security = [];
for (const p of ["/api/feed", "/api/discoveries", "/api/messages", "/home"]) {
  const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
  await res.arrayBuffer();
  out.security.push({
    path: p,
    status: res.status,
    location: res.headers.get("location"),
  });
}

fs.mkdirSync("docs/release-candidate/artifacts", { recursive: true });
fs.writeFileSync(
  "docs/release-candidate/artifacts/smoke-pages-apis.json",
  JSON.stringify(out, null, 2)
);
console.log(JSON.stringify(out, null, 2));
