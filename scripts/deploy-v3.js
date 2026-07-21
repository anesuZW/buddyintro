#!/usr/bin/env node
/**
 * BuddyIntro Deploy v3 — Blue/Green zero-downtime (PM2 + Ubuntu VPS).
 *
 * Layout:
 *   releases/YYYYMMDD-NNN/
 *   current -> symlink
 *
 * Usage: npm run deploy:v3
 */
const { existsSync, mkdirSync, cpSync, readFileSync } = require("fs");
const { join } = require("path");
const {
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
} = require("./lib/deploy-bluegreen");

async function main() {
  const started = Date.now();
  const config = getBlueGreenConfig();
  const releaseId = nextReleaseId(config.releasesDir);
  const releaseDir = join(config.releasesDir, releaseId);
  const previous = existsSync(config.currentLink) ? shCapture("readlink -f current || readlink current", config.appRoot) : null;

  console.log(`\n=== BuddyIntro Deploy v3 (Blue/Green) ===\n`);
  console.log(`App root:  ${config.appRoot}`);
  console.log(`Release:   ${releaseId}`);
  console.log(`Health:    ${config.healthUrl}\n`);

  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(config.logDir, { recursive: true });

  console.log("→ Sync source to release directory");
  sh(`git archive ${config.gitBranch} | tar -x -C ${JSON.stringify(releaseDir)}`, process.cwd());

  console.log("→ Link shared uploads and env");
  linkSharedPaths(releaseDir, config);

  console.log("→ npm ci");
  sh("npm ci", releaseDir);

  console.log("→ prisma migrate deploy");
  sh("npx prisma migrate deploy", releaseDir);

  console.log("→ Build");
  sh("npm run build", releaseDir);

  console.log("→ Verify build");
  smokeTest(releaseDir, config);

  const gitCommit = getGitCommit(releaseDir);
  const pkg = JSON.parse(readFileSync(join(releaseDir, "package.json"), "utf8"));
  writeReleaseManifest(releaseDir, {
    releaseId,
    version: pkg.version,
    gitCommit,
    gitBranch: config.gitBranch,
    deployedAt: new Date().toISOString(),
    deployMode: "blue-green-v3",
  });

  console.log("→ Switch current symlink");
  symlinkCurrent(config, releaseDir);

  console.log("→ PM2 graceful reload");
  if (existsSync(join(config.appRoot, "current", "ecosystem.config.js"))) {
    pm2Reload(config);
  } else {
    pm2Start(config);
  }

  console.log("→ Health check");
  const healthy = await pollHealthAsync(config.healthUrl);
  if (!healthy) {
    console.error("✗ Health check failed — rolling back");
    if (previous) {
      const prevId = previous.split("/").pop();
      rollbackToRelease(config, prevId);
      appendHistory(config, {
        releaseId,
        status: "rolled_back",
        gitCommit,
        at: new Date().toISOString(),
        reason: "health_check_failed",
        previous,
      });
    }
    process.exit(1);
  }

  console.log("→ Runtime version verification");
  sh("node scripts/verify-deployment.js", config.currentLink);

  appendHistory(config, {
    releaseId,
    status: "success",
    gitCommit,
    at: new Date().toISOString(),
    durationMs: Date.now() - started,
  });

  console.log(`\n✓ Deploy v3 complete (${releaseId}) in ${Math.round((Date.now() - started) / 1000)}s\n`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
