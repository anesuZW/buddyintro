#!/usr/bin/env node
const { readFileSync, existsSync } = require("fs");
const { resolve } = require("path");
const { createClient } = require("@supabase/supabase-js");

for (const f of [".env", ".env.local"]) {
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("missing supabase anon env");
  process.exit(1);
}

const supabase = createClient(url, anon);
supabase.auth
  .signInWithPassword({ email: "user1@friendintro.com", password: "123456" })
  .then(({ data, error }) => {
    if (error) {
      console.error("login failed:", error.message);
      process.exit(1);
    }
    console.log("login ok:", data.user?.email, "session:", !!data.session);
  });
