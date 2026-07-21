#!/usr/bin/env node
/**
 * Remove Next.js output before a production build so stale standalone cannot survive.
 */
const { existsSync, rmSync } = require("fs");
const { join } = require("path");
const { ROOT } = require("./lib/paths");

const targets = [
  join(ROOT, ".next"),
];

console.log("Cleaning Next.js build output…");
for (const dir of targets) {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
    console.log(`  ✓ removed ${dir.replace(ROOT, ".")}`);
  }
}
console.log("Build clean complete.");
