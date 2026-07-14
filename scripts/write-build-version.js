#!/usr/bin/env node
/**
 * Write build/version.json after next build — consumed by /api/version at runtime.
 */
const { mkdirSync, writeFileSync, readFileSync } = require("fs");
const { join } = require("path");
const { tryGitCapture } = require("./lib/exec");
const { ROOT, PACKAGE_JSON } = require("./lib/paths");

function main() {
  const commit = tryGitCapture(["rev-parse", "HEAD"]) || "unknown";
  const branch = tryGitCapture(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));

  const payload = {
    commit,
    branch,
    version: pkg.version || "0.0.0",
    builtAt: new Date().toISOString(),
    node: process.version,
  };

  const dir = join(ROOT, "build");
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, "version.json");
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`✓ ${outPath.replace(/\\/g, "/")} (commit ${commit.slice(0, 7)})`);
}

main();
