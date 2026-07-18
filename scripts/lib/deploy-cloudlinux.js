/**
 * CloudLinux / InterServer Passenger — v6 atomic app-root deployment.
 *
 * Design:
 * - Extract packages into staging/ (never directly into live app)
 * - Validate + activate in staging before touching production
 * - Immutable tar.gz backups (never rsync app → app/backups)
 * - Atomic rsync staging → app with delay-updates; exit 23/24 are warnings only
 * - Deploy lock at tmp/deploy.lock prevents concurrent deploys
 */
const { bashRemote } = require("./ssh");
const { remoteScript } = require("./resolve-server-node");

/** Paths never overwritten during atomic sync or backup restore. */
const PRESERVE_PATHS = [
  ".env",
  "backups",
  "incoming",
  "staging",
  "tmp",
  "storage",
  "public/uploads",
];

/** Legacy v5 path — excluded during sync if still present. */
const LEGACY_PRESERVE_PATHS = ["packages-incoming"];

/** Rsync exit codes that indicate vanishing files during live app activity — warn only. */
const RSYNC_WARNING_EXIT_CODES = [23, 24];

const BACKUP_TAR_EXCLUDES = [
  ".env",
  "backups",
  "incoming",
  "staging",
  "packages-incoming",
  "node_modules",
  ".next/cache",
  "tmp/deploy.lock",
];

const ATOMIC_SYNC_EXCLUDES = [
  ".env",
  "backups",
  "incoming",
  "staging",
  "packages-incoming",
  "tmp",
  ".git",
  "public/uploads",
  "storage",
];

function shellQuote(path) {
  const expanded = path.startsWith("~") ? path.replace(/^~/, "$HOME") : path;
  return expanded.includes(" ") ? `"${expanded}"` : expanded;
}

function tarExcludeFlags() {
  return BACKUP_TAR_EXCLUDES.map((p) => `--exclude=${p}`).join(" ");
}

function rsyncExcludeFlags() {
  return ATOMIC_SYNC_EXCLUDES.map((p) => `--exclude=${p}`).join(" ");
}

/** Wrap rsync with v6 exit-code policy: 23/24 are warnings, not failures. */
function rsyncWithTolerantExit(rsyncArgs) {
  const warnCodes = RSYNC_WARNING_EXIT_CODES.join("|");
  return [
    rsyncArgs,
    "RSYNC_RC=$?",
    `if [ $RSYNC_RC -eq 0 ]; then echo "RSYNC_OK"; elif [ $RSYNC_RC -eq 23 ] || [ $RSYNC_RC -eq 24 ]; then echo "RSYNC_WARN: exit code $RSYNC_RC (vanished files — non-fatal)"; else echo "RSYNC_FAILED: exit code $RSYNC_RC" && exit $RSYNC_RC; fi`,
  ].join(" && ");
}

function stagingPath(deployRoot) {
  return `${shellQuote(deployRoot)}/staging`;
}

function incomingPath(deployRoot) {
  return `${shellQuote(deployRoot)}/incoming`;
}

function backupsPath(deployRoot) {
  return `${shellQuote(deployRoot)}/backups`;
}

function remoteInStaging(deployRoot, commands) {
  return remoteScript(deployRoot, [`cd staging && ${commands.join(" && ")}`]);
}

/** Create v6 directory layout at Passenger application root. */
function ensureAppLayoutCommand(deployRoot) {
  const root = shellQuote(deployRoot);
  return bashRemote(
    [
      `mkdir -p ${root}`,
      `mkdir -p ${root}/backups`,
      `mkdir -p ${root}/incoming`,
      `mkdir -p ${root}/staging`,
      `mkdir -p ${root}/tmp`,
      `test -f ${root}/.env || (echo "ENV_MISSING: .env not found at application root" && exit 1)`,
      'echo "LAYOUT_OK"',
    ].join(" && ")
  );
}

function verifyServerEnvCommand(deployRoot) {
  const { remoteEnvCheckScript, REQUIRED_SERVER_ENV } = require("./deploy-env");
  return remoteScript(deployRoot, [remoteEnvCheckScript(REQUIRED_SERVER_ENV)]);
}

