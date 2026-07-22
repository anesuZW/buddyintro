#!/usr/bin/env node
/** Create release manifest metadata for the current build. */
const { readFileSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");
const { getLocalSHA } = require("./lib/git-integrity");
const { ROOT } = require("./lib/paths");

function main() {
  const versionPath = join(ROOT, ".next", "standalone", "build", "version.json");
  if (!existsSync(versionPath)) {
    throw new Error("Run npm run build first — .next/standalone/build/version.json is missing");
  }

  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const build = JSON.parse(readFileSync(versionPath, "utf8"));
  const manifest = {
    version: pkg.version,
    buildId: build.deploymentId,
    gitSha: build.commit || getLocalSHA(),
    createdAt: new Date().toISOString(),
    node: process.version,
    mediaProvider: process.env.MEDIA_PROVIDER || "local",
  };

  writeFileSync(join(ROOT, "deployment", "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("✓ Release manifest written to deployment/manifest.json");
  console.log(JSON.stringify(manifest, null, 2));
}

main();
