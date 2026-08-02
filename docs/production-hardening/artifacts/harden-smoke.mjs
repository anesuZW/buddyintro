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

const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "http://127.0.0.1:3070";

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

async function hit(method, path, { ck, body, origin } = {}) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(ck ? { Cookie: ck } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(origin
        ? { Origin: origin, Referer: `${origin}/` }
        : { Origin: new URL(BASE).origin, Referer: `${BASE}/` }),
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return {
    method,
    path,
    status: res.status,
    ms: Date.now() - t0,
    json,
    bodyPreview: text.slice(0, 200),
  };
}

const ck = await cookie();
const origin = new URL(BASE).origin;
const out = { at: new Date().toISOString(), base: BASE, checks: [] };

out.checks.push(await hit("GET", "/api/health"));
out.checks.push(await hit("GET", "/api/feed")); // 401
out.checks.push(await hit("GET", "/api/feed", { ck }));
out.checks.push(await hit("GET", "/api/discoveries", { ck }));
out.checks.push(await hit("GET", "/api/messages", { ck }));
out.checks.push(await hit("GET", "/api/notifications?limit=5", { ck }));
out.checks.push(await hit("GET", "/api/stories", { ck }));
out.checks.push(await hit("GET", "/api/push/subscribe", { ck }));
out.checks.push(
  await hit("POST", "/api/discoveries", {
    ck,
    body: { content: `harden smoke ${Date.now()}` },
    origin,
  })
);
out.checks.push(
  await hit("POST", "/api/discoveries", {
    ck,
    body: { content: "bad" },
    origin: "https://evil.example",
  })
);
out.checks.push(
  await hit("POST", "/api/messages", {
    ck,
    body: { receiverId: "not-a-uuid", message: "x" },
    origin,
  })
);
out.checks.push(await hit("GET", "/home", { ck }));
out.checks.push(await hit("GET", "/manifest.webmanifest"));
out.checks.push(await hit("GET", "/sw.js"));

fs.writeFileSync(
  "docs/production-hardening/artifacts/harden-smoke.json",
  JSON.stringify(out, null, 2)
);
console.log(JSON.stringify(out, null, 2));
