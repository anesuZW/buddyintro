#!/usr/bin/env node
/** Print Supabase auth cookie values for browser session injection (QA only). */
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
const supabase = createClient(url, anon);

supabase.auth.signInWithPassword({ email: "user1@friendintro.com", password: "123456" }).then(async ({ data, error }) => {
  if (error) {
    console.error(error.message);
    process.exit(1);
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) {
    console.error("no session");
    process.exit(1);
  }
  const projectRef = new URL(url).hostname.split(".")[0];
  const cookieBase = `sb-${projectRef}-auth-token`;
  console.log(JSON.stringify({
    cookieName: cookieBase,
    access_token: session.access_token.slice(0, 20) + "...",
    refresh_token: session.refresh_token.slice(0, 20) + "...",
    expires_at: session.expires_at,
    user: session.user.email,
  }, null, 2));
});
