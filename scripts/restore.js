#!/usr/bin/env node
/**
 * Disaster recovery restore utility.
 * Usage:
 *   node scripts/restore.js --backup ./backups/nightly/2026-07-19 --database --uploads --env
 */
const { existsSync, readFileSync, copyFileSync, mkdirSync } = require("fs");
const { join, resolve } = require("path");
const { execSync } = require("child_process");
const { loadEnvFiles } = require("./lib/deploy-config");
const { ROOT } = require("./lib/paths");
const { getBlueGreenConfig, rollbackToRelease } = require("./lib/deploy-bluegreen");

loadEnvFiles();

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    backup: args[args.indexOf("--backup") + 1],
    database: args.includes("--database"),
    uploads: args.includes("--uploads"),
    env: args.includes("--env"),
    release: args[args.indexOf("--release") + 1],
  };
}

function main() {
  const opts = parseArgs();
  if (!opts.backup && !opts.release) {
    console.error("Usage: node scripts/restore.js --backup <dir> [--database] [--uploads] [--env]");
    console.error("       node scripts/restore.js --release <releaseId>");
    process.exit(1);
  }

  if (opts.release) {
    const config = getBlueGreenConfig();
    rollbackToRelease(config, opts.release);
    console.log(`✓ Rolled back to release ${opts.release}`);
    return;
  }

  const backupDir = resolve(opts.backup);
  if (!existsSync(backupDir)) throw new Error(`Backup not found: ${backupDir}`);

  if (opts.database) {
    const dbFile = join(backupDir, "database.sql.gz");
    if (!existsSync(dbFile)) throw new Error("database.sql.gz not found in backup");
    execSync(`gunzip -c ${JSON.stringify(dbFile)} | psql "$DATABASE_URL"`, {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
    console.log("✓ Database restored");
  }

  if (opts.uploads) {
    const uploadsArchive = join(backupDir, "uploads.tar.gz");
    const mediaRoot = process.env.MEDIA_ROOT || "/home/buddyintro/uploads";
    if (!existsSync(uploadsArchive)) throw new Error("uploads.tar.gz not found in backup");
    mkdirSync(mediaRoot, { recursive: true });
    execSync(`tar -xzf ${JSON.stringify(uploadsArchive)} -C ${JSON.stringify(mediaRoot)}`, {
      stdio: "inherit",
      shell: true,
    });
    console.log("✓ Uploads restored");
  }

  if (opts.env) {
    for (const envFile of [".env", ".env.local"]) {
      const src = join(backupDir, envFile);
      if (existsSync(src)) {
        copyFileSync(src, join(ROOT, envFile));
        console.log(`✓ Restored ${envFile}`);
      }
    }
  }

  const manifest = join(backupDir, "manifest.json");
  if (existsSync(manifest)) {
    console.log("Backup manifest:", readFileSync(manifest, "utf8"));
  }
}

main();
