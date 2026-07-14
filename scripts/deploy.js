#!/usr/bin/env node
/**
 * BuddyIntro Deployment Pipeline v3 — deterministic, self-validating production deploy.
 *
 * GitHub origin/main is the single source of truth.
 * Every deployment targets one immutable TARGET_SHA.
 * Automatic rollback to .previous-successful-sha on failure.
 *
 * Usage: npm run deploy
 */
const { readFileSync } = require("fs");
const { DeployLogger } = require("./lib/deploy-logger");
const { getDeployConfig } = require("./lib/deploy-config");
const { assertLocalDeployEnv, assertServerEnvVarsPresent } = require("./lib/deploy-env");
const { sshExec, sshExecCapture, verifySshReachable } = require("./lib/ssh");
const {
  resolveServerNode,
  logUsingServerNode,
} = require("./lib/resolve-server-node");
const { pollHealth, pollVersion } = require("./lib/health-poll");
const { satisfiesMinVersion } = require("./lib/node-version");
const { CommandError } = require("./lib/exec");
const { PACKAGE_JSON } = require("./lib/paths");
const {
  repoExistsCommand,
  cloneRepoCommand,
  installDependenciesCommand,
  prismaGenerateCommand,
  prismaMigrateDeployCommand,
  buildCommand,
  verifyBuildCommand,
  restartPassengerCommand,
  readPreviousSuccessfulShaCommand,
  writePreviousSuccessfulShaCommand,
  rollbackToShaCommand,
  verifyServerEnvCommand,
} = require("./lib/remote-deploy");
const { parseBuildVerifyOutput } = require("./lib/build-integrity");
const {
  resolveTargetSha,
  assertLocalPushed,
  getServerSHA,
  assertServerSynced,
  verifyAllShas,
  fetchOrigin,
  getLocalSHA,
  getOriginSHA,
  gitFetchOriginCommand,
  gitRevParseOriginCommand,
  gitResetToOriginCommand,
  gitCheckoutShaCommand,
  printDeployComplete,
  formatDuration,
  shasEqual,
} = require("./lib/git-integrity");
const { collectDiagnostics } = require("./lib/deploy-diagnostics");
const { appendDeploymentHistory } = require("./lib/deploy-history");

