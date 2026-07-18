#!/usr/bin/env node

/**

 * Remove old server backups, keeping the last N.

 * Usage: npm run deploy:clean

 *        npm run deploy:clean -- --keep=5

 */

const { DeployLogger, getDeployConfig, verifySshReachable, cleanOldBackupsCommand } = require("./lib/deploy-pipeline");

const { sshExec } = require("./lib/ssh");



async function main() {

  const logger = new DeployLogger();

  const keepArg = process.argv.find((a) => a.startsWith("--keep="));

  const keep = keepArg

    ? Number(keepArg.split("=")[1])

    : Number(process.env.DEPLOY_KEEP_BACKUPS || process.env.DEPLOY_KEEP_RELEASES || 5);



  console.log(`\n=== BuddyIntro Deploy: Clean Backups (keep ${keep}) ===\n`);



  try {

    const config = getDeployConfig();

    verifySshReachable(config);

    sshExec(cleanOldBackupsCommand(config.appPath, keep), `Clean backups (keep ${keep})`, logger);

    logger.log(`\n✓ Old backups cleaned (kept last ${keep})`);

    logger.finalize("CLEAN_SUCCESS");

  } catch (err) {

    console.error(`\n✗ Clean failed: ${err.message}`);

    logger.finalize("CLEAN_FAILED");

    process.exit(1);

  }

}



main();


