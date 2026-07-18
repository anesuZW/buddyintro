#!/usr/bin/env node
/**
 * BuddyIntro Deployment Pipeline v6 — CloudLinux atomic app-root deploy.
 *
 * Local standalone build → staging extract → validate → tar backup → atomic sync.
 * Usage: npm run deploy
 */
const { basename } = require("path");
const {
  DeployLogger,
  getDeployConfig,
  phasePreflight,
  phaseLocalBuildAndPackage,
  phaseEnsureRemoteDirectories,
  phaseUpload,
  phaseServerDeploy,
  phaseHealthCheck,
  runAutoRollback,
  releaseDeployLockSafe,
  createBackupId,
  readPackageVersion,
  verifySshReachable,
  resolveServerNode,
  logUsingServerNode,
  satisfiesMinVersion,
  sshExecCapture,
  appendDeploymentHistory,
  collectDiagnostics,
  CommandError,
  fetchOrigin,
  getLocalSHA,
  getOriginSHA,
  verifyAllShas,
  printDeployComplete,
  formatDuration,
  writePreviousBackupCommand,
  cleanOldBackupsCommand,
} = require("./lib/deploy-pipeline");
const { sshExec } = require("./lib/ssh");

async function main() {
  const logger = new DeployLogger();
  let config;
  let target;
  let deployId;
  let postUpload = false;
  let serverResult;
  let rollbackStatus = "Not required";
  const pkgVersion = readPackageVersion();

  try {
    console.log("\n=== BuddyIntro Deploy v6 (CloudLinux Atomic) ===\n");

    config = getDeployConfig();
    if (!config.healthUrl) throw new Error("Set DEPLOY_HEALTH_URL or NEXT_PUBLIC_APP_URL");
    if (!config.versionUrl) throw new Error("Could not derive version URL from health URL");

    const preflight = await phasePreflight(config, logger);
    target = preflight.target;

    logger.setMetadata({
      "Deploy mode": "cloudlinux-v6",
      Branch: target.branch,
      "Target SHA": target.targetSha,
      "GitHub SHA": preflight.githubSha,
      "Local SHA": preflight.localSha,
      Version: pkgVersion,
      Migrations: config.runMigrations ? "enabled" : "skipped",
    });

    logger.log(`Host:     ${config.user}@${config.host}:${config.port}`);
    logger.log(`App root: ${config.appPath}`);
    logger.log(`Health:   ${config.healthUrl}`);
    logger.log(`Version:  ${config.versionUrl}`);

    deployId = createBackupId();
    logger.log(`\n→ Deploy ID: ${deployId}`);

    const pkg = await phaseLocalBuildAndPackage(logger, deployId);
    logger.log(`  ✓ Standalone package ready: ${pkg.archivePath} (${pkg.compressedHuman})`);

    verifySshReachable(config);
    logger.log("  ✓ SSH connection verified");

    phaseEnsureRemoteDirectories(config, logger);

    const nodeEnv = await resolveServerNode({ sshExecCapture, logger });
    logUsingServerNode(nodeEnv, (line) => logger.log(line));
    logger.log(`  Node ${nodeEnv.nodeVersion}, npm ${nodeEnv.npmVersion}`);

    const minVersion = config.nodeMinVersion.replace(/^>=/, "");
    if (!satisfiesMinVersion(nodeEnv.nodeVersion, minVersion)) {
      throw new Error(`Server Node.js ${nodeEnv.nodeVersion} does not meet ${config.nodeMinVersion}`);
    }

    await phaseUpload(config, pkg, logger);
    postUpload = true;
    logger.log("  ✓ Package uploaded to incoming/");

    serverResult = await phaseServerDeploy(config, deployId, basename(pkg.archivePath), logger);
    logger.log(`  ✓ Atomic deploy complete (BUILD_ID=${serverResult.buildId})`);

    const { health, version } = await phaseHealthCheck(config, target.targetSha, logger, {
      sshExecCapture,
    });
    logger.setMetadata({ "Health status": health.status, "Runtime SHA": version.commit });

    fetchOrigin(target.branch);
    verifyAllShas(
      {
        localSha: getLocalSHA(),
        githubSha: getOriginSHA(target.branch),
        serverSha: target.targetSha,
        runtimeSha: version.commit,
        targetSha: target.targetSha,
        mode: target.mode,
        branch: target.branch,
      },
      logger
    );

    sshExecCapture(writePreviousBackupCommand(config.appPath, deployId, target.targetSha), logger);
    logger.log(`  ✓ Saved successful deploy marker: ${deployId}.tar.gz`);

    try {
      sshExec(
        cleanOldBackupsCommand(config.appPath, config.keepBackups),
        `Clean old backups (keep ${config.keepBackups})`,
        logger
      );
    } catch (cleanErr) {
      logger.log(`  ! Backup cleanup skipped: ${cleanErr.message}`);
    }

    const durationMs = Date.now() - logger.startedAt;
    appendDeploymentHistory({
      timestamp: new Date().toISOString(),
      version: pkgVersion,
      branch: target.branch,
      sha: target.targetSha,
      runtimeSha: version.commit,
      deployId,
      backupArchive: serverResult.backupArchive,
      buildId: serverResult.buildId,
      duration: formatDuration(durationMs),
      rollback: false,
      health: "PASS",
      deployMode: "cloudlinux-v6",
    });

    printDeployComplete(logger, {
      branch: target.branch,
      version: pkgVersion,
      targetSha: target.targetSha,
      githubSha: getOriginSHA(target.branch),
      serverSha: target.targetSha,
      runtimeSha: version.commit,
      buildOk: true,
      runtimeOk: true,
      healthStatus: `✓ ${health.status}`,
      rollbackStatus,
      durationMs,
      historyUpdated: true,
    });

    logger.finalize("SUCCESS", { healthStatus: health.status, runtimeSha: version.commit, rollbackStatus });
  } catch (err) {
    const errorMessage = err instanceof CommandError ? err.format() : err.message;
    console.error("\n✗ DEPLOYMENT FAILED");
    console.error(`  ${errorMessage}`);
    logger.log(`\nFAILURE: ${errorMessage}`);

    if (config) {
      try {
        collectDiagnostics({ sshExecCapture, appPath: config.appPath, logger, errorMessage });
      } catch (diagErr) {
        logger.log(`Diagnostics collection error: ${diagErr.message}`);
      }
    }

    if (postUpload && deployId && config) {
      const rollback = await runAutoRollback(config, deployId, target?.targetSha, logger);
      rollbackStatus = rollback.rollbackStatus;
      logger.finalize(rollback.ok ? "ROLLBACK_SUCCESS" : "ROLLBACK_FAILED", { rollbackStatus });
    } else {
      rollbackStatus = postUpload ? "Not available" : "Not required (pre-upload failure)";
      logger.finalize("FAILED", { rollbackStatus });
    }

    process.exit(1);
  } finally {
    if (config && postUpload) {
      releaseDeployLockSafe(config, logger);
    }
  }
}

main().catch((err) => {
  console.error("\n✗ Unexpected deploy error:", err.message);
  process.exit(1);
});
