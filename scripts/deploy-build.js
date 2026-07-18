#!/usr/bin/env node
/**
 * Build standalone locally and package for CloudLinux v6 deployment (no upload).
 * Usage: npm run deploy:build
 */
const {
  DeployLogger,
  getDeployConfig,
  phasePreflight,
  phaseLocalBuildAndPackage,
  createBackupId,
} = require("./lib/deploy-pipeline");

async function main() {
  const logger = new DeployLogger();
  console.log("\n=== BuddyIntro Deploy: Local Build + Package ===\n");

  try {
    const config = getDeployConfig();
    await phasePreflight(config, logger);

    const deployId =
      process.argv.find((a) => a.startsWith("--deploy="))?.split("=")[1] ||
      process.argv.find((a) => a.startsWith("--release="))?.split("=")[1] ||
      createBackupId();

    const pkg = await phaseLocalBuildAndPackage(logger, deployId);

    logger.log(`\n✓ Standalone package ${deployId}`);
    logger.log(`  Archive: ${pkg.archivePath}`);
    logger.log(`  Size: ${pkg.compressedHuman} (uncompressed ${pkg.sizeHuman})`);
    logger.log(`  Commit: ${pkg.meta.gitCommit.slice(0, 7)}`);
    logger.finalize("BUILD_SUCCESS");
  } catch (err) {
    console.error(`\n✗ Build/package failed: ${err.message}`);
    logger.finalize("BUILD_FAILED");
    process.exit(1);
  }
}

main();
