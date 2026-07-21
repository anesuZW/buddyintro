#!/usr/bin/env node
/**
 * Fail the build if .next/standalone manifests do not match git HEAD.
 */
const { verifyStandaloneManifestIntegrity } = require("./lib/standalone-sync");

function main() {
  const result = verifyStandaloneManifestIntegrity();
  console.log(
    `✓ Standalone manifest integrity OK (commit ${result.head.slice(0, 7)} in bundle)`
  );
}

main();
