#!/usr/bin/env node
/**
 * Verify production/staging database migration history is synchronized with the repo.
 *
 * Usage:
 *   DIRECT_URL=postgresql://... node scripts/check-migration-sync.js
 *   npm run check:migration-sync
 *
 * Exit codes:
 *   0 — synchronized (or only pending deployable migrations like 0009_i18n)
 *   1 — baseline required or drift detected
 *   2 — connection / configuration error
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { MIGRATION_ORDER } = require("./lib/migration-audit");

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "prisma", "migrations");

/** Schema markers proving a migration's effects already exist in the database. */
const MIGRATION_MARKERS = {
  "0001_baseline": { table: "users" },
  "0002_discoveries": { table: "discoveries_posts" },
  "0003_trust_graph": { table: "user_connections" },
  "0004_notifications": { table: "notifications" },
  "0005_moderation": { table: "user_blocks" },
  "0006_platform": { table: "background_jobs" },
  "0007_security_rbac": { table: "roles" },
  "0008_media_platform": { table: "media_objects" },
  "0009_i18n": { column: { table: "users", name: "preferred_language" } },
};

const BASELINE_MIGRATIONS = MIGRATION_ORDER.filter((id) => id !== "0009_i18n");

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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function listRepoMigrations() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((e) => fs.statSync(path.join(MIGRATIONS_DIR, e)).isDirectory())
    .filter((e) => /^\d{4}_/.test(e))
    .sort();
}

function runDiffFromDb(url) {
  const outFile = path.join(ROOT, "prisma", "_sync_diff.sql");
  const diff = spawnSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-url",
      url,
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
      "-o",
      outFile,
    ],
    { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" }
  );

  if (diff.status !== 0) {
    return { ok: false, error: (diff.stderr || diff.stdout || "").trim() };
  }

  const sql = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8").trim() : "";
  if (fs.existsSync(outFile)) fs.unlinkSync(outFile);

  const meaningful = sql
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("--"))
    .join("\n")
    .trim();

  return { ok: true, sql: meaningful };
}

async function tableExists(client, table) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [table]
  );
  return result.rowCount > 0;
}

async function columnExists(client, table, column) {
  const result = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, column]
  );
  return result.rowCount > 0;
}

async function markerPresent(client, migrationId) {
  const marker = MIGRATION_MARKERS[migrationId];
  if (!marker) return true;
  if (marker.table) return tableExists(client, marker.table);
  if (marker.column) return columnExists(client, marker.column.table, marker.column.name);
  return true;
}

function printBaselineCommands(missing) {
  console.log("\nRun once on production (after backup + verification):\n");
  for (const id of missing) {
    console.log(`npx prisma migrate resolve --applied ${id}`);
  }
  console.log("\nThen apply pending migrations:\n");
  console.log("npx prisma migrate deploy");
  console.log("\nVerify:\n");
  console.log("npx prisma migrate status");
  console.log("npm run check:migration-sync");
}

