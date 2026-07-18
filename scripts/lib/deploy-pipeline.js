/**
 * Shared deployment pipeline — CloudLinux v6 atomic app-root + local standalone build.
 */
const { readFileSync, existsSync } = require("fs");
const { DeployLogger } = require("./deploy-logger");
const { getDeployConfig } = require("./deploy-config");
const { assertLocalDeployEnv, assertServerEnvVarsPresent } = require("./deploy-env");
const { sshExec, sshExecCapture, verifySshReachable } = require("./ssh");
const { uploadPackage } = require("./artifact-upload");
const { resolveServerNode, logUsingServerNode } = require("./resolve-server-node");
const { pollPostDeployValidation, pollHealth, pollVersion } = require("./health-poll");
const { satisfiesMinVersion } = require("./node-version");
const { CommandError } = require("./exec");
const { ROOT, LATEST_PACKAGE_PATH, PACKAGE_JSON } = require("./paths");
const { createBackupId } = require("./deploy-metadata");
const { packageRelease, verifyLocalStandaloneBuild } = require("./deploy-package");
const { runLocalBuildPipeline, parseBuildVerifyOutput } = require("./build-integrity");
const {
  resolveTargetSha,
  assertLocalPushed,
  fetchOrigin,
  getLocalSHA,
  getOriginSHA,
  verifyAllShas,
  formatDuration,
  shasEqual,
  printDeployComplete,
} = require("./git-integrity");
const { printStartupDiagnostics } = require("./deploy-debug");
const {
  ensureAppLayoutCommand,
  verifyServerEnvCommand,
  removeLegacyReleaseLayoutCommand,
  acquireDeployLockCommand,
  releaseDeployLockCommand,
  extractPackageToStagingCommand,
  verifyStagingBuildCommand,
  serverActivateInStagingCommand,
  smokeTestStagingCommand,
  createBackupArchiveCommand,
  atomicSyncStagingToAppCommand,
  verifyAppBuildCommand,
  restartCloudLinuxAppCommand,
  restoreBackupCommand,
  readPreviousBackupCommand,
  writePreviousBackupCommand,
  cleanOldBackupsCommand,
} = require("./deploy-cloudlinux");
const { appendDeploymentHistory } = require("./deploy-history");
const { collectDiagnostics, collectPassengerAnomalyDiagnostics } = require("./deploy-diagnostics");

