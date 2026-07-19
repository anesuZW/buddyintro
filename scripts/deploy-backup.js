#!/usr/bin/env node
/** Backup current remote release (tar.gz) without deploying. */
const { loadEnvFiles, getDeployConfig } = require("./lib/deploy-config");
const { createBackupId } = require("./lib/deploy-pipeline");
const { sshExec } = require("./lib/ssh");
const { writePreviousBackupCommand } = require("./lib/remote-deploy");

loadEnvFiles();

async function main() {
  const config = getDeployConfig();
  const backupId = createBackupId();
  console.log(`\n=== BuddyIntro Deploy Backup (${backupId}) ===\n`);
  const cmd = writePreviousBackupCommand(config.appPath, backupId);
  await sshExec(config, cmd);
  console.log(`\n✓ Remote backup created: backups/${backupId}.tar.gz\n`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