async function main() {
  loadEnv();
  const url = process.env.MIGRATION_SYNC_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

  console.log("\n=== Migration Sync Check ===\n");

  const repoMigrations = listRepoMigrations();
  console.log(`Repo migrations: ${repoMigrations.length}`);
  repoMigrations.forEach((id) => console.log(`  - ${id}`));

  if (JSON.stringify(repoMigrations) !== JSON.stringify(MIGRATION_ORDER)) {
    console.error("\n✗ Repo migration folders do not match MIGRATION_ORDER audit list");
    process.exit(1);
  }

  if (!url) {
    console.log("\n○ Skipped database check (set DIRECT_URL to verify production sync)");
    console.log("✓ Local migration folder audit passed\n");
    process.exit(0);
    return;
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
  } catch (err) {
    console.error(`\n✗ Could not connect to database: ${err.message}`);
    process.exit(2);
  }

  let hasHistoryTable = false;
  let applied = [];

  try {
    hasHistoryTable = await tableExists(client, "_prisma_migrations");
    if (hasHistoryTable) {
      const result = await client.query(
        `SELECT migration_name, finished_at, rolled_back_at
         FROM _prisma_migrations
         WHERE rolled_back_at IS NULL
         ORDER BY finished_at`
      );
      applied = result.rows.map((row) => row.migration_name);
    }
  } catch (err) {
    console.error(`\n✗ Failed reading _prisma_migrations: ${err.message}`);
    await client.end();
    process.exit(2);
  }

  console.log(`\nDatabase: ${hasHistoryTable ? "_prisma_migrations present" : "NO _prisma_migrations table"}`);
  if (applied.length) {
    console.log(`Applied (${applied.length}):`);
    applied.forEach((name) => console.log(`  - ${name}`));
  } else {
    console.log("Applied: none recorded");
  }

  const appliedSet = new Set(applied);
  const missingBaseline = BASELINE_MIGRATIONS.filter((id) => !appliedSet.has(id));
  const pendingDeploy = repoMigrations.filter((id) => !appliedSet.has(id));

  console.log("\n→ Checking schema markers for baseline migrations");
  const markerFailures = [];
  for (const id of BASELINE_MIGRATIONS) {
    const ok = await markerPresent(client, id);
    if (ok) {
      console.log(`  ✓ ${id}`);
    } else {
      console.log(`  ✗ ${id} — expected schema marker missing`);
      markerFailures.push(id);
    }
  }

  if (markerFailures.length) {
    console.error(
      "\n✗ Database schema does not match migrations " +
        markerFailures.join(", ") +
        ". Do NOT run migrate resolve until schema is reconciled."
    );
    await client.end();
    process.exit(1);
  }

  const diff = runDiffFromDb(url);
  if (!diff.ok) {
    console.log(`\n! Skipped schema diff: ${diff.error.split("\n")[0]}`);
  } else if (diff.sql) {
    console.log("\n→ Schema diff (database → schema.prisma):");
    console.log(diff.sql.split("\n").slice(0, 20).join("\n"));
    if (diff.sql.split("\n").length > 20) console.log("  ...");
  } else {
    console.log("\n✓ Database schema matches schema.prisma");
  }

  const i18nApplied = await markerPresent(client, "0009_i18n");

  if (!hasHistoryTable || missingBaseline.length === BASELINE_MIGRATIONS.length) {
    console.error("\n✗ P3005 baseline required — live database predates Prisma Migrate history");
    console.error("  The database has application tables but no recorded 0001–0008 migrations.");
    console.error("  Use prisma migrate resolve --applied (does NOT re-run SQL or delete data).");
    printBaselineCommands(BASELINE_MIGRATIONS);
    await client.end();
    process.exit(1);
  }

  if (missingBaseline.length > 0) {
    console.error(`\n✗ Baseline incomplete — missing ${missingBaseline.length} resolved migration(s):`);
    missingBaseline.forEach((id) => console.error(`  - ${id}`));
    printBaselineCommands(missingBaseline);
    await client.end();
    process.exit(1);
  }

  if (pendingDeploy.length === 1 && pendingDeploy[0] === "0009_i18n") {
    console.log("\n○ Pending migration ready for deploy: 0009_i18n");
    if (i18nApplied) {
      console.log("  ! Column users.preferred_language already exists — run migrate resolve --applied 0009_i18n if deploy fails");
    } else {
      console.log("  Run: npx prisma migrate deploy");
    }
    await client.end();
    console.log("\n✓ Migration history synchronized through 0008 — safe to deploy 0009\n");
    return;
  }

  if (pendingDeploy.length > 0) {
    console.error(`\n✗ Pending migrations not applied: ${pendingDeploy.join(", ")}`);
    console.error("  Run: npx prisma migrate deploy");
    await client.end();
    process.exit(1);
  }

  if (!i18nApplied) {
    console.error("\n✗ 0009_i18n marked applied but users.preferred_language is missing");
    await client.end();
    process.exit(1);
  }

  await client.end();
  console.log("\n✓ Migration history fully synchronized\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
