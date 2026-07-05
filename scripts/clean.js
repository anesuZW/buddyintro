#!/usr/bin/env node
/** Usage: npm run clean */
const { existsSync, rmSync, unlinkSync } = require("fs");
const { join } = require("path");
const { ROOT, STAGING_DIR } = require("./lib/paths");

const targets = [
  join(ROOT, ".next"),
  join(ROOT, "out"),
  join(ROOT, "dist"),
  join(ROOT, "deploy"),
  STAGING_DIR,
  join(ROOT, ".eslintcache"),
];

console.log("Cleaning build artifacts…");
for (const dir of targets) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`  ✓ removed ${dir.replace(ROOT, ".")}`);
  }
}

const tsbuild = join(ROOT, "tsconfig.tsbuildinfo");
if (existsSync(tsbuild)) {
  unlinkSync(tsbuild);
  console.log("  ✓ removed tsconfig.tsbuildinfo");
}

console.log("Clean complete.");
