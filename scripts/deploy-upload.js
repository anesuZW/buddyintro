#!/usr/bin/env node
/**
 * Upload + deploy latest local standalone package (v6).
 * Usage: npm run deploy:upload
 */
const { basename } = require("path");
const {
  DeployLogger,
  getDeployConfig,
  phasePreflight,
  phaseEnsureRemoteDirectories,
  phaseUpload,
  phaseServerDeploy,
  phaseHealthCheck,
  loadLatestPackage,
  verifySshReachable,
  resolveServerNode,
  logUsingServerNode,
  satisfiesMinVersion,
  sshExecCapture,
  writePreviousBackupCommand,
  formatDuration,
  appendDeploymentHistory,
  readPackageVersion,
  CommandError,
  collectDiagnostics,
  runAutoRollback,
  releaseDeployLockSafe,
} = require("./lib/deploy-pipeline");

async function main() {
  const logger = new DeployLogger();
  let config;
  let target;
  let deployId;
  let postUpload = false;

  console.log("\n=== BuddyIntro Deploy v6: Upload Latest Package ===\n");

  try {
    const pkg = loadLatestPackage();
    deployId = pkg.deployId || pkg.releaseId;
    config = getDeployConfig();
    const preflight = await phasePreflight(config, logger);
    target = preflight.target;

    verifySshReachable(config);
    phaseEnsureRemoteDirectories(config, logger);

    const nodeEnv = await resolveServerNode({ sshExecCapture, logger });
    logUsingServerNode(nodeEnv, (line) => console.log(line));

    const minVersion = config.nodeMinVersion.replace(/^>=/, "");
    if (!satisfiesMinVersion(nodeEnv.nodeVersion, minVersion)) {
      throw new Error(`Server Node ${nodeEnv.nodeVersion} below required ${config.nodeMinVersion}`);
    }

    await phaseUpload(config, { archivePath: pkg.archive, releaseId: deployId }, logger);
    postUpload = true;

    const serverResult = await phaseServerDeploy(config, deployId, basename(pkg.archive), logger);
    const { health, version } = await phaseHealthCheck(config, target.targetSha, logger, {
      sshExecCapture,
    });

    sshExecCapture(writePreviousBackupCommand(config.appPath, deployId, target.targetSha), logger);

    appendDeploymentHistory({
      timestamp: new Date().toISOString(),
      version: readPackageVersion(),
      branch: target.branch,
      sha: target.targetSha,
      runtimeSha: version.commit,
      deployId,
      backupArchive: serverResult.backupArchive,
      buildId: serverResult.buildId,
      duration: formatDuration(Date.now() - logger.startedAt),
      rollback: false,
      health: "PASS",
      deployMode: "cloudlinux-v6-upload",
    });

    logger.log(`\n✓ Upload deploy complete — ${deployId}`);
    logger.finalize("SUCCESS");
  } catch (err) {
    const msg = err instanceof CommandError ? err.format() : err.message;
    console.error(`\n✗ Upload deploy failed: ${msg}`);

    if (config) {
      try {
        collectDiagnostics({ sshExecCapture, appPath: config.appPath, logger, errorMessage: msg });
      } catch {
        /* ignore */
      }
    }

    if (postUpload && deployId && config) {
      await runAutoRollback(config, deployId, target?.targetSha, logger);
    }

    logger.finalize("FAILED");
    process.exit(1);
  } finally {
    if (config && postUpload) {
      releaseDeployLockSafe(config, logger);
    }
  }
}

main();
