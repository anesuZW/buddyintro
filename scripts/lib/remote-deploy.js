/**
 * Remote deployment command builders.
 * All node/npm/npx/prisma commands use withNodeEnvironment from resolve-server-node.js.
 */
const { withNodeEnvironment, remoteScript } = require("./resolve-server-node");
const { REQUIRED_SERVER_ENV, remoteEnvCheckScript } = require("./deploy-env");
const { buildCommand, verifyBuildCommand } = require("./build-integrity");

function shellQuote(path) {
  return path.includes(" ") ? `"${path}"` : path;
}

function repoExistsCommand(appPath) {
  const app = shellQuote(appPath.replace(/^~/, "$HOME"));
  return withNodeEnvironment(`test -d ${app}/.git && echo exists || echo missing`);
}

function cloneRepoCommand(appPath, repoUrl) {
  const app = shellQuote(appPath.replace(/^~/, "$HOME"));
  const url = shellQuote(repoUrl);
  return withNodeEnvironment(
    `mkdir -p $(dirname ${app}) && test -d ${app}/.git || git clone ${url} ${app}`
  );
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

function readPreviousSuccessfulShaCommand(appPath) {
  return remoteScript(appPath, ['cat .previous-successful-sha 2>/dev/null || echo ""']);
}

function writePreviousSuccessfulShaCommand(appPath, sha) {
  const safeSha = sha.replace(/[^a-zA-Z0-9]/g, "");
  return remoteScript(appPath, [`echo "${safeSha}" > .previous-successful-sha`]);
}

/** Full v3 rollback: checkout SHA → deps → prisma → build → restart */
function rollbackToShaCommand(appPath, sha) {
  const safeSha = sha.replace(/[^a-zA-Z0-9]/g, "");
  return remoteScript(appPath, [
    "git fetch origin",
    `git checkout ${safeSha}`,
    "npm ci --omit=dev",
    "npx prisma generate",
    "npm run build",
    'test -d .next && test -f .next/BUILD_ID && test -f build/version.json',
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
};
