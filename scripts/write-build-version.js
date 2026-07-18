#!/usr/bin/env node
/**
 * Write build/version.json and deployment/build.json after next build.
 */
const { createReleaseId, writeBuildMetadata } = require("./lib/deploy-metadata");
const { join } = require("path");
const { ROOT } = require("./lib/paths");

function main() {
  const releaseId = process.env.DEPLOY_RELEASE_ID || createReleaseId();
  const { meta } = writeBuildMetadata(ROOT, releaseId);
  console.log(
    `✓ build/version.json + deployment/build.json (commit ${meta.gitCommit.slice(0, 7)}, release ${releaseId})`
  );
}

main();
