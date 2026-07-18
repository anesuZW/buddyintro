#!/usr/bin/env node
/**
 * Rollback by restoring a timestamped backup archive (v6).
 * Usage: npm run deploy:rollback
 *        npm run deploy:rollback -- --backup=2026-07-17-0930
 */
const readline = require("readline");
const {
  DeployLogger,
  getDeployConfig,
  verifySshReachable,
  resolveServerNode,
  logUsingServerNode,
  sshExecCapture,
  readPreviousBackupCommand,
  restoreBackupCommand,
  phaseHealthCheck,
  CommandError,
  collectDiagnostics,
  readPackageVersion,
  printDeployComplete,
  formatDuration,
  appendDeploymentHistory,
} = require("./lib/deploy-pipeline");
const { sshExec } = require("./lib/ssh");
const { readHistory } = require("./lib/deploy-history");

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function selectBackup(previousBackupId, history) {
  const arg = process.argv.find((a) => a.startsWith("--backup="));
  if (arg) return arg.split("=")[1].trim();

  const legacy = process.argv.find((a) => a.startsWith("--release="));
  if (legacy) return legacy.split("=")[1].trim();

  if (process.argv.includes("--list")) {
    console.log("\nDeployment history (latest 10):\n");
    history.slice(0, 10).forEach((h, i) => {
      console.log(
        `  [${i + 1}] ${h.deployId || h.backupId || h.sha?.slice(0, 7)} v${h.version} ${h.backupArchive || ""} ${h.timestamp}`
      );
    });
    process.exit(0);
  }

  if (previousBackupId) {
    const answer = await prompt(`\nRestore backup ${previousBackupId}.tar.gz? [Y/n]: `);
    if (!answer || answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      return previousBackupId;
    }
  }

  throw new Error("No backup selected. Use --backup=<id> or ensure .previous-successful-backup exists.");
}

async function main() {
  const logger = new DeployLogger();
  const startedAt = Date.now();
  console.log("\n=== BuddyIntro Deploy v6: Restore Backup ===\n");

  let config;
  try {
    config = getDeployConfig();
    verifySshReachable(config);

    const nodeEnv = await resolveServerNode({ sshExecCapture, logger });
    logUsingServerNode(nodeEnv, (line) => console.log(line));

    const previousBackupId = sshExecCapture(readPreviousBackupCommand(config.appPath), logger).trim();
    const history = readHistory();
    const backupId = await selectBackup(previousBackupId, history);

    if (!/^\d{4}-\d{2}-\d{2}-\d{4}$/.test(backupId)) {
      throw new Error(`Invalid backup ID format: ${backupId} (expected YYYY-MM-DD-HHMM)`);
    }

    console.log(`\nRestoring backups/${backupId}.tar.gz…\n`);
    sshExec(restoreBackupCommand(config.appPath, backupId), `Restore backup ${backupId}`, logger);

    let targetSha = "";
    try {
      const manifestOut = sshExecCapture(
        require("./lib/resolve-server-node").remoteScript(config.appPath, [
          "cat build/version.json 2>/dev/null || echo '{}'",
        ]),
        logger
      );
      targetSha = JSON.parse(manifestOut).gitCommit || "";
    } catch {
      /* optional */
    }

    const { health, version } = await phaseHealthCheck(config, targetSha, logger, {
      sshExecCapture,
    });

    appendDeploymentHistory({
      timestamp: new Date().toISOString(),
      version: readPackageVersion(),
      branch: config.gitBranch,
      sha: version.commit,
      runtimeSha: version.commit,
      deployId: backupId,
      backupArchive: `${backupId}.tar.gz`,
      duration: formatDuration(Date.now() - startedAt),
      rollback: true,
      health: health.ok ? "PASS" : "FAIL",
      deployMode: "cloudlinux-v6-rollback",
    });

    printDeployComplete(logger, {
      branch: config.gitBranch,
      version: readPackageVersion(),
      targetSha: version.commit,
      githubSha: version.commit,
      serverSha: version.commit,
      runtimeSha: version.commit,
      buildOk: true,
      runtimeOk: true,
      healthStatus: `✓ ${health.status}`,
      rollbackStatus: `Manual backup restore SUCCESS (${backupId}.tar.gz)`,
      durationMs: Date.now() - startedAt,
      historyUpdated: true,
    });

    logger.finalize("ROLLBACK_SUCCESS");
    console.log(`\nRestored backup: ${backupId}.tar.gz\n`);
  } catch (err) {
    console.error("\n✗ ROLLBACK FAILED");
    const msg = err instanceof CommandError ? err.format() : err.message;
    console.error(`  ${msg}`);
    if (config) {
      try {
        collectDiagnostics({ sshExecCapture, appPath: config.appPath, logger, errorMessage: msg });
      } catch {
        /* ignore */
      }
    }
    logger.finalize("ROLLBACK_FAILED");
    process.exit(1);
  }
}

main();
