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

const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://127.0.0.1:3020";

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

async function main() {
  const c = await cookie();
  const pages = ["/home", "/discoveries", "/messages", "/profile"];
  const results = [];
  for (const page of pages) {
    const t0 = performance.now();
    const res = await fetch(`${BASE}${page}`, {
      headers: { Cookie: c },
      redirect: "manual",
    });
    const text = await res.text();
    const totalMs = Math.round(performance.now() - t0);
    const schemaError =
      /P2022|preferred_language|does not exist in the current database/i.test(text);
    const row = {
      page,
      status: res.status,
      totalMs,
      schemaError,
      digest: (text.match(/digest:\s*"?(\d+)"?/) || [])[1] || null,
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
  const out = {
    capturedAt: new Date().toISOString(),
    base: BASE,
    results,
    allOk: results.every((r) => r.status === 200 && !r.schemaError),
  };
  fs.writeFileSync(
    "docs/performance/production-fix/artifacts/verify-pages.json",
    JSON.stringify(out, null, 2)
  );
  console.log("allOk=", out.allOk);
  process.exit(out.allOk ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
