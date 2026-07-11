#!/usr/bin/env node
/**
 * Production-safe deployment to InterServer via SSH.
 *
 * GitHub origin/main is the source of truth.
 * Automatic rollback if deploy fails after git sync.
 *
 * Usage: npm run deploy
 */
const { DeployLogger } = require("./lib/deploy-logger");
const { getDeployConfig } = require("./lib/deploy-config");
const { assertLocalDeployEnv, assertServerEnvVarsPresent } = require("./lib/deploy-env");
const { sshExec, sshExecCapture, verifySshReachable } = require("./lib/ssh");
const { pollHealth } = require("./lib/health-poll");
const { satisfiesMinVersion } = require("./lib/node-version");
const { CommandError } = require("./lib/exec");
const {
  repoExistsCommand,
  cloneRepoCommand,
  capturePreviousRefCommand,
  syncToOriginCommand,
  verifyNodeVersionCommand,
  installDependenciesCommand,
  prismaGenerateCommand,
  prismaMigrateDeployCommand,
  restartPassengerCommand,
  rollbackToRefCommand,
  verifyServerEnvCommand,
} = require("./lib/remote-deploy");

async function runRollback(config, previousRef, logger) {
  if (!previousRef) {
    logger.log("No previous ref captured — cannot auto-rollback.");
    return false;
  }

  logger.log(`\n→ Automatic rollback to ${previousRef}…`);
  try {
    sshExec(rollbackToRefCommand(config.appPath, previousRef), `Rollback to ${previousRef}`, logger);
    const health = await pollHealth(config.healthUrl, {
      maxMs: config.healthPollMaxMs,
      intervalMs: config.healthPollIntervalMs,
      onWait: (err) => logger.log(`  … rollback health (${err})`),
    });
    if (health.ok) {
      logger.log("\n=== ROLLBACK SUCCESSFUL ===");
      logger.log(`Active ref: ${previousRef}`);
      logger.log(`Health: ${health.status}`);
      logger.finalize("ROLLBACK_SUCCESS");
      return true;
    }
  } catch (err) {
    logger.log(`Rollback error: ${err.message}`);
  }

  logger.log("\n=== MANUAL INTERVENTION REQUIRED ===");
  logger.finalize("ROLLBACK_FAILED");
  return false;
}

async function main() {
  const logger = new DeployLogger();
  let config;
  let previousRef = "";
  let syncedToOrigin = false;

  try {
    console.log("\n=== BuddyIntro Deploy v2 (InterServer) ===\n");

    assertLocalDeployEnv();
    assertServerEnvVarsPresent();
    config = getDeployConfig();

    if (!config.healthUrl) {
      throw new Error("Set DEPLOY_HEALTH_URL or NEXT_PUBLIC_APP_URL for post-deploy verification");
    }
    if (!config.gitRepoUrl) {
      throw new Error("Set DEPLOY_GIT_REPO_URL or ensure origin remote points to GitHub");
    }

    logger.log(`Host:     ${config.user}@${config.host}:${config.port}`);
    logger.log(`App:      ${config.appPath}`);
    logger.log(`Branch:   origin/${config.gitBranch}`);
    logger.log(`Health:   ${config.healthUrl}`);
    logger.log(`Auth:     SSH key only`);

    // STEP 1–2: SSH reachable
    verifySshReachable(config);
    logger.log("  ✓ SSH connection verified");

    const app = config.appPath;

    // STEP 3: Repository exists or clone
    const repoState = sshExecCapture(repoExistsCommand(app), logger);
    if (repoState === "missing") {
      logger.log("  → Repository missing — cloning…");
      sshExec(cloneRepoCommand(app, config.gitRepoUrl), "Clone repository", logger);
    } else {
      logger.log("  ✓ Repository exists");
    }

    // Capture previous ref before sync (for rollback)
    previousRef = sshExecCapture(capturePreviousRefCommand(app), logger);
    if (previousRef) logger.log(`  Previous ref: ${previousRef}`);

    // Verify server .env keys (never overwrite .env)
    sshExec(verifyServerEnvCommand(app), "Verify server environment", logger);
    logger.log("  ✓ Server .env contains required keys");

    // STEP 4: Sync to origin/main — never git pull
    sshExec(syncToOriginCommand(app, config.gitBranch), `Sync to origin/${config.gitBranch}`, logger);
    syncedToOrigin = true;
    logger.log(`  ✓ Synced to origin/${config.gitBranch}`);

    // STEP 5: Node version
    const nodeVersion = sshExecCapture(verifyNodeVersionCommand(app), logger);
    const minVersion = config.nodeMinVersion.replace(/^>=/, "");
    if (!satisfiesMinVersion(nodeVersion, minVersion)) {
      throw new Error(
        `Server Node.js ${nodeVersion} does not meet required ${config.nodeMinVersion}.\n` +
          "Upgrade Node on InterServer (cPanel → Setup Node.js App)."
      );
    }
    logger.log(`  ✓ Node ${nodeVersion}`);

    // STEP 6–9: Install, Prisma, migrate, restart
    sshExec(installDependenciesCommand(app), "npm ci --omit=dev", logger);
    logger.log("  ✓ Dependencies installed");

    sshExec(prismaGenerateCommand(app), "Prisma generate", logger);
    logger.log("  ✓ Prisma client generated");

    sshExec(prismaMigrateDeployCommand(app), "Prisma migrate deploy", logger);
    logger.log("  ✓ Migrations applied");

    sshExec(restartPassengerCommand(app), "Restart Passenger", logger);
    logger.log("  ✓ Passenger restart triggered");

    // STEP 10–11: Health poll (5s interval, 120s max)
    logger.log(`\n→ Polling ${config.healthUrl} (max ${config.healthPollMaxMs / 1000}s)…`);
    const health = await pollHealth(config.healthUrl, {
      maxMs: config.healthPollMaxMs,
      intervalMs: config.healthPollIntervalMs,
      onWait: (err) => console.log(`  … waiting (${err})`),
    });

    if (!health.ok) {
      throw new Error(health.error);
    }

    logger.log(`  ✓ /api/health → ${health.status}`);
    logger.finalize("SUCCESS");
    console.log("\n=== Deploy complete ===\n");
  } catch (err) {
    console.error("\n✗ DEPLOYMENT FAILED");
    if (err instanceof CommandError) console.error(err.format());
    else console.error(`  ${err.message}`);

    if (syncedToOrigin && previousRef) {
      const config2 = config || getDeployConfig();
      await runRollback(config2, previousRef, logger);
    } else {
      logger.finalize("FAILED");
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n✗ Unexpected deploy error:", err.message);
  process.exit(1);
});
