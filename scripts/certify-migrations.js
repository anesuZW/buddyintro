#!/usr/bin/env node
/**
 * Production migration certification — runs REAL migrate deploy against a fresh database.
 *
 * Usage:
 *   MIGRATION_CERT_DATABASE_URL=postgresql://... node scripts/certify-migrations.js
 *
 * Uses DIRECT_URL or MIGRATION_CERT_DATABASE_URL from .env when unset.
 * DESTRUCTIVE: drops and recreates the target database public schema.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LOG_DIR = path.join(ROOT, "deployment", "logs");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function run(cmd, args, env = {}) {
  const redactedArgs = args.map((a) =>
    typeof a === "string" && /^postgres(ql)?:\/\//i.test(a) ? a.replace(/:[^:@/]+@/, ":***@") : a
  );
  console.log(`\n→ ${cmd} ${redactedArgs.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  const out = `${result.stdout || ""}${result.stderr || ""}`;
  if (out.trim()) process.stdout.write(out);
  return { ...result, combined: out };
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function main() {
  loadEnv();

  const certUrl =
    process.env.MIGRATION_CERT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.DIRECT_URL;

  if (!certUrl) {
    console.error("Set MIGRATION_CERT_DATABASE_URL, DIRECT_URL, or DATABASE_URL");
    process.exit(1);
  }

  if (!/buddyintro_cert|migration_cert|_cert_test/i.test(certUrl) && !process.env.MIGRATION_CERT_ALLOW_PRODUCTION) {
    console.error(
      "Safety: certification URL must contain 'cert' or 'migration_cert', or set MIGRATION_CERT_ALLOW_PRODUCTION=1"
    );
    process.exit(1);
  }

  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, `migration-cert-${timestamp()}.log`);
  const log = (line) => {
    const entry = `[${new Date().toISOString()}] ${line}\n`;
    fs.appendFileSync(logPath, entry);
    console.log(line);
  };

  log("=== BuddyIntro Migration Certification ===");
  log(`Target: ${certUrl.replace(/:[^:@/]+@/, ":***@")}`);

  const env = { DATABASE_URL: certUrl, DIRECT_URL: certUrl };

  log("\n--- Step 1: Drop and recreate schema ---");
  const reset = run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], env);
  if (reset.status !== 0) {
    log("FAIL: prisma migrate reset");
    process.exit(1);
  }
  log("PASS: migrate reset (empty database)");

  log("\n--- Step 2: prisma migrate deploy ---");
  const deploy = run("npx", ["prisma", "migrate", "deploy"], env);
  if (deploy.status !== 0) {
    log("FAIL: prisma migrate deploy");
    process.exit(1);
  }
  log("PASS: migrate deploy");

  log("\n--- Step 3: prisma generate ---");
  const gen = run("npx", ["prisma", "generate"], env);
  if (gen.status !== 0) {
    log("FAIL: prisma generate");
    process.exit(1);
  }
  log("PASS: prisma generate");

  log("\n--- Step 4: prisma migrate status ---");
  const status = run("npx", ["prisma", "migrate", "status"], env);
  if (status.status !== 0 || !/Database schema is up to date/i.test(status.combined)) {
    log("FAIL: migrate status not clean");
    process.exit(1);
  }
  log("PASS: migrate status clean");

  log("\n--- Step 5: schema drift check ---");
  const driftPath = path.join(ROOT, "prisma", "_cert_drift.sql");
  const diff = run(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-url",
      certUrl,
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
      "-o",
      driftPath,
    ],
    env
  );

  if (diff.status !== 0) {
    log("FAIL: prisma migrate diff");
    process.exit(1);
  }

  const drift = fs.existsSync(driftPath) ? fs.readFileSync(driftPath, "utf8").trim() : "";
  const driftSql = drift
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("--"))
    .join("\n")
    .trim();
  if (driftSql.length > 0) {
    log("FAIL: schema drift detected");
    log(drift.slice(0, 1000));
    process.exit(1);
  }
  fs.unlinkSync(driftPath);
  log("PASS: zero schema drift");

  log("\n=== CERTIFICATION PASSED ===");
  log(`Log: ${logPath.replace(/\\/g, "/")}`);
}

main();
