/**
 * Remote deployment command builders — CloudLinux app-root (v6).
 */
const cloudlinux = require("./deploy-cloudlinux");

function shellQuote(path) {
  return path.includes(" ") ? `"${path}"` : path;
}

/** @deprecated Git-based deploy removed */
function repoExistsCommand(deployRoot) {
  const { withNodeEnvironment } = require("./resolve-server-node");
  const root = shellQuote(deployRoot.replace(/^~/, "$HOME"));
  return withNodeEnvironment(`test -d ${root} && echo exists || echo missing`);
}

/** @deprecated */
function cloneRepoCommand() {
  throw new Error("Git clone deploy removed. Use standalone package upload.");
}

module.exports = {
  ...cloudlinux,
  repoExistsCommand,
  cloneRepoCommand,
  ensureRemoteDeployDirectoriesCommand: cloudlinux.ensureAppLayoutCommand,
  ensureDeployLayoutCommand: cloudlinux.ensureAppLayoutCommand,
  extractReleaseCommand: cloudlinux.extractPackageToStagingCommand,
  linkReleaseEnvCommand: () => {
    throw new Error("linkReleaseEnvCommand removed — .env lives at application root only");
  },
  prismaMigrateDeployCommand: (deployRoot) =>
    cloudlinux.serverActivateInStagingCommand(deployRoot, { runMigrations: true }),
  serverBuildPipelineCommand: (deployRoot, opts) =>
    cloudlinux.serverActivateInStagingCommand(deployRoot, opts),
  activateReleaseCommand: () => {
    throw new Error("activateReleaseCommand removed — deploy directly to application root");
  },
  restartPassengerCommand: cloudlinux.restartCloudLinuxAppCommand,
  rollbackToReleaseCommand: cloudlinux.restoreBackupCommand,
  verifyReleaseBuildCommand: cloudlinux.verifyAppBuildCommand,
  readPreviousReleaseCommand: cloudlinux.readPreviousBackupCommand,
  writePreviousReleaseCommand: cloudlinux.writePreviousBackupCommand,
  cleanOldReleasesCommand: cloudlinux.cleanOldBackupsCommand,
  readPreviousSuccessfulShaCommand: cloudlinux.readPreviousBackupCommand,
  writePreviousSuccessfulShaCommand: cloudlinux.writePreviousBackupCommand,
  rollbackToShaCommand: cloudlinux.restoreBackupCommand,
  verifyBuildCommand: cloudlinux.verifyAppBuildCommand,
};
