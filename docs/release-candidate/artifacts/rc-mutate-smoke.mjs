#!/usr/bin/env node
/** Authenticated mutating smoke: discovery post + upload probe. */
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

const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "http://127.0.0.1:3062";

async function cookieHeader() {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const auth = createClient(supabaseUrl, anon, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.signInWithPassword({
    email: "user1@friendintro.com",
    password: "123456",
  });
  if (error || !data.session) throw new Error(error?.message ?? "login failed");
  const jar = {};
  const sb = createServerClient(supabaseUrl, anon, {
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

const cookie = await cookieHeader();
const origin = new URL(BASE).origin;
const results = [];

async function post(path, body, extraHeaders = {}) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      Origin: origin,
      Referer: `${origin}/discoveries`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  results.push({
    path,
    status: res.status,
    ms: Date.now() - t0,
    body: text.slice(0, 240),
  });
}

// Same-host origin (should pass after loopback fix)
await post("/api/discoveries", {
  content: `RC mutate smoke ${new Date().toISOString()}`,
});

// Cross-host loopback alias (127 vs localhost) — must pass after RC fix
const aliasOrigin = origin.includes("127.0.0.1")
  ? origin.replace("127.0.0.1", "localhost")
  : origin.replace("localhost", "127.0.0.1");
await post(
  "/api/discoveries",
  { content: `RC alias origin smoke ${Date.now()}` },
  { Origin: aliasOrigin, Referer: `${aliasOrigin}/discoveries` }
);

// Small PNG upload
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const form = new FormData();
form.append("file", new Blob([png], { type: "image/png" }), "rc-pixel.png");
form.append("kind", "image");
const t0 = Date.now();
const up = await fetch(`${BASE}/api/media/upload`, {
  method: "POST",
  headers: {
    Cookie: cookie,
    Origin: origin,
    Referer: `${origin}/create-story`,
  },
  body: form,
});
const upText = await up.text();
results.push({
  path: "/api/media/upload",
  status: up.status,
  ms: Date.now() - t0,
  body: upText.slice(0, 240),
});

const out = { at: new Date().toISOString(), base: BASE, results };
fs.writeFileSync(
  "docs/release-candidate/artifacts/mutate-smoke.json",
  JSON.stringify(out, null, 2)
);
console.log(JSON.stringify(out, null, 2));
