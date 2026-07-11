/**
 * Remote deployment command builders and orchestration helpers.
 */
const { remoteScript, bashRemote } = require("./ssh");
const { REQUIRED_SERVER_ENV, remoteEnvCheckScript } = require("./deploy-env");

function shellQuote(path) {
  return path.includes(" ") ? `"${path}"` : path;
}

function repoExistsCommand(appPath) {
  const app = shellQuote(appPath.replace(/^~/, "$HOME"));
  return bashRemote(`test -d ${app}/.git && echo exists || echo missing`);
}

function cloneRepoCommand(appPath, repoUrl) {
  const app = shellQuote(appPath.replace(/^~/, "$HOME"));
  const url = shellQuote(repoUrl);
  return bashRemote(`mkdir -p $(dirname ${app}) && test -d ${app}/.git || git clone ${url} ${app}`);
}

function capturePreviousRefCommand(appPath) {
  return remoteScript(appPath, [
    'PREV=$(git describe --tags --exact-match 2>/dev/null || git describe --tags --abbrev=0 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo "")',
    'echo "$PREV"',
  ]);
}

function syncToOriginCommand(appPath, branch) {
  return remoteScript(appPath, [
    "git fetch origin",
    `git reset --hard origin/${branch}`,
    "git clean -fd",
  ]);
}

function verifyNodeVersionCommand(appPath) {
  return remoteScript(appPath, ["node -v"]);
}

function installDependenciesCommand(appPath) {
  return remoteScript(appPath, ["npm ci --omit=dev"]);
}

function prismaGenerateCommand(appPath) {
  return remoteScript(appPath, ["npx prisma generate"]);
}

function prismaMigrateDeployCommand(appPath) {
  return remoteScript(appPath, ["npx prisma migrate deploy"]);
}

function restartPassengerCommand(appPath) {
  return remoteScript(appPath, ["mkdir -p tmp", "touch tmp/restart.txt"]);
}

function rollbackToRefCommand(appPath, ref) {
  const safeRef = ref.replace(/[^a-zA-Z0-9._\-/]/g, "");
  return remoteScript(appPath, [
    "git fetch origin --tags",
    `git checkout ${safeRef}`,
    "npm ci --omit=dev",
    "npx prisma generate",
    "mkdir -p tmp",
    "touch tmp/restart.txt",
  ]);
}

function verifyServerEnvCommand(appPath) {
  return remoteScript(appPath, [remoteEnvCheckScript(REQUIRED_SERVER_ENV)]);
}

module.exports = {
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
};
