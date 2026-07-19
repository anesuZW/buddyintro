#!/usr/bin/env node
/** Create release manifest metadata for the current build. */
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");
const { getLocalSHA } = require("./lib/git-integrity");
const { ROOT } = require("./lib/paths");

function main() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const build = JSON.parse(readFileSync(join(ROOT, "build", "version.json"), "utf8"));
  const manifest = {
    version: pkg.version,
    buildId: build.buildId,
    gitSha: getLocalSHA(),
    createdAt: new Date().toISOString(),
    node: process.version,
    mediaProvider: process.env.MEDIA_PROVIDER || "local",
  };

  mkdirSync(join(ROOT, "deployment"), { recursive: true });
  writeFileSync(join(ROOT, "deployment", "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("✓ Release manifest written to deployment/manifest.json");
  console.log(JSON.stringify(manifest, null, 2));
}

main();
