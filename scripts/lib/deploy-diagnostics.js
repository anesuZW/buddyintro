/**
 * Deployment failure diagnostics — saved to deployment/failures/ (v6).
 */
const { existsSync, mkdirSync, writeFileSync, readFileSync } = require("fs");
const { join } = require("path");
const { DEPLOY_FAILURES_DIR } = require("./paths");
const { remoteScript } = require("./resolve-server-node");

function failureDirName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Expanded server diagnostics for Passenger / CloudLinux troubleshooting. */
function buildDiagnosticsCommand(appPath) {
  return remoteScript(appPath, [
    'echo "=== SERVER DIAGNOSTICS (v6) ==="',
    "date -u",
    "pwd",
    'echo "DEPLOY_LOCK=$(cat tmp/deploy.lock 2>/dev/null || echo none)"',
    'echo "BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null || echo missing)"',
    'echo "PREVIOUS_SHA=$(cat .previous-successful-sha 2>/dev/null || echo none)"',
    "node -v 2>&1 || true",
    "npm -v 2>&1 || true",
    "npx prisma -v 2>&1 || true",
    'echo "=== DISK / MEMORY ==="',
    "df -h . 2>&1 || true",
    "df -i . 2>&1 || true",
    "free -m 2>&1 || true",
    'echo "=== APP ROOT LISTING ==="',
    "ls -la",
    'echo "=== .next ==="',
    'ls -la .next 2>&1 || echo ".next missing"',
    'echo "=== STAGING ==="',
    'ls -la staging 2>&1 || echo "staging empty or missing"',
    'echo "=== INCOMING ==="',
    'ls -la incoming 2>&1 || echo "incoming empty or missing"',
    'echo "=== BACKUPS ==="',
    'ls -la backups 2>&1 | head -20 || echo "no backups"',
    'echo "=== TREE (depth 2) ==="',
    'find . -maxdepth 2 -type d 2>/dev/null | head -80 || ls -R | head -120',
    'echo "=== PROCESSES ==="',
    'ps -ef | grep -E "[n]ode|[P]assenger" 2>&1 || true',
    'echo "=== PASSENGER / STDERR ==="',
    'tail -150 stderr.log 2>/dev/null || echo "stderr.log not found"',
    'tail -150 log/passenger.log 2>/dev/null || tail -150 tmp/passenger.log 2>/dev/null || echo "passenger log not found"',
    'echo "=== CLOUDLINUX SELECTOR ==="',
    'cloudlinux-selector get --json --interpreter nodejs 2>/dev/null || echo "cloudlinux-selector unavailable"',
    'cloudlinux-selector status --json --interpreter nodejs 2>/dev/null || true',
    'test -f .next/standalone/build/version.json && echo "=== standalone/build/version.json ===" && cat .next/standalone/build/version.json || echo "standalone version manifest missing"',
    'test -f deployment/manifest.json && echo "=== deployment/manifest.json ===" && cat deployment/manifest.json || true',
  ]);
}

/** Lighter diagnostics triggered on health 404 during warm-up. */
function buildPassengerAnomalyCommand(appPath) {
  return remoteScript(appPath, [
    'echo "=== PASSENGER ANOMALY CHECK ==="',
    "pwd",
    'echo "BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null || echo missing)"',
    'echo "LOCK=$(cat tmp/deploy.lock 2>/dev/null || echo none)"',
    'ps -ef | grep -E "[n]ode|[P]assenger" 2>&1 || true',
    'tail -80 stderr.log 2>/dev/null || echo "stderr.log not found"',
    'tail -80 log/passenger.log 2>/dev/null || tail -80 tmp/passenger.log 2>/dev/null || echo "passenger log not found"',
    'cloudlinux-selector status --json --interpreter nodejs 2>/dev/null || true',
  ]);
}

function collectDiagnostics({ sshExecCapture, appPath, logger, errorMessage }) {
  const dir = join(DEPLOY_FAILURES_DIR, failureDirName());
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "error.txt"), errorMessage || "unknown error");

  if (logger?.path && existsSync(logger.path)) {
    try {
      const log = readFileSync(logger.path, "utf8");
      const tail = log.split("\n").slice(-150).join("\n");
      writeFileSync(join(dir, "deploy-log-tail.txt"), tail);
    } catch {
      writeFileSync(join(dir, "deploy-log-tail.txt"), "(could not read deploy log)");
    }
  }

  try {
    const output = sshExecCapture(buildDiagnosticsCommand(appPath), logger);
    writeFileSync(join(dir, "server-diagnostics.txt"), output);
    if (logger) logger.log(`Diagnostics saved: ${dir.replace(/\\/g, "/")}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    writeFileSync(join(dir, "server-diagnostics.txt"), `Failed to collect server diagnostics: ${msg}`);
    if (logger) logger.log(`Diagnostics partial (SSH failed): ${dir.replace(/\\/g, "/")}`);
  }

  return dir;
}

async function collectPassengerAnomalyDiagnostics({ sshExecCapture, appPath, logger, context }) {
  try {
    const output = sshExecCapture(buildPassengerAnomalyCommand(appPath), logger);
    const header = context ? `Context: ${JSON.stringify(context)}\n\n` : "";
    if (logger) {
      logger.log("  ⚠ Health anomaly — collected Passenger diagnostics:");
      logger.log(output.split("\n").slice(0, 20).join("\n"));
    }
    return header + output;
  } catch (e) {
    return `Passenger anomaly diagnostics failed: ${e instanceof Error ? e.message : String(e)}`;
  }
}

module.exports = {
  failureDirName,
  buildDiagnosticsCommand,
  buildPassengerAnomalyCommand,
  collectDiagnostics,
  collectPassengerAnomalyDiagnostics,
};
