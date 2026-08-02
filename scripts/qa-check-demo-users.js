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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("missing supabase env");
  process.exit(1);
}

createClient(url, key)
  .auth.admin.listUsers({ page: 1, perPage: 200 })
  .then(({ data, error }) => {
    if (error) throw error;
    const demo = data.users.filter((u) => u.email?.includes("friendintro.com"));
    console.log("demo users:", demo.length);
    demo.slice(0, 5).forEach((u) => console.log(" -", u.email));
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
