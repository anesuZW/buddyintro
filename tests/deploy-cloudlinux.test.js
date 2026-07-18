/**
 * CloudLinux direct app-root deployment command tests (v6).
 */
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  ensureAppLayoutCommand,
  createBackupArchiveCommand,
  extractPackageToStagingCommand,
  verifyStagingBuildCommand,
  serverActivateInStagingCommand,
  smokeTestStagingCommand,
  atomicSyncStagingToAppCommand,
  acquireDeployLockCommand,
  releaseDeployLockCommand,
  restartCloudLinuxAppCommand,
  restoreBackupCommand,
  verifyAppBuildCommand,
  removeLegacyReleaseLayoutCommand,
  PRESERVE_PATHS,
  RSYNC_WARNING_EXIT_CODES,
  rsyncWithTolerantExit,
  tarExcludeFlags,
} = require("../scripts/lib/deploy-cloudlinux");
const { setRemoteNodeCache, resetRemoteNodeCache } = require("../scripts/lib/resolve-server-node");
const {
  describeHttpStatus,
  validatePostDeployHealth,
  STARTUP_ANOMALY_STATUSES,
} = require("../scripts/lib/health-poll");

const BIN = "/opt/alt/alt-nodejs20/root/usr/bin";

describe("deploy-cloudlinux.js v6", () => {
  beforeEach(() => setRemoteNodeCache(BIN));
  afterEach(() => resetRemoteNodeCache());

  it("ensureAppLayoutCommand creates incoming staging backups tmp", () => {
    const cmd = ensureAppLayoutCommand("/home/socialit/repositories/buddyintro.com");
    assert.match(cmd, /mkdir -p .*\/incoming/);
    assert.match(cmd, /mkdir -p .*\/staging/);
    assert.match(cmd, /mkdir -p .*\/backups/);
    assert.match(cmd, /mkdir -p .*\/tmp/);
    assert.doesNotMatch(cmd, /releases/);
  });

  it("createBackupArchiveCommand uses tar.gz not rsync", () => {
    const cmd = createBackupArchiveCommand("/app", "2026-07-17-0930");
    assert.match(cmd, /backups\/2026-07-17-0930\.tar\.gz/);
    assert.match(cmd, /tar .*-czf/);
    assert.match(cmd, /exclude=backups/);
    assert.match(cmd, /exclude=incoming/);
    assert.match(cmd, /exclude=staging/);
    assert.doesNotMatch(cmd, /rsync -a.*backups\//);
  });

  it("extractPackageToStagingCommand extracts to staging not app root", () => {
    const cmd = extractPackageToStagingCommand("/app", "2026-07-17-0930.tar.gz");
    assert.match(cmd, /incoming\/2026-07-17-0930\.tar\.gz/);
    assert.match(cmd, /-C .*\/staging/);
    assert.doesNotMatch(cmd, /rsync -a --delete.*\/app\//);
  });

  it("verifyStagingBuildCommand checks all required artifacts", () => {
    const cmd = verifyStagingBuildCommand("/app");
    assert.match(cmd, /cd staging/);
    assert.match(cmd, /test -f server\.js/);
    assert.match(cmd, /test -f package\.json/);
    assert.match(cmd, /test -f \.next\/BUILD_ID/);
    assert.match(cmd, /test -d \.next\/static/);
    assert.match(cmd, /test -d public/);
    assert.doesNotMatch(cmd, /npm run build/);
  });

  it("serverActivateInStagingCommand runs in staging without build", () => {
    const cmd = serverActivateInStagingCommand("/app", { runMigrations: true });
    assert.match(cmd, /cd staging/);
    assert.match(cmd, /npm install --omit=dev/);
    assert.match(cmd, /npx prisma generate/);
    assert.match(cmd, /npx prisma migrate deploy/);
    assert.doesNotMatch(cmd, /npm run build/);
  });

  it("atomicSyncStagingToAppCommand uses delay-updates and tolerant rsync exit", () => {
    const cmd = atomicSyncStagingToAppCommand("/app");
    assert.match(cmd, /rsync -a --delete --delay-updates --delete-delay --partial --checksum/);
    assert.match(cmd, /staging\//);
    assert.match(cmd, /RSYNC_WARN/);
    assert.match(cmd, /RSYNC_RC -eq 24/);
    assert.match(cmd, /exclude=incoming/);
    assert.match(cmd, /exclude=backups/);
  });

  it("rsyncWithTolerantExit treats 23 and 24 as warnings", () => {
    const cmd = rsyncWithTolerantExit("rsync -a src/ dest/");
    assert.match(cmd, /RSYNC_RC -eq 23/);
    assert.match(cmd, /RSYNC_RC -eq 24/);
    assert.match(cmd, /RSYNC_WARN/);
  });

  it("acquireDeployLockCommand creates tmp/deploy.lock", () => {
    const cmd = acquireDeployLockCommand("/app", "2026-07-17-0930");
    assert.match(cmd, /tmp\/deploy\.lock/);
    assert.match(cmd, /DEPLOY_LOCKED/);
    assert.match(cmd, /LOCK_ACQUIRED/);
  });

  it("releaseDeployLockCommand removes lock", () => {
    const cmd = releaseDeployLockCommand("/app");
    assert.match(cmd, /rm -f tmp\/deploy\.lock/);
  });

  it("restartCloudLinuxAppCommand includes sleep delays", () => {
    const cmd = restartCloudLinuxAppCommand("/app");
    assert.match(cmd, /touch tmp\/restart\.txt/);
    assert.match(cmd, /sleep 5/);
    assert.match(cmd, /sleep 10/);
    assert.match(cmd, /cloudlinux-selector restart/);
  });

  it("restoreBackupCommand extracts tar.gz archive", () => {
    const cmd = restoreBackupCommand("/app", "2026-07-17-0930");
    assert.match(cmd, /backups\/2026-07-17-0930\.tar\.gz/);
    assert.match(cmd, /tar -xzf/);
    assert.match(cmd, /RESTORE_OK/);
    assert.doesNotMatch(cmd, /npm run build/);
  });

  it("PRESERVE_PATHS includes incoming and staging", () => {
    assert.ok(PRESERVE_PATHS.includes("incoming"));
    assert.ok(PRESERVE_PATHS.includes("staging"));
    assert.ok(PRESERVE_PATHS.includes(".env"));
  });

  it("RSYNC_WARNING_EXIT_CODES includes 23 and 24", () => {
    assert.deepEqual(RSYNC_WARNING_EXIT_CODES, [23, 24]);
  });

  it("tarExcludeFlags excludes node_modules and .next/cache", () => {
    const flags = tarExcludeFlags();
    assert.match(flags, /exclude=node_modules/);
    assert.match(flags, /exclude=\.next\/cache/);
  });
});

describe("health-poll.js v6", () => {
  it("describeHttpStatus explains 404 as Passenger starting", () => {
    assert.match(describeHttpStatus(404, {}), /Passenger/i);
  });

  it("STARTUP_ANOMALY_STATUSES includes 404", () => {
    assert.ok(STARTUP_ANOMALY_STATUSES.has(404));
  });

  it("validatePostDeployHealth flags unhealthy database", () => {
    const issues = validatePostDeployHealth({
      status: "unhealthy",
      database: "unhealthy",
      supabase: "healthy",
    });
    assert.ok(issues.some((i) => i.includes("database")));
  });
});
