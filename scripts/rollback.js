#!/usr/bin/env node
/**
 * Rollback production to .previous-successful-sha via SSH.
 *
 * Usage:
 *   npm run rollback
 *   npm run rollback -- --sha=abc123...
 *   npm run rollback -- --list
 */
const readline = require("readline");
const { readFileSync } = require("fs");
const { sshExec, verifySshReachable, sshExecCapture } = require("./lib/ssh");
const { resolveServerNode, logUsingServerNode } = require("./lib/resolve-server-node");
const { getDeployConfig } = require("./lib/deploy-config");
const { PACKAGE_JSON } = require("./lib/paths");
const { pollHealth, pollVersion } = require("./lib/health-poll");
const {
  rollbackToShaCommand,
  readPreviousSuccessfulShaCommand,
  writePreviousSuccessfulShaCommand,
} = require("./lib/remote-deploy");
const { DeployLogger } = require("./lib/deploy-logger");
const { CommandError } = require("./lib/exec");
const { readHistory } = require("./lib/deploy-history");
const { printDeployComplete, formatDuration, shasEqual } = require("./lib/git-integrity");
const { collectDiagnostics } = require("./lib/deploy-diagnostics");

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function readPackageVersion() {
  try {
    return JSON.parse(readFileSync(PACKAGE_JSON, "utf8")).version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function selectRollbackSha(serverSha, history) {
  const shaArg = process.argv.find((a) => a.startsWith("--sha="));
  if (shaArg) return shaArg.split("=")[1].trim();

  if (process.argv.includes("--list")) {
    console.log("\nDeployment history (latest 10):\n");
    history.slice(0, 10).forEach((h, i) => {
      console.log(`  [${i + 1}] ${h.sha?.slice(0, 7)} v${h.version} ${h.timestamp}`);
    });
    process.exit(0);
  }

  if (serverSha) {
    const answer = await prompt(
      `\nRollback to previous successful SHA ${serverSha.slice(0, 7)}? [Y/n]: `
    );
    if (!answer || answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
      return serverSha;
    }
  }

  throw new Error("No rollback SHA selected. Use --sha=<commit> or ensure .previous-successful-sha exists on server.");
}

async function main() {
  const logger = new DeployLogger();
  const startedAt = Date.now();
  console.log("\n=== BuddyIntro Rollback v3 ===\n");

  let config;
  try {
    config = getDeployConfig();
  } catch (err) {
    console.error(`✗ Configuration error: ${err.message}`);
    process.exit(1);
  }

  if (!config.healthUrl || !config.versionUrl) {
    console.error("✗ Set DEPLOY_HEALTH_URL or NEXT_PUBLIC_APP_URL");
    process.exit(1);
  }

  verifySshReachable(config);

  const nodeEnv = await resolveServerNode({ sshExecCapture, logger });
  logUsingServerNode(nodeEnv, (line) => console.log(line));
  console.log(`  Node ${nodeEnv.nodeVersion}, npm ${nodeEnv.npmVersion}`);

  const app = config.appPath;
  const previousSha = sshExecCapture(readPreviousSuccessfulShaCommand(app), logger).trim();
  const history = readHistory();
  const pkgVersion = readPackageVersion();

  let targetSha;
  try {
    targetSha = await selectRollbackSha(previousSha, history);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }

  if (!/^[0-9a-f]{7,40}$/i.test(targetSha)) {
    console.error(`✗ Invalid SHA: ${targetSha}`);
    process.exit(1);
  }

  console.log(`\nRolling back to ${targetSha} on ${config.host}…\n`);

  try {
    sshExec(rollbackToShaCommand(app, targetSha), `Rollback to ${targetSha}`, logger);
    console.log(`  ✓ Checked out ${targetSha}, rebuilt`);

    console.log(`  Waiting ${config.passengerWaitMs / 1000}s for Passenger…`);
    await new Promise((r) => setTimeout(r, config.passengerWaitMs));

    const health = await pollHealth(config.healthUrl, {
      maxMs: config.healthPollMaxMs,
      intervalMs: config.healthPollIntervalMs,
      onWait: (msg) => console.log(msg),
    });

    if (!health.ok) {
      throw new Error(health.error);
    }

    const version = await pollVersion(config.versionUrl, targetSha, {
      maxMs: 60_000,
      intervalMs: config.healthPollIntervalMs,
      onWait: (msg) => console.log(msg),
    });

    if (!version.ok) {
      throw new Error(version.error);
    }

    if (!shasEqual(version.commit, targetSha)) {
      throw new Error(`Runtime SHA mismatch after rollback: ${version.commit} ≠ ${targetSha}`);
    }

    sshExec(
      writePreviousSuccessfulShaCommand(app, targetSha),
      "Update .previous-successful-sha",
      logger
    );

    const durationMs = Date.now() - startedAt;

    printDeployComplete(logger, {
      branch: config.gitBranch,
      version: pkgVersion,
      targetSha,
      githubSha: targetSha,
      serverSha: targetSha,
      runtimeSha: version.commit,
      buildOk: true,
      runtimeOk: true,
      healthStatus: `✓ ${health.status}`,
      rollbackStatus: "Manual rollback SUCCESS",
      durationMs,
      historyUpdated: false,
    });

    logger.finalize("ROLLBACK_SUCCESS", { runtimeSha: version.commit });
    console.log(`\nActive SHA on server: ${targetSha}\n`);
  } catch (err) {
    console.error("\n✗ ROLLBACK FAILED");
    const msg = err instanceof CommandError ? err.format() : err.message;
    console.error(`  ${msg}`);

    try {
      collectDiagnostics({ sshExecCapture, appPath: app, logger, errorMessage: msg });
    } catch {
      /* ignore */
    }

    logger.finalize("ROLLBACK_FAILED");
    console.error("\n=== MANUAL INTERVENTION REQUIRED ===");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n✗ Unexpected rollback error:", err.message);
  process.exit(1);
});
