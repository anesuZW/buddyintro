/**
 * @deprecated Use git-integrity.js — kept for backward-compatible test imports.
 */
const gi = require("./git-integrity");

function resolveDeployTarget(config) {
  const target = gi.resolveTargetSha(config);
  return {
    mode: target.mode,
    branch: target.branch,
    commitSha: target.targetSha,
    resetRef: target.resetRef,
  };
}

function assertLocalHeadMatchesTarget(target, logger) {
  return gi.assertLocalPushed(
    { gitBranch: target.branch, deployCommitSha: target.mode === "commit" ? target.commitSha : null },
    { mode: target.mode, branch: target.branch, targetSha: target.commitSha },
    logger
  ).localSha;
}

function gitRevParseHeadCommand(appPath) {
  return gi.getServerShaCommand(appPath);
}

function gitResetToRefCommand(appPath, ref) {
  if (ref.startsWith("origin/")) {
    const branch = ref.replace("origin/", "");
    return gi.gitResetToOriginCommand(appPath, branch);
  }
  return gi.gitCheckoutShaCommand(appPath, ref);
}

module.exports = {
  ...gi,
  getLocalHeadSha: gi.getLocalSHA,
  getOriginBranchSha: gi.getOriginSHA,
  resolveDeployTarget,
  assertLocalHeadMatchesTarget,
  gitRevParseHeadCommand,
  gitResetToRefCommand,
  formatDeploySummary: gi.formatDeployComplete,
  printDeploySummary: gi.printDeployComplete,
};
