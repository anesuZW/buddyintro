#!/usr/bin/env node
/**
 * After next build: copy static/public + version manifests into .next/standalone.
 */
const { syncStandaloneBundle } = require("./lib/standalone-sync");
const { createReleaseId } = require("./lib/deploy-metadata");
const { ROOT } = require("./lib/paths");

function main() {
  const releaseId = process.env.DEPLOY_RELEASE_ID || createReleaseId();
  const { meta, paths } = syncStandaloneBundle(ROOT, releaseId);
  console.log(
    `✓ Standalone bundle synced (commit ${meta.gitCommit.slice(0, 7)} → ${paths.standalone.replace(ROOT, ".")})`
  );
}

main();