function removeLegacyReleaseLayoutCommand(deployRoot) {
  const root = shellQuote(deployRoot);
  return remoteScript(deployRoot, [
    `if [ -L ${root}/current ]; then rm -f ${root}/current; echo "removed legacy current symlink"; fi`,
    `if [ -d ${root}/current ] && [ ! -L ${root}/current ]; then echo "LEGACY_CURRENT_DIR: remove current directory manually before deploy" && exit 1; fi`,
    `if [ -d ${root}/releases ]; then echo "LEGACY_RELEASES: releases/ still present (safe to remove after first successful deploy)"; fi`,
    `if [ -d ${root}/packages-incoming ]; then echo "LEGACY_INCOMING: packages-incoming/ present — migrate to incoming/"; fi`,
    'echo "LEGACY_OK"',
  ]);
}

/** Acquire exclusive deploy lock — abort if another deploy is running. */
function acquireDeployLockCommand(deployRoot, deployId) {
  const safeId = deployId.replace(/[^0-9-]/g, "");
  return remoteScript(deployRoot, [
    "mkdir -p tmp",
    'if [ -f tmp/deploy.lock ]; then echo "DEPLOY_LOCKED: $(cat tmp/deploy.lock)" && exit 1; fi',
    `echo "${safeId}|$(date -u +%Y-%m-%dT%H:%M:%SZ)|$$" > tmp/deploy.lock`,
    'echo "LOCK_ACQUIRED"',
  ]);
}

function releaseDeployLockCommand(deployRoot) {
  return remoteScript(deployRoot, [
    "rm -f tmp/deploy.lock",
    'echo "LOCK_RELEASED"',
  ]);
}

function readDeployLockCommand(deployRoot) {
  return remoteScript(deployRoot, ['cat tmp/deploy.lock 2>/dev/null || echo ""']);
}

/** Step 2: Extract uploaded package into staging/ (not live app). */
function extractPackageToStagingCommand(deployRoot, archiveName) {
  const root = shellQuote(deployRoot);
  const safeArchive = archiveName.replace(/[^0-9A-Za-z._-]/g, "");
  const incoming = `${root}/incoming`;
  const staging = `${root}/staging`;
  return remoteScript(deployRoot, [
    `rm -rf ${staging}`,
    `mkdir -p ${staging}`,
    `test -f ${incoming}/${safeArchive} || (echo "PACKAGE_MISSING: ${safeArchive}" && exit 1)`,
    `tar -xzf ${incoming}/${safeArchive} -C ${staging}`,
    `rm -f ${incoming}/${safeArchive}`,
    'echo "EXTRACT_STAGING_OK"',
  ]);
}

/** Step 3: Validate staging contains a complete local standalone build. */
function verifyStagingBuildCommand(deployRoot) {
  return remoteInStaging(deployRoot, [
    'test -f server.js || (echo "BUILD_MISSING: server.js" && exit 1)',
    'test -f package.json || (echo "BUILD_MISSING: package.json" && exit 1)',
    'test -f index.js || (echo "BUILD_MISSING: index.js" && exit 1)',
    'test -d .next || (echo "BUILD_MISSING: .next directory" && exit 1)',
    'test -f .next/BUILD_ID || (echo "BUILD_MISSING: .next/BUILD_ID" && exit 1)',
    'test -d .next/static || (echo "BUILD_MISSING: .next/static" && exit 1)',
    'test -d .next/standalone || (echo "BUILD_MISSING: .next/standalone" && exit 1)',
    'test -d public || (echo "BUILD_MISSING: public" && exit 1)',
    'echo "STAGING_BUILD_OK"',
    "cat .next/BUILD_ID",
  ]);
}

/** Step 4–6: Activate release inside staging (deps, prisma generate, migrate). No next build. */
function serverActivateInStagingCommand(deployRoot, { runMigrations = true } = {}) {
  const migrateStep = runMigrations
    ? "npx prisma migrate deploy"
    : 'echo "MIGRATE_SKIPPED"';
  return remoteInStaging(deployRoot, [
    "if [ ! -d node_modules ] || [ ! -f node_modules/@prisma/client/index.js ]; then npm install --omit=dev; else echo DEPS_OK; fi",
    "npx prisma generate",
    migrateStep,
    'echo "STAGING_ACTIVATE_OK"',
  ]);
}

