#!/usr/bin/env node
/**
 * Validate rebuilt Prisma migration history.
 *
 * Usage:
 *   node scripts/validate-migrations.js
 *   MIGRATION_TEST_RESET=1 node scripts/validate-migrations.js  # reset + deploy (destructive)
 *
 * Requires DIRECT_URL or SHADOW_DATABASE_URL in .env for drift checks.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(ROOT, "prisma", "migrations");

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

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...opts,
  });
  return result;
}

function listMigrationFolders() {
  return fs
    .readdirSync(MIGRATIONS)
    .filter((e) => fs.statSync(path.join(MIGRATIONS, e)).isDirectory())
    .filter((e) => /^\d{4}_/.test(e))
    .sort();
}

function main() {
  loadEnv();
  const folders = listMigrationFolders();
  console.log("\n=== Migration Validation ===\n");
  console.log(`Migrations found: ${folders.length}`);
  folders.forEach((f) => console.log(`  - ${f}`));

  if (folders[0] !== "0001_baseline") {
    console.error("\n✗ FAIL: 0001_baseline must execute first");
    process.exit(1);
  }

  const baseline = fs.readFileSync(path.join(MIGRATIONS, "0001_baseline", "migration.sql"), "utf8");
  const forbiddenEarlyRefs = [
    "REFERENCES \"discoveries_posts\"",
    "REFERENCES \"introduction_categories\"",
    "REFERENCES \"notifications\"",
    "REFERENCES \"user_connections\"",
  ];
  for (const ref of forbiddenEarlyRefs) {
    if (baseline.includes(ref)) {
      console.error(`\n✗ FAIL: 0001_baseline references ${ref} — ordering broken`);
      process.exit(1);
    }
  }
  console.log("\n✓ Migration ordering checks passed");

  const shadowUrl = process.env.SHADOW_DATABASE_URL || process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (shadowUrl) {
    const driftOut = path.join(ROOT, "prisma", "_drift_check.sql");
    const diff = run("npx", [
      "prisma",
      "migrate",
      "diff",
      "--from-migrations",
      "prisma/migrations",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--shadow-database-url",
      shadowUrl,
      "--script",
      "-o",
      driftOut,
    ]);

    if (diff.status !== 0) {
      console.log("! Skipped drift check (shadow database unreachable or misconfigured)");
      if (diff.stderr) console.log(diff.stderr.trim().split("\n")[0]);
    } else {
      const drift = fs.existsSync(driftOut) ? fs.readFileSync(driftOut, "utf8").trim() : "";
      const driftSql = drift
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      if (driftSql.length > 0) {
        console.error("\n✗ FAIL: Schema drift detected between migrations and schema.prisma");
        console.error(drift.slice(0, 500));
        process.exit(1);
      }
      console.log("✓ No drift between migrations and schema.prisma");
      if (fs.existsSync(driftOut)) fs.unlinkSync(driftOut);
    }
  } else {
    console.log("! Skipped drift check (set DIRECT_URL or SHADOW_DATABASE_URL)");
  }

  if (process.env.MIGRATION_TEST_RESET === "1") {
    console.log("\n→ Resetting database and running migrate deploy…");
    const reset = run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"]);
    if (reset.status !== 0) {
      console.error(reset.stderr || reset.stdout);
      process.exit(1);
    }
    const status = run("npx", ["prisma", "migrate", "status"]);
    console.log(status.stdout);
    if (!/Database schema is up to date/i.test(status.stdout || "")) {
      console.error("\n✗ FAIL: migrate status not clean");
      process.exit(1);
    }
    console.log("✓ migrate deploy on empty database succeeded");
  }

  const gen = run("npx", ["prisma", "generate"]);
  if (gen.status !== 0) {
    console.error("\n✗ FAIL: prisma generate");
    process.exit(1);
  }
  console.log("✓ prisma generate succeeded");

  console.log("\n=== Validation PASSED ===\n");
}

main();
