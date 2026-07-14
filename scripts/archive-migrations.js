#!/usr/bin/env node
/**
 * Archive existing migrations to prisma/migrations_archive/ before rebuild.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS = path.join(ROOT, "prisma", "migrations");
const ARCHIVE = path.join(ROOT, "prisma", "migrations_archive");

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function main() {
  fs.mkdirSync(ARCHIVE, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const target = path.join(ARCHIVE, `pre-rebuild-${stamp}`);

  if (fs.existsSync(target)) {
    console.log(`Archive already exists: ${target}`);
    return;
  }

  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(MIGRATIONS)) {
    if (entry === "migration_lock.toml" || entry === "README.md") continue;
    const src = path.join(MIGRATIONS, entry);
    const dest = path.join(target, entry);
    copyRecursive(src, dest);
    if (fs.statSync(src).isDirectory()) {
      fs.rmSync(src, { recursive: true, force: true });
    } else {
      fs.unlinkSync(src);
    }
    console.log(`Archived: ${entry}`);
  }

  console.log(`\n✓ Archive complete: ${target.replace(/\\/g, "/")}`);
}

main();
