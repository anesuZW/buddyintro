/**
 * Load deployment configuration from environment.
 */
const { existsSync, readFileSync } = require("fs");
const { resolve, dirname, join } = require("path");
const { ROOT } = require("./paths");
const { tryGitCapture } = require("./exec");

function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    const p = resolve(ROOT, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFiles();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name} (set in .env or .env.local)`);
  }
  return value;
}

function detectGithubRepo() {
  const remote = tryGitCapture(["remote", "get-url", "origin"]);
  if (!remote) return null;
  const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

function resolveAppPath(appPath) {
  if (!appPath.startsWith("~")) return appPath;
  return appPath.replace(/^~/, "$HOME");
}

function getDeployConfig() {
  const sshKey = process.env.DEPLOY_SSH_KEY || process.env.SSH_KEY_PATH;
  if (!sshKey) {
    throw new Error("Missing DEPLOY_SSH_KEY (path to private SSH key — password auth is not supported)");
  }
  const keyPath = resolve(sshKey);
  if (!existsSync(keyPath)) {
    throw new Error(`SSH key not found: ${keyPath}`);
  }

  const healthUrl =
    process.env.DEPLOY_HEALTH_URL ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/health`
      : null);

  const githubRepo = process.env.GITHUB_REPOSITORY || detectGithubRepo();
  const gitBranch = process.env.DEPLOY_GIT_BRANCH || "main";
  const appPath = process.env.DEPLOY_APP_PATH || "~/buddyintro";
  const gitRepoUrl =
    process.env.DEPLOY_GIT_REPO_URL ||
    (githubRepo ? `https://github.com/${githubRepo}.git` : null);

  return {
    host: requireEnv("DEPLOY_SSH_HOST"),
    user: requireEnv("DEPLOY_SSH_USER"),
    port: Number(process.env.DEPLOY_SSH_PORT || 22),
    keyPath,
    appPath,
    appParentDir: dirname(resolveAppPath(appPath)),
    healthUrl,
    passengerWaitMs: Number(process.env.DEPLOY_PASSENGER_WAIT_MS || 15_000),
    healthPollIntervalMs: Number(process.env.DEPLOY_HEALTH_POLL_MS || 5_000),
    healthPollMaxMs: Number(process.env.DEPLOY_HEALTH_MAX_MS || 120_000),
    githubRepo,
    gitBranch,
    gitRepoUrl,
    nodeMinVersion: process.env.DEPLOY_NODE_MIN || ">=18.17.0",
  };
}

module.exports = { getDeployConfig, loadEnvFiles };
