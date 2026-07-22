#!/usr/bin/env node
/**
 * Nightly backups with retention: daily x14, weekly x8, monthly x12.
 * Usage: npm run backup:nightly
 */
const { existsSync, mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync, readFileSync, writeFileSync } = require("fs");
const { join, resolve } = require("path");
const { execSync } = require("child_process");
const { loadEnvFiles } = require("./lib/deploy-config");
const { ROOT } = require("./lib/paths");

loadEnvFiles();

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function retentionCleanup(dir, { daily = 14, weekly = 8, monthly = 12 } = {}) {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".tar.gz") || f.endsWith(".json"))
    .map((f) => ({ name: f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  const keep = new Set(files.slice(0, daily).map((f) => f.name));
  for (const file of files) {
    if (keep.has(file.name)) continue;
    const ageDays = (Date.now() - file.mtime) / (24 * 60 * 60 * 1000);
    const isWeeklyKeep = ageDays <= weekly * 7 && file.name.includes("-w");
    const isMonthlyKeep = ageDays <= monthly * 30 && file.name.includes("-m");
    if (!isWeeklyKeep && !isMonthlyKeep) {
      unlinkSync(join(dir, file.name));
    }
  }
}

function main() {
  const backupRoot = resolve(process.env.BACKUP_ROOT || join(ROOT, "backups"));
  const nightlyDir = join(backupRoot, "nightly", stamp().slice(0, 10));
  mkdirSync(nightlyDir, { recursive: true });

  console.log(`[backup] writing to ${nightlyDir}`);

  if (process.env.DATABASE_URL) {
    const dbFile = join(nightlyDir, "database.sql.gz");
    execSync(`pg_dump "$DATABASE_URL" | gzip > ${JSON.stringify(dbFile)}`, {
      stdio: "inherit",
      shell: true,
      env: process.env,
    });
  }

  const mediaRoot = process.env.MEDIA_ROOT;
  if (mediaRoot && existsSync(mediaRoot)) {
    const uploadsArchive = join(nightlyDir, "uploads.tar.gz");
    execSync(`tar -czf ${JSON.stringify(uploadsArchive)} -C ${JSON.stringify(mediaRoot)} .`, {
      stdio: "inherit",
      shell: true,
    });
  }

  for (const envFile of [".env", ".env.local"]) {
    const src = join(ROOT, envFile);
    if (existsSync(src)) copyFileSync(src, join(nightlyDir, envFile));
  }

  for (const manifest of [
    ".next/standalone/deployment/build.json",
    ".next/standalone/build/version.json",
  ]) {
    const src = join(ROOT, manifest);
    if (existsSync(src)) copyFileSync(src, join(nightlyDir, manifest.replace(/[\\/]/g, "-")));
  }

  writeFileSync(
    join(nightlyDir, "manifest.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), files: readdirSync(nightlyDir) }, null, 2)
  );

  retentionCleanup(join(backupRoot, "nightly"));
  console.log("[backup] nightly backup complete");
}

main();