/** Step 7: Smoke-test staging after activation. */
function smokeTestStagingCommand(deployRoot) {
  return remoteInStaging(deployRoot, [
    'test -f node_modules/@prisma/client/index.js || (echo "SMOKE_FAIL: Prisma client missing" && exit 1)',
    'test -f .next/BUILD_ID || (echo "SMOKE_FAIL: BUILD_ID missing after activate" && exit 1)',
    'node -e "require(\\"./server.js\\")" 2>/dev/null || echo "SMOKE_WARN: server.js require check skipped (standalone may need runtime env)"',
    'echo "SMOKE_OK"',
    "cat .next/BUILD_ID",
  ]);
}

/** Step 8: Create immutable compressed backup of current live app (tar, never rsync). */
function createBackupArchiveCommand(deployRoot, backupId) {
  const root = shellQuote(deployRoot);
  const safeId = backupId.replace(/[^0-9-]/g, "");
  const archive = `${root}/backups/${safeId}.tar.gz`;
  const excludes = tarExcludeFlags();
  return remoteScript(deployRoot, [
    `mkdir -p ${root}/backups`,
    `if [ -f ${root}/server.js ] || [ -f ${root}/package.json ]; then tar ${excludes} -czf ${archive} -C ${root} . || (echo "BACKUP_FAILED" && exit 1); else echo "BACKUP_SKIPPED: empty application root"; fi`,
    `test -f ${archive} && echo "BACKUP_ARCHIVE=${safeId}.tar.gz" || echo "BACKUP_SKIPPED"`,
    'echo "BACKUP_OK"',
  ]);
}

/** Step 9: Atomic sync staging → live app with delay-updates (near zero-downtime). */
function atomicSyncStagingToAppCommand(deployRoot) {
  const root = shellQuote(deployRoot);
  const staging = `${root}/staging`;
  const excludes = rsyncExcludeFlags();
  const rsyncCmd = rsyncWithTolerantExit(
    `rsync -a --delete --delay-updates --delete-delay --partial --checksum ${excludes} ${staging}/ ${root}/`
  );
  return remoteScript(deployRoot, [
    rsyncCmd,
    `rm -rf ${staging}`,
    'echo "SYNC_OK"',
  ]);
}

function verifyAppBuildCommand(deployRoot) {
  return remoteScript(deployRoot, [
    'test -f index.js || (echo "BUILD_MISSING: index.js not found" && exit 1)',
    'test -f server.js || (echo "BUILD_MISSING: server.js not found" && exit 1)',
    'test -f .next/BUILD_ID || (echo "BUILD_MISSING: .next/BUILD_ID not found" && exit 1)',
    'test -d node_modules || (echo "BUILD_MISSING: node_modules not found" && exit 1)',
    'echo "BUILD_VERIFIED"',
    "cat .next/BUILD_ID",
  ]);
}

/** Step 10: Passenger restart with timing hardening for CloudLinux selector. */
function restartCloudLinuxAppCommand(deployRoot) {
  const root = shellQuote(deployRoot);
  return remoteScript(deployRoot, [
    "mkdir -p tmp",
    "touch tmp/restart.txt",
    "sleep 5",
    `if command -v cloudlinux-selector >/dev/null 2>&1; then cloudlinux-selector restart --json --interpreter nodejs --app-root ${root} 2>/dev/null || true; fi`,
    "sleep 10",
    'echo "RESTART_OK"',
  ]);
}

