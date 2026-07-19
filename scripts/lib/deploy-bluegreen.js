/**
 * Blue/green deployment helpers for PM2 + Ubuntu VPS.
 * Layout:
 *   {appRoot}/releases/YYYYMMDD-NNN/
 *   {appRoot}/current -> releases/...
 *   {appRoot}/shared/uploads
 *   {appRoot}/shared/.env
 */
const { execSync } = require("child_process");
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } = require("fs");
const { join, resolve } = require("path");
const { createSharedLink } = require("./platform-links");

function loadEnvFiles(root) {
  for (const file of [".env.local", ".env"]) {
    const p = join(root, file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function getBlueGreenConfig() {
  loadEnvFiles(process.cwd());
  const appRoot = resolve(process.env.DEPLOY_APP_PATH || process.env.APP_ROOT || "~/buddyintro");
  const healthUrl =
    process.env.DEPLOY_HEALTH_URL ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/health`
      : null);
  if (!healthUrl) throw new Error("Set DEPLOY_HEALTH_URL or NEXT_PUBLIC_APP_URL");

  return {
    appRoot,
    releasesDir: join(appRoot, "releases"),
    currentLink: join(appRoot, "current"),
    sharedDir: join(appRoot, "shared"),
    sharedEnv: join(appRoot, "shared", ".env"),
    sharedUploads: join(appRoot, "shared", "uploads"),
    healthUrl,
    gitBranch: process.env.DEPLOY_GIT_BRANCH || "main",
    gitRepo: process.env.DEPLOY_GIT_REPO_URL,
    pm2Config: join(appRoot, "current", "ecosystem.config.js"),
    historyFile: join(appRoot, "shared", "deployment-history.json"),
    logDir: join(appRoot, "shared", "logs"),
  };
}

function nextReleaseId(releasesDir) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  mkdirSync(releasesDir, { recursive: true });
  const existing = readdirSync(releasesDir).filter((d) => d.startsWith(stamp));
  const seq = String(existing.length + 1).padStart(3, "0");
  return `${stamp}-${seq}`;
}

function sh(cmd, cwd) {
  execSync(cmd, { stdio: "inherit", cwd, shell: true, env: process.env });
}

function shCapture(cmd, cwd) {
  return execSync(cmd, { cwd, shell: true, encoding: "utf8" }).trim();
}

function appendHistory(config, entry) {
  mkdirSync(config.sharedDir, { recursive: true });
  let history = [];
  if (existsSync(config.historyFile)) {
    try {
      history = JSON.parse(readFileSync(config.historyFile, "utf8"));
    } catch {
      history = [];
    }
  }
  history.unshift(entry);
  writeFileSync(config.historyFile, JSON.stringify(history.slice(0, 100), null, 2));
}

function writeReleaseManifest(releaseDir, meta) {
  writeFileSync(join(releaseDir, "deployment", "manifest.json"), JSON.stringify(meta, null, 2));
}

function symlinkCurrent(config, releaseDir) {
  createSharedLink(releaseDir, config.currentLink, { type: "dir" });
}

function linkSharedPaths(releaseDir, config) {
  mkdirSync(config.sharedUploads, { recursive: true });
  mkdirSync(config.sharedDir, { recursive: true });
  const uploadsLink = join(releaseDir, "uploads");
  createSharedLink(config.sharedUploads, uploadsLink, {
    type: "dir",
    protectPaths: [config.sharedUploads],
  });
  if (existsSync(config.sharedEnv)) {
    const envLink = join(releaseDir, ".env");
    createSharedLink(config.sharedEnv, envLink, {
      type: "file",
      protectPaths: [config.sharedUploads],
    });
  }
}

function smokeTest(releaseDir, config) {
  sh("node -e \"require('fs').accessSync('.next/BUILD_ID')\"", releaseDir);
  if (existsSync(join(releaseDir, "scripts", "verify.js"))) {
    sh("node scripts/verify.js", releaseDir);
  }
}

function pollHealth(healthUrl, maxMs = 120000, pollMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = fetch(healthUrl, { cache: "no-store" });
      return Promise.resolve(res).then((r) => {
        if (r.ok) return true;
        throw new Error(`HTTP ${r.status}`);
      });
    } catch {
      /* retry below */
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pollMs);
  }
  return Promise.resolve(false);
}

async function pollHealthAsync(healthUrl, maxMs = 120000, pollMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(healthUrl, { cache: "no-store" });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return false;
}

function pm2Reload(config) {
  sh("pm2 reload ecosystem.config.js --update-env", config.currentLink);
}

function pm2Start(config) {
  sh("pm2 start ecosystem.config.js", config.currentLink);
}

function getGitCommit(cwd) {
  try {
    return shCapture("git rev-parse HEAD", cwd);
  } catch {
    return "unknown";
  }
}

function rollbackToRelease(config, releaseId) {
  const target = join(config.releasesDir, releaseId);
  if (!existsSync(target)) throw new Error(`Release not found: ${releaseId}`);
  symlinkCurrent(config, target);
  pm2Reload(config);
}

module.exports = {
  getBlueGreenConfig,
  nextReleaseId,
  sh,
  shCapture,
  appendHistory,
  writeReleaseManifest,
  symlinkCurrent,
  linkSharedPaths,
  smokeTest,
  pollHealthAsync,
  pm2Reload,
  pm2Start,
  getGitCommit,
  rollbackToRelease,
};
