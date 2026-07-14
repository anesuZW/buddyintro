/**
 * Git integrity — single source of truth for deployment SHA alignment.
 * GitHub is authoritative; never deploy unpushed local code.
 */
const { runGitCapture } = require("./exec");
const { remoteScript } = require("./resolve-server-node");

function normalizeSha(sha) {
  return (sha || "").trim().toLowerCase();
}

function shasEqual(a, b) {
  const left = normalizeSha(a);
  const right = normalizeSha(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.startsWith(right) || right.startsWith(left);
}

function fetchOrigin(branch = "main") {
  runGitCapture(["fetch", "origin", branch]);
}

function getLocalSHA() {
  return runGitCapture(["rev-parse", "HEAD"]);
}

function getOriginSHA(branch = "main") {
  return runGitCapture(["rev-parse", `origin/${branch}`]);
}

/**
 * Resolve immutable TARGET_SHA for the entire deployment.
 * Never recalculate after this returns.
 */
function resolveTargetSha(config) {
  const branch = config.gitBranch || "main";
  const explicitCommit = (config.deployCommitSha || "").trim();

  if (explicitCommit) {
    if (!/^[0-9a-f]{7,40}$/i.test(explicitCommit)) {
      throw new Error(
        `Invalid DEPLOY_COMMIT_SHA: ${explicitCommit}\n` +
          "Use a 7–40 character hexadecimal git commit SHA."
      );
    }
    const targetSha = explicitCommit.toLowerCase();
    return {
      mode: "commit",
      branch,
      targetSha,
      resetRef: targetSha,
      syncCommand: "checkout",
    };
  }

  fetchOrigin(branch);
  const targetSha = getOriginSHA(branch);
  return {
    mode: "branch",
    branch,
    targetSha,
    resetRef: `origin/${branch}`,
    syncCommand: "reset",
  };
}

function formatLocalNotPushedError(localSha, githubSha, branch) {
  return [
    "Deployment aborted.",
    "Your local branch contains commits that have not been pushed.",
    "",
    "Local:",
    localSha,
    "GitHub:",
    githubSha,
    "",
    "Run",
    `git push origin ${branch}`,
    "and retry.",
  ].join("\n");
}

/**
 * Pre-deploy gate — must pass before any SSH connection.
 * Always runs git fetch origin first.
 */
function assertLocalPushed(config, target, logger) {
  fetchOrigin(target.branch);
  const localSha = getLocalSHA();
  const githubSha = getOriginSHA(target.branch);

  if (target.mode === "commit") {
    if (!shasEqual(localSha, target.targetSha)) {
      const msg = formatLocalNotPushedError(localSha, target.targetSha, target.branch);
      if (logger) logger.log(msg);
      throw new Error(msg);
    }
    if (logger) {
      logger.log(`SHA compare — Local HEAD: ${localSha} | DEPLOY_COMMIT_SHA: ${target.targetSha} → MATCH`);
    }
    return { localSha, githubSha };
  }

  if (!shasEqual(localSha, githubSha)) {
    const msg = formatLocalNotPushedError(localSha, githubSha, target.branch);
    if (logger) logger.log(msg);
    throw new Error(msg);
  }

  if (logger) {
    logger.log(`SHA compare — Local HEAD: ${localSha} | origin/${target.branch}: ${githubSha} → MATCH`);
  }
  return { localSha, githubSha };
}

function getServerShaCommand(appPath) {
  return remoteScript(appPath, ["git rev-parse HEAD"]);
}

function getServerSHA(sshExecCapture, appPath, logger) {
  return sshExecCapture(getServerShaCommand(appPath), logger).trim();
}

function assertServerSynced(targetSha, serverSha, logger) {
  if (!shasEqual(targetSha, serverSha)) {
    const msg = `Server not synced to TARGET_SHA.\nExpected: ${targetSha}\nServer HEAD: ${serverSha}`;
    if (logger) logger.log(`SHA compare — TARGET_SHA: ${targetSha} | Server HEAD: ${serverSha} → MISMATCH`);
    throw new Error(msg);
  }
  if (logger) {
    logger.log(`SHA compare — TARGET_SHA: ${targetSha} | Server HEAD: ${serverSha} → MATCH`);
  }
}

function verifyAllShas(
  { localSha, githubSha, serverSha, runtimeSha, targetSha, mode, branch },
  logger
) {
  const results = [];

  if (mode === "branch") {
    results.push(["Local HEAD", localSha, `origin/${branch}`, githubSha]);
    results.push(["Server HEAD", serverSha, `origin/${branch}`, githubSha]);
    results.push(["Local HEAD", localSha, "Server HEAD", serverSha]);
    results.push(["Runtime commit", runtimeSha, "TARGET_SHA", targetSha]);
    results.push(["Local HEAD", localSha, "TARGET_SHA", targetSha]);
  } else {
    results.push(["Local HEAD", localSha, "TARGET_SHA", targetSha]);
    results.push(["Server HEAD", serverSha, "TARGET_SHA", targetSha]);
    results.push(["Runtime commit", runtimeSha, "TARGET_SHA", targetSha]);
    results.push(["Local HEAD", localSha, "Server HEAD", serverSha]);
  }

  for (const [labelA, shaA, labelB, shaB] of results) {
    if (!shasEqual(shaA, shaB)) {
      if (logger) logger.log(`SHA compare — ${labelA}: ${shaA} | ${labelB}: ${shaB} → MISMATCH`);
      throw new Error(`SHA mismatch: ${labelA} (${shaA}) ≠ ${labelB} (${shaB})`);
    }
    if (logger) logger.log(`SHA compare — ${labelA}: ${shaA} | ${labelB}: ${shaB} → MATCH`);
  }

  return true;
}

function gitFetchOriginCommand(appPath) {
  return remoteScript(appPath, ["git fetch origin"]);
}

function gitRevParseOriginCommand(appPath, branch) {
  return remoteScript(appPath, [`git rev-parse origin/${branch}`]);
}

function gitResetToOriginCommand(appPath, branch) {
  return remoteScript(appPath, [`git reset --hard origin/${branch}`, "git clean -fd"]);
}

function gitSyncToOriginCommand(appPath, branch) {
  return remoteScript(appPath, [
    "git fetch origin",
    `git reset --hard origin/${branch}`,
    "git clean -fd",
  ]);
}

function gitCheckoutShaCommand(appPath, sha) {
  const safeSha = sha.replace(/[^a-zA-Z0-9]/g, "");
  return remoteScript(appPath, [
    "git fetch origin",
    `git checkout ${safeSha}`,
    "git clean -fd",
  ]);
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} seconds`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `${min}m ${rem}s` : `${min}m`;
}

function formatDeployComplete(summary) {
  const lines = [
    "=================================================",
    "BuddyIntro Deployment Complete",
    `Branch:             ${summary.branch}`,
    `Version:            ${summary.version}`,
    `Commit:             ${summary.targetSha}`,
    `GitHub:             ${summary.githubSha}`,
    `Server:             ${summary.serverSha}`,
    `Runtime:            ${summary.runtimeSha}`,
    "Git Integrity:      ✓ VERIFIED",
    `Build:              ${summary.buildOk ? "✓ VERIFIED" : "✗ FAILED"}`,
    `Runtime:            ${summary.runtimeOk ? "✓ VERIFIED" : "✗ FAILED"}`,
    `Health:             ${summary.healthStatus}`,
    `Rollback:           ${summary.rollbackStatus}`,
    `Duration:           ${formatDuration(summary.durationMs)}`,
    summary.historyUpdated ? "Deployment History Updated" : "",
    "=================================================",
    "",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

function printDeployComplete(logger, summary) {
  const text = formatDeployComplete(summary);
  for (const line of text.split("\n")) {
    logger.log(line);
  }
}

module.exports = {
  normalizeSha,
  shasEqual,
  fetchOrigin,
  getLocalSHA,
  getOriginSHA,
  resolveTargetSha,
  assertLocalPushed,
  getServerShaCommand,
  getServerSHA,
  assertServerSynced,
  verifyAllShas,
  formatLocalNotPushedError,
  gitFetchOriginCommand,
  gitRevParseOriginCommand,
  gitSyncToOriginCommand,
  gitResetToOriginCommand,
  gitCheckoutShaCommand,
  formatDuration,
  formatDeployComplete,
  printDeployComplete,
};
