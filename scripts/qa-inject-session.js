#!/usr/bin/env node
/** Build Supabase session cookies for QA browser injection. */
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");

for (const f of [".env.local", ".env"]) {
  const p = resolve(process.cwd(), f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const EMAIL = process.argv[2] || "user1@friendintro.com";
const PASSWORD = process.argv[3] || "123456";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message}`);

  const cookieJar = {};
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get: (name) => cookieJar[name],
      set: (name, value) => {
        cookieJar[name] = value;
      },
      remove: (name) => {
        delete cookieJar[name];
      },
    },
  });
  await supabase.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });

  console.log(
    JSON.stringify({
      email: data.user.email,
      cookies: Object.entries(cookieJar).map(([name, value]) => ({
        name,
        value,
        domain: "localhost",
        path: "/",
        httpOnly: false,
        secure: false,
      })),
    })
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