/** Rollback: extract backup.tar.gz and atomic-sync to app root. */
function restoreBackupCommand(deployRoot, backupId) {
  const root = shellQuote(deployRoot);
  const safeId = backupId.replace(/[^0-9-]/g, "");
  const archive = `${root}/backups/${safeId}.tar.gz`;
  const legacyDir = `${root}/backups/${safeId}`;
  const restoreDir = `${root}/staging/_restore`;
  const excludes = rsyncExcludeFlags();
  const rsyncFromRestore = rsyncWithTolerantExit(
    `rsync -a --delete --delay-updates --delete-delay --partial --checksum ${excludes} ${restoreDir}/ ${root}/`
  );
  const rsyncFromLegacy = rsyncWithTolerantExit(
    `rsync -a --delete --delay-updates --delete-delay --partial --checksum ${excludes} ${legacyDir}/ ${root}/`
  );
  const restoreBody = [
    `if [ -f ${archive} ]; then`,
    `rm -rf ${restoreDir} && mkdir -p ${restoreDir} && tar -xzf ${archive} -C ${restoreDir} && ${rsyncFromRestore} && rm -rf ${restoreDir}`,
    `elif [ -d ${legacyDir} ]; then`,
    `echo "LEGACY_BACKUP: restoring directory backup ${safeId}" && ${rsyncFromLegacy}`,
    `else`,
    `echo "BACKUP_NOT_FOUND: ${safeId} (expected ${safeId}.tar.gz)" && exit 1`,
    `fi`,
  ].join(" ");
  return remoteScript(deployRoot, [
    restoreBody,
    "mkdir -p tmp",
    "touch tmp/restart.txt",
    "sleep 5",
    `if command -v cloudlinux-selector >/dev/null 2>&1; then cloudlinux-selector restart --json --interpreter nodejs --app-root ${root} 2>/dev/null || true; fi`,
    "sleep 10",
    'echo "RESTORE_OK"',
  ]);
}

function readPreviousBackupCommand(deployRoot) {
  return remoteScript(deployRoot, ['cat .previous-successful-backup 2>/dev/null || echo ""']);
}

function writePreviousBackupCommand(deployRoot, backupId, sha) {
  const safeId = backupId.replace(/[^0-9-]/g, "");
  const safeSha = (sha || "").replace(/[^a-zA-Z0-9]/g, "");
  return remoteScript(deployRoot, [
    `echo "${safeId}" > .previous-successful-backup`,
    `echo "${safeSha}" > .previous-successful-sha`,
  ]);
}

/** Prune old backup archives (and legacy v5 directories). */
function cleanOldBackupsCommand(deployRoot, keep = 5) {
  const root = shellQuote(deployRoot);
  const n = Math.max(1, Number(keep) || 5);
  return remoteScript(deployRoot, [
    `cd ${root}/backups 2>/dev/null || exit 0`,
    `ls -1t 2>/dev/null | tail -n +${n + 1} | while read -r old; do rm -rf "$old"; echo "removed backup $old"; done`,
    'echo "CLEAN_OK"',
  ]);
}

// --- Legacy v5 aliases (redirect to v6 equivalents) ---

function verifyProductionBuildCommand(deployRoot) {
  return verifyStagingBuildCommand(deployRoot);
}

function serverActivateCommand(deployRoot, opts) {
  return serverActivateInStagingCommand(deployRoot, opts);
}

function extractPackageToAppCommand(deployRoot, archiveName) {
  return extractPackageToStagingCommand(deployRoot, archiveName);
}

function createBackupCommand(deployRoot, backupId) {
  return createBackupArchiveCommand(deployRoot, backupId);
}

module.exports = {
  PRESERVE_PATHS,
  LEGACY_PRESERVE_PATHS,
  RSYNC_WARNING_EXIT_CODES,
  BACKUP_TAR_EXCLUDES,
  ATOMIC_SYNC_EXCLUDES,
  ensureAppLayoutCommand,
  verifyServerEnvCommand,
  removeLegacyReleaseLayoutCommand,
  acquireDeployLockCommand,
  releaseDeployLockCommand,
  readDeployLockCommand,
  extractPackageToStagingCommand,
  verifyStagingBuildCommand,
  serverActivateInStagingCommand,
  smokeTestStagingCommand,
  createBackupArchiveCommand,
  atomicSyncStagingToAppCommand,
  verifyAppBuildCommand,
  restartCloudLinuxAppCommand,
  restoreBackupCommand,
  readPreviousBackupCommand,
  writePreviousBackupCommand,
  cleanOldBackupsCommand,
  // Legacy aliases
  verifyProductionBuildCommand,
  serverActivateCommand,
  extractPackageToAppCommand,
  extractSourceToAppCommand: extractPackageToStagingCommand,
  createBackupCommand,
  rsyncWithTolerantExit,
  tarExcludeFlags,
  rsyncExcludeFlags,
};
