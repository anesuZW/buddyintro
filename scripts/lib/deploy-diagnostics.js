/**
 * Deployment failure diagnostics — saved to deployment/failures/.
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

function buildDiagnosticsCommand(appPath) {
  return remoteScript(appPath, [
    'echo "=== SERVER DIAGNOSTICS ==="',
    "node -v 2>&1 || true",
    "npm -v 2>&1 || true",
    "npx prisma -v 2>&1 || true",
    "pwd",
    "ls -la",
    'ls -la .next 2>&1 || echo ".next missing"',
    'test -f .next/BUILD_ID && echo "BUILD_ID=$(cat .next/BUILD_ID)" || echo "BUILD_ID missing"',
    'test -f build/version.json && cat build/version.json || echo "build/version.json missing"',
    'ps -ef | grep -E "[n]ode|[P]assenger" 2>&1 || true',
    'tail -100 stderr.log 2>/dev/null || echo "stderr.log not found"',
    'tail -100 log/passenger.log 2>/dev/null || tail -100 tmp/passenger.log 2>/dev/null || echo "passenger log not found"',
    'git rev-parse HEAD 2>/dev/null || echo "git HEAD unavailable"',
    'cat .previous-successful-sha 2>/dev/null || echo "no previous successful sha"',
  ]);
}

function collectDiagnostics({ sshExecCapture, appPath, logger, errorMessage }) {
  const dir = join(DEPLOY_FAILURES_DIR, failureDirName());
  mkdirSync(dir, { recursive: true });

  writeFileSync(join(dir, "error.txt"), errorMessage || "unknown error");

  if (logger?.path && existsSync(logger.path)) {
    try {
      const log = readFileSync(logger.path, "utf8");
      const tail = log.split("\n").slice(-100).join("\n");
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

module.exports = {
  failureDirName,
  buildDiagnosticsCommand,
  collectDiagnostics,
};
