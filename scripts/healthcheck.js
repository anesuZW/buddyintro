#!/usr/bin/env node
/**
 * Production health verification.
 * Usage: npm run health [-- --url=https://buddyintro.com]
 */
const { existsSync, readFileSync } = require("fs");
const { spawnCommand } = require("./lib/exec");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

async function main() {
  loadEnv();

  const baseArg = process.argv.find((a) => a.startsWith("--url="));
  const base = (
    baseArg?.split("=")[1] ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");

  const checks = [];

  async function check(name, fn) {
    try {
      await fn();
      checks.push({ name, ok: true });
      console.log(`  ✓ ${name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({ name, ok: false, error: msg });
      console.log(`  ✗ ${name}: ${msg}`);
    }
  }

  console.log("\n=== BuddyIntro Health Check ===\n");
  console.log(`Target: ${base}\n`);

  await check("Environment (DATABASE_URL)", () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  });

  await check("Environment (Supabase URL)", () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  });

  await check("Deep check (Prisma + Supabase storage)", () => {
    const result = spawnCommand("npx", ["tsx", "scripts/health-check.ts"], { capture: true });
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "health-check.ts failed");
    }
  });

  await check("API /api/health", async () => {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body.status === "unhealthy") throw new Error(`status=${body.status}`);
  });

  await check("Supabase Auth endpoint", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase env missing");
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  for (const path of ["/login", "/offline"]) {
    await check(`Page ${path}`, async () => {
      const res = await fetch(`${base}${path}`, {
        signal: AbortSignal.timeout(15000),
        redirect: "manual",
      });
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    });
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n${failed.length ? "FAILED" : "PASSED"} — ${checks.length - failed.length}/${checks.length} checks OK\n`
  );
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