function readPackageVersion() {
  try {
    return JSON.parse(readFileSync(PACKAGE_JSON, "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function loadLatestPackage() {
  if (!existsSync(LATEST_PACKAGE_PATH)) {
    throw new Error("No packaged release found. Run `npm run deploy:build` first.");
  }
  return JSON.parse(readFileSync(LATEST_PACKAGE_PATH, "utf8"));
}

function logTiming(logger, label, ms) {
  logger.log(`  ⏱ ${label}: ${formatDuration(ms)}`);
  logger.write(`TIMING_${label.replace(/\s+/g, "_").toUpperCase()}: ${ms}ms`);
}

async function phasePreflight(config, logger) {
  assertLocalDeployEnv();
  assertServerEnvVarsPresent();

  const target = resolveTargetSha(config);
  printStartupDiagnostics(ROOT, config, target);
  const { localSha, githubSha } = assertLocalPushed(config, target, logger);

  return { target, localSha, githubSha };
}

async function phaseLocalBuildAndPackage(logger, deployId, { skipInstall = false, skipBuild = false } = {}) {
  const timings = {};

  if (!skipBuild) {
    const buildTimings = runLocalBuildPipeline(logger, { skipInstall });
    Object.assign(timings, buildTimings);
    logTiming(logger, "local_build", buildTimings.build);
    if (buildTimings.install) logTiming(logger, "local_install", buildTimings.install);
  } else {
    verifyLocalStandaloneBuild();
  }

  const packStarted = Date.now();
  const pkg = await packageRelease(deployId);
  timings.package = Date.now() - packStarted;
  logTiming(logger, "package", timings.package);

  logger.setMetadata({
    "Deploy ID": deployId,
    "Package size": pkg.sizeHuman,
    "Compressed size": pkg.compressedHuman,
    "Git commit": pkg.meta.gitCommit,
    "Git branch": pkg.meta.gitBranch,
    "Package type": "standalone",
    "Pipeline": "v6",
  });

  return { ...pkg, deployId, timings };
}

function phaseEnsureRemoteDirectories(config, logger) {
  sshExec(ensureAppLayoutCommand(config.appPath), "Ensure v6 application layout", logger);
  logger.log(`  ✓ Layout ready: incoming/, staging/, backups/, tmp/ (${config.appPath})`);
}

async function phaseUpload(config, pkg, logger) {
  const remoteIncoming = `${config.appPath}/incoming`;
  const uploadStarted = Date.now();
  const result = uploadPackage(pkg.archivePath, remoteIncoming, config, logger);
  logTiming(logger, "upload", Date.now() - uploadStarted);
  return result;
}

/**
 * v6 server deploy: staging extract → validate → activate → smoke → tar backup → atomic sync → restart.
 * Acquires deploy lock at start; caller must release via releaseDeployLockSafe in finally.
 */
async function phaseServerDeploy(config, deployId, archiveName, logger) {
  const root = config.appPath;
  const timings = {};
  let t0;

  sshExec(acquireDeployLockCommand(root, deployId), "Acquire deploy lock", logger);
  logger.log(`  ✓ Deploy lock acquired (tmp/deploy.lock)`);

  sshExec(ensureAppLayoutCommand(root), "Verify application layout", logger);
  sshExec(verifyServerEnvCommand(root), "Verify server environment", logger);
  sshExec(removeLegacyReleaseLayoutCommand(root), "Remove legacy release layout", logger);

  t0 = Date.now();
  sshExec(extractPackageToStagingCommand(root, archiveName), "Extract package to staging/", logger);
  timings.extract = Date.now() - t0;
  logTiming(logger, "extract_staging", timings.extract);

  const stagingVerify = sshExecCapture(verifyStagingBuildCommand(root), logger);
  const buildId = parseBuildVerifyOutput(stagingVerify.replace("STAGING_BUILD_OK", "").trim());
  logger.log(`  ✓ Staging build validated (BUILD_ID=${buildId})`);

  t0 = Date.now();
  sshExec(
    serverActivateInStagingCommand(root, { runMigrations: config.runMigrations }),
    "Activate in staging (deps → prisma generate → migrate)",
    logger
  );
  timings.activate = Date.now() - t0;
  logTiming(logger, "staging_activate", timings.activate);

  const smokeOut = sshExecCapture(smokeTestStagingCommand(root), logger);
  parseBuildVerifyOutput(smokeOut.replace("SMOKE_OK", "").trim());
  logger.log("  ✓ Staging smoke test passed");

  t0 = Date.now();
  sshExec(createBackupArchiveCommand(root, deployId), `Create backup archive (${deployId}.tar.gz)`, logger);
  timings.backup = Date.now() - t0;
  logTiming(logger, "backup_archive", timings.backup);
  logger.log(`  ✓ Pre-deploy backup: backups/${deployId}.tar.gz`);

  t0 = Date.now();
  sshExec(atomicSyncStagingToAppCommand(root), "Atomic sync staging → application root", logger);
  timings.sync = Date.now() - t0;
  logTiming(logger, "atomic_sync", timings.sync);
  logger.log("  ✓ Production tree updated (delay-updates rsync)");

  const finalVerify = sshExecCapture(verifyAppBuildCommand(root), logger);
  parseBuildVerifyOutput(finalVerify);

  t0 = Date.now();
  sshExec(restartCloudLinuxAppCommand(root), "Restart Passenger (touch + selector + wait)", logger);
  timings.restart = Date.now() - t0;
  logTiming(logger, "restart", timings.restart);

  return {
    buildId,
    timings,
    backupId: deployId,
    backupArchive: `${deployId}.tar.gz`,
  };
}

/** Release deploy lock — never throws (best-effort cleanup). */
function releaseDeployLockSafe(config, logger) {
  try {
    sshExec(releaseDeployLockCommand(config.appPath), "Release deploy lock", logger);
    logger.log("  ✓ Deploy lock released");
  } catch (err) {
    logger.log(`  ! Could not release deploy lock: ${err.message}`);
  }
}

async function phaseHealthCheck(config, targetSha, logger, { sshExecCapture: captureFn } = {}) {
  const onAnomaly = captureFn
    ? async (ctx) => {
        logger.log(`  ⚠ Health anomaly HTTP ${ctx.status} — inspecting Passenger…`);
        await collectPassengerAnomalyDiagnostics({
          sshExecCapture: captureFn,
          appPath: config.appPath,
          logger,
          context: ctx,
        });
      }
    : undefined;

  logger.log("  Polling /api/health and /api/version (Passenger warm-up tolerant)…");

  const validationStarted = Date.now();
  const result = await pollPostDeployValidation(config, targetSha, {
    healthMaxMs: config.healthPollMaxMs,
    versionMaxMs: config.versionPollMaxMs,
    intervalMs: config.healthPollIntervalMs,
    onWait: (msg) => logger.log(msg),
    onAnomaly,
  });
  logTiming(logger, "post_deploy_validation", Date.now() - validationStarted);

  if (!result.ok) {
    if (result.phase === "health") throw new Error(result.health.error);
    throw new Error(result.version.error);
  }

  const { health, version } = result;
  logger.log(`  ✓ /api/health → ${health.status} (${health.responseTimeMs}ms)`);
  if (health.validationIssues?.length) {
    logger.log(`  ! Health warnings: ${health.validationIssues.join("; ")}`);
  }
  logger.log(`  ✓ /api/version → commit ${version.commit}`);

  if (health.body?.database) logger.log(`  ✓ Database: ${health.body.database}`);
  if (health.body?.supabase) logger.log(`  ✓ Supabase: ${health.body.supabase}`);

  return { health, version };
}

async function runAutoRollback(config, backupId, targetSha, logger) {
  if (!backupId) {
    logger.log("No pre-deploy backup — cannot auto-rollback.");
    return { ok: false, rollbackStatus: "Not available (no backup id)" };
  }

  logger.log(`\n→ Automatic rollback — restoring backups/${backupId}.tar.gz…`);
  const rollbackStarted = Date.now();
  try {
    sshExec(restoreBackupCommand(config.appPath, backupId), `Restore backup ${backupId}`, logger);
    logTiming(logger, "rollback", Date.now() - rollbackStarted);

    const health = await pollHealth(config.healthUrl, {
      maxMs: config.healthPollMaxMs,
      intervalMs: config.healthPollIntervalMs,
      onWait: (msg) => logger.log(`  … rollback health\n${msg}`),
    });

    if (!health.ok) {
      return { ok: false, rollbackStatus: "FAILED (health after restore)" };
    }

    if (config.versionUrl && targetSha) {
      const version = await pollVersion(config.versionUrl, targetSha, {
        maxMs: config.versionPollMaxMs,
        intervalMs: config.healthPollIntervalMs,
        onWait: (msg) => logger.log(`  … rollback version\n${msg}`),
      });
      if (!version.ok) {
        return { ok: false, rollbackStatus: "FAILED (runtime SHA after restore)" };
      }
    }

    logger.log(`\n=== ROLLBACK SUCCESSFUL ===`);
    logger.log(`Restored backup: ${backupId}.tar.gz`);
    return { ok: true, rollbackStatus: `SUCCESS → ${backupId}.tar.gz` };
  } catch (err) {
    logger.log(`Rollback error: ${err.message}`);
    return { ok: false, rollbackStatus: `FAILED (${err.message})` };
  }
}

module.exports = {
  readPackageVersion,
  loadLatestPackage,
  phasePreflight,
  phaseLocalBuildAndPackage,
  phaseLocalSourcePackage: phaseLocalBuildAndPackage,
  phaseEnsureRemoteDirectories,
  phaseUpload,
  phaseServerDeploy,
  phaseHealthCheck,
  runAutoRollback,
  releaseDeployLockSafe,
  createBackupId,
  logTiming,
  DeployLogger,
  getDeployConfig,
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
  shasEqual,
  writePreviousBackupCommand,
  readPreviousBackupCommand,
  cleanOldBackupsCommand,
  restoreBackupCommand,
  restartCloudLinuxAppCommand,
  ROOT,
  writePreviousReleaseCommand: writePreviousBackupCommand,
  readPreviousReleaseCommand: readPreviousBackupCommand,
  cleanOldReleasesCommand: cleanOldBackupsCommand,
  createReleaseId: createBackupId,
};