function readPackageVersion() {
  try {
    return JSON.parse(readFileSync(PACKAGE_JSON, "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function runRollback(config, previousSha, targetSha, logger) {
  if (!previousSha) {
    logger.log("No .previous-successful-sha — cannot auto-rollback.");
    return { ok: false, rollbackStatus: "Not available (no previous SHA)" };
  }

  logger.log(`\n→ Automatic rollback to ${previousSha}…`);
  try {
    sshExec(rollbackToShaCommand(config.appPath, previousSha), `Rollback to ${previousSha}`, logger);

    logger.log(`  Waiting ${config.passengerWaitMs / 1000}s for Passenger…`);
    await new Promise((r) => setTimeout(r, config.passengerWaitMs));

    const health = await pollHealth(config.healthUrl, {
      maxMs: config.healthPollMaxMs,
      intervalMs: config.healthPollIntervalMs,
      onWait: (msg) => logger.log(`  … rollback health\n${msg}`),
    });

    if (!health.ok) {
      logger.log(`Rollback health failed: ${health.error}`);
      return { ok: false, rollbackStatus: "FAILED (health)" };
    }

    if (config.versionUrl) {
      const version = await pollVersion(config.versionUrl, previousSha, {
        maxMs: 60_000,
        intervalMs: config.healthPollIntervalMs,
        onWait: (msg) => logger.log(`  … rollback version\n${msg}`),
      });
      if (!version.ok) {
        logger.log(`Rollback version verification failed: ${version.error}`);
        return { ok: false, rollbackStatus: "FAILED (runtime SHA)" };
      }
    }

    logger.log("\n=== ROLLBACK SUCCESSFUL ===");
    logger.log(`Active SHA: ${previousSha}`);
    logger.log(`Health: ${health.status}`);
    return { ok: true, rollbackStatus: `SUCCESS → ${previousSha}` };
  } catch (err) {
    logger.log(`Rollback error: ${err.message}`);
    return { ok: false, rollbackStatus: `FAILED (${err.message})` };
  }
}

async function main() {
  const logger = new DeployLogger();
  let config;
  let target;
  let previousSuccessfulSha = "";
  let postSync = false;
  let rollbackStatus = "Not required";
  const pkgVersion = readPackageVersion();

  try {
    console.log("\n=== BuddyIntro Deploy v3 (Enterprise) ===\n");

    assertLocalDeployEnv();
    assertServerEnvVarsPresent();
    config = getDeployConfig();

    if (!config.healthUrl) {
      throw new Error("Set DEPLOY_HEALTH_URL or NEXT_PUBLIC_APP_URL for post-deploy verification");
    }
    if (!config.versionUrl) {
      throw new Error("Could not derive version URL from DEPLOY_HEALTH_URL");
    }
    if (!config.gitRepoUrl) {
      throw new Error("Set DEPLOY_GIT_REPO_URL or ensure origin remote points to GitHub");
    }

    // PHASE 1 — Git integrity (before SSH)
    target = resolveTargetSha(config);
    const { localSha, githubSha } = assertLocalPushed(config, target, logger);

    logger.setMetadata({
      "Deploy mode": target.mode === "commit" ? "pinned commit" : "origin/main",
      Branch: target.branch,
      "Target SHA": target.targetSha,
      "GitHub SHA": githubSha,
      "Local SHA": localSha,
      Version: pkgVersion,
    });

    logger.log(`Host:     ${config.user}@${config.host}:${config.port}`);
    logger.log(`App:      ${config.appPath}`);
    logger.log(`Health:   ${config.healthUrl}`);
    logger.log(`Version:  ${config.versionUrl}`);

    // SSH + Node resolution
    verifySshReachable(config);
    logger.log("  ✓ SSH connection verified");

    const nodeEnv = await resolveServerNode({ sshExecCapture, logger });
    logUsingServerNode(nodeEnv, (line) => logger.log(line));
    logger.log(`  Node ${nodeEnv.nodeVersion}, npm ${nodeEnv.npmVersion}`);
    logger.setMetadata({
      "Node version": nodeEnv.nodeVersion,
      "npm version": nodeEnv.npmVersion,
    });

    const minVersion = config.nodeMinVersion.replace(/^>=/, "");
    if (!satisfiesMinVersion(nodeEnv.nodeVersion, minVersion)) {
      throw new Error(
        `Server Node.js ${nodeEnv.nodeVersion} does not meet required ${config.nodeMinVersion}.\n` +
          "Upgrade Node on InterServer (cPanel → Setup Node.js App)."
      );
    }

    const app = config.appPath;

    // Repository setup
    const repoState = sshExecCapture(repoExistsCommand(app), logger);
    if (repoState === "missing") {
      logger.log("  → Repository missing — cloning…");
      sshExec(cloneRepoCommand(app, config.gitRepoUrl), "Clone repository", logger);
    } else {
      logger.log("  ✓ Repository exists");
    }

    previousSuccessfulSha = sshExecCapture(readPreviousSuccessfulShaCommand(app), logger).trim();
    if (previousSuccessfulSha) {
      logger.log(`  Previous successful SHA: ${previousSuccessfulSha}`);
    }

    sshExec(verifyServerEnvCommand(app), "Verify server environment", logger);
    logger.log("  ✓ Server .env contains required keys");

    // Server sync — never git pull
    sshExec(gitFetchOriginCommand(app), "git fetch origin", logger);

    const remoteOriginSha = sshExecCapture(
      gitRevParseOriginCommand(app, target.branch),
      logger
    );
    logger.log(`origin/${target.branch} SHA (after fetch): ${remoteOriginSha}`);

    if (target.mode === "branch") {
      if (!shasEqual(remoteOriginSha, target.targetSha)) {
        throw new Error(
          `GitHub origin/${target.branch} (${remoteOriginSha}) drifted from TARGET_SHA (${target.targetSha}).\n` +
            "Re-run deploy to pick up the latest pushed commit."
        );
      }
      sshExec(
        gitResetToOriginCommand(app, target.branch),
        `git reset --hard origin/${target.branch}`,
        logger
      );
    } else {
      sshExec(gitCheckoutShaCommand(app, target.targetSha), `git checkout ${target.targetSha}`, logger);
    }

    const serverSha = getServerSHA(sshExecCapture, app, logger);
    logger.log(`Server HEAD SHA (after sync): ${serverSha}`);
    assertServerSynced(target.targetSha, serverSha, logger);
    logger.setMetadata({ "Server SHA": serverSha });
    postSync = true;

    // PHASE 2 — Build integrity
    sshExec(installDependenciesCommand(app), "npm ci --omit=dev", logger);
    logger.log("  ✓ Dependencies installed");

    sshExec(prismaGenerateCommand(app), "Prisma generate", logger);
    logger.log("  ✓ Prisma client generated");

    sshExec(prismaMigrateDeployCommand(app), "Prisma migrate deploy", logger);
    logger.log("  ✓ Migrations applied");
    logger.setMetadata({ "Prisma migrations": "applied" });

    sshExec(buildCommand(app), "npm run build", logger);
    logger.log("  ✓ Build completed");

    const buildVerifyOut = sshExecCapture(verifyBuildCommand(app), logger);
    const buildId = parseBuildVerifyOutput(buildVerifyOut);
    logger.log(`  ✓ Build verified (.next/BUILD_ID=${buildId})`);
    logger.setMetadata({ "Next.js BUILD_ID": buildId });

    // PHASE 3 — Passenger restart (only after successful build)
    sshExec(restartPassengerCommand(app), "Restart Passenger", logger);
    logger.log("  ✓ Passenger restart triggered");
    logger.log(`  Waiting ${config.passengerWaitMs / 1000}s before health poll…`);
    await new Promise((r) => setTimeout(r, config.passengerWaitMs));

    // Health verification
    logger.log(`\n→ Polling ${config.healthUrl} (max ${config.healthPollMaxMs / 1000}s)…`);
    const health = await pollHealth(config.healthUrl, {
      maxMs: config.healthPollMaxMs,
      intervalMs: config.healthPollIntervalMs,
      onWait: (msg) => logger.log(msg),
    });

    if (!health.ok) {
      throw new Error(health.error);
    }
    logger.log(`  ✓ /api/health → ${health.status}`);
    logger.setMetadata({ "Health status": health.status });

    // PHASE 4 — Runtime verification
    logger.log(`\n→ Verifying runtime commit at ${config.versionUrl}…`);
    const version = await pollVersion(config.versionUrl, target.targetSha, {
      maxMs: 60_000,
      intervalMs: config.healthPollIntervalMs,
      onWait: (msg) => logger.log(msg),
    });

    if (!version.ok) {
      throw new Error(version.error);
    }

    const runtimeSha = version.commit;
    logger.log(`  ✓ Runtime commit verified: ${runtimeSha}`);
    logger.setMetadata({ "Runtime SHA": runtimeSha });

    // Final SHA verification
    fetchOrigin(target.branch);
    const finalLocal = getLocalSHA();
    const finalGithub = getOriginSHA(target.branch);
    const finalServer = getServerSHA(sshExecCapture, app, logger);

    verifyAllShas(
      {
        localSha: finalLocal,
        githubSha: finalGithub,
        serverSha: finalServer,
        runtimeSha,
        targetSha: target.targetSha,
        mode: target.mode,
        branch: target.branch,
      },
      logger
    );

    // PHASE 5 — Store previous successful SHA only after full success
    sshExec(
      writePreviousSuccessfulShaCommand(app, target.targetSha),
      "Write .previous-successful-sha",
      logger
    );
    logger.log(`  ✓ Saved .previous-successful-sha = ${target.targetSha}`);

    const durationMs = Date.now() - logger.startedAt;

    // PHASE 8 — Deployment history
    appendDeploymentHistory({
      timestamp: new Date().toISOString(),
      version: pkgVersion,
      branch: target.branch,
      sha: target.targetSha,
      duration: formatDuration(durationMs),
      rollback: false,
      health: "PASS",
      deployMode: target.mode,
    });

    printDeployComplete(logger, {
      branch: target.branch,
      version: pkgVersion,
      targetSha: target.targetSha,
      githubSha: finalGithub,
      serverSha: finalServer,
      runtimeSha,
      buildOk: true,
      runtimeOk: true,
      healthStatus: `✓ ${health.status}`,
      rollbackStatus,
      durationMs,
      historyUpdated: true,
    });

    logger.finalize("SUCCESS", {
      healthStatus: health.status,
      runtimeSha,
      rollbackStatus,
    });
  } catch (err) {
    const errorMessage = err instanceof CommandError ? err.format() : err.message;
    console.error("\n✗ DEPLOYMENT FAILED");
    console.error(`  ${errorMessage}`);
    logger.log(`\nFAILURE: ${errorMessage}`);

    if (config) {
      try {
        collectDiagnostics({
          sshExecCapture,
          appPath: config.appPath,
          logger,
          errorMessage,
        });
      } catch (diagErr) {
        logger.log(`Diagnostics collection error: ${diagErr.message}`);
      }
    }

    if (postSync && previousSuccessfulSha && config) {
      const rollback = await runRollback(config, previousSuccessfulSha, target?.targetSha, logger);
      rollbackStatus = rollback.rollbackStatus;
      logger.finalize(rollback.ok ? "ROLLBACK_SUCCESS" : "ROLLBACK_FAILED", { rollbackStatus });
    } else {
      rollbackStatus = postSync ? "Not available" : "Not required (pre-sync failure)";
      logger.finalize("FAILED", { rollbackStatus });
    }

    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n✗ Unexpected deploy error:", err.message);
  process.exit(1);
});
