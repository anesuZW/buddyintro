/**
 * Deployment pipeline debug instrumentation.
 * Enabled when DEPLOY_DEBUG=1 or always during git integrity phase.
 */
const { existsSync, readFileSync } = require("fs");
const { resolve, join, normalize } = require("path");
const { runGitCapture, tryGitCapture } = require("./exec");

const LIB_DIR = __dirname;
const SCRIPTS_DIR = resolve(LIB_DIR, "..");
const ROOT_FROM_LIB = resolve(LIB_DIR, "../..");

function isEnabled() {
  return process.env.DEPLOY_DEBUG === "1" || process.env.DEPLOY_DEBUG === "true";
}

function debugLog(message) {
  if (!isEnabled()) return;
  console.log(`[DEPLOY DEBUG] ${message}`);
}

function resolveModulePath(relativePath) {
  try {
    return require.resolve(relativePath);
  } catch {
    return "(not found)";
  }
}

function listLoadedEnv(prefix) {
  const keys = Object.keys(process.env)
    .filter((k) => k.startsWith(prefix))
    .sort();
  for (const key of keys) {
    const raw = process.env[key] || "";
    const display =
      /KEY|SECRET|PASSWORD|TOKEN|SSH/i.test(key) && raw ? `${raw.slice(0, 4)}…` : raw || "(empty)";
    debugLog(`env ${key}=${display}`);
  }
}

function listEnvFiles(ROOT) {
  for (const file of [".env.local", ".env"]) {
    const p = join(ROOT, file);
    debugLog(`env file ${file}: ${existsSync(p) ? "present" : "missing"}`);
  }
}

function printGitSnapshot(ROOT, branch = "main") {
  debugLog(`process.cwd()=${process.cwd()}`);
  debugLog(`__dirname (deploy-debug)=${LIB_DIR}`);
  debugLog(`ROOT (paths module)=${ROOT}`);
  debugLog(`Node executable=${process.execPath}`);
  debugLog(`deploy.js resolved=${resolveModulePath(join(SCRIPTS_DIR, "deploy.js"))}`);
  debugLog(`git-integrity.js resolved=${resolveModulePath("./git-integrity")}`);
  debugLog(`deploy-config.js resolved=${resolveModulePath("./deploy-config")}`);
  debugLog(`exec.js resolved=${resolveModulePath("./exec")}`);

  const gitTop = tryGitCapture(["rev-parse", "--show-toplevel"]);
  debugLog(`git rev-parse --show-toplevel=${gitTop || "(failed)"}`);
  const repoMatch =
    gitTop && normalize(gitTop).toLowerCase() === normalize(ROOT).toLowerCase();
  debugLog(`repository match=${repoMatch ? "yes" : `NO — expected ${ROOT}, got ${gitTop}`}`);

  const remote = tryGitCapture(["remote", "get-url", "origin"]);
  debugLog(`git remote get-url origin=${remote || "(failed)"}`);

  const current = tryGitCapture(["branch", "--show-current"]);
  debugLog(`git branch --show-current=${current || "(detached or unknown)"}`);

  const head = tryGitCapture(["rev-parse", "HEAD"]);
  debugLog(`git rev-parse HEAD=${head || "(failed)"}`);

  const localBranch = tryGitCapture(["rev-parse", branch]);
  debugLog(`git rev-parse ${branch}=${localBranch || "(failed)"}`);

  const originBranch = tryGitCapture(["rev-parse", `origin/${branch}`]);
  debugLog(`git rev-parse origin/${branch}=${originBranch || "(failed)"}`);

  const status = tryGitCapture(["status", "--porcelain"]);
  debugLog(`git status --porcelain=${status ? status.replace(/\n/g, " | ") : "(clean)"}`);
}

function printDeployConfigSnapshot(config) {
  if (!config) return;
  debugLog(`DEPLOY_GIT_BRANCH (resolved)=${config.gitBranch}`);
  debugLog(`DEPLOY_COMMIT_SHA (resolved)=${config.deployCommitSha || "(unset)"}`);
  debugLog(`TARGET branch mode branch=${config.gitBranch}`);
  debugLog(`DEPLOY_GIT_REPO_URL=${config.gitRepoUrl || "(unset)"}`);
  debugLog(`GITHUB_REPOSITORY=${process.env.GITHUB_REPOSITORY || "(unset)"}`);
}

function printTargetSnapshot(target) {
  if (!target) return;
  debugLog(`TARGET_SHA=${target.targetSha}`);
  debugLog(`TARGET mode=${target.mode}`);
  debugLog(`TARGET branch=${target.branch}`);
  debugLog(`TARGET resetRef=${target.resetRef}`);
}

function logGitInvocation(args, cwd, stdout) {
  if (!isEnabled()) return;
  const parsed = (stdout || "").trim();
  debugLog(`git ${args.join(" ")}`);
  debugLog(`  cwd=${cwd}`);
  debugLog(`  stdout=${parsed || "(empty)"}`);
}

function printStartupDiagnostics(ROOT, config, target) {
  if (!isEnabled()) return;
  console.log("\n[DEPLOY DEBUG] === deployment pipeline diagnostics ===");
  listEnvFiles(ROOT);
  listLoadedEnv("DEPLOY_");
  printGitSnapshot(ROOT, config?.gitBranch || "main");
  printDeployConfigSnapshot(config);
  printTargetSnapshot(target);
  console.log("[DEPLOY DEBUG] === end diagnostics ===\n");
}

module.exports = {
  isEnabled,
  debugLog,
  printStartupDiagnostics,
  printGitSnapshot,
  logGitInvocation,
  ROOT_FROM_LIB,
};
