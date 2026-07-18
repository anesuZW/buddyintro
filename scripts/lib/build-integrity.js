/**
 * Local build verification — standalone output only (no server-side build).
 */
const { existsSync } = require("fs");
const { join } = require("path");
const { ROOT } = require("./paths");
const { runNpm, spawnCommand, CommandError } = require("./exec");

function verifyLocalStandaloneBuild() {
  const required = [
    join(ROOT, ".next", "standalone", "server.js"),
    join(ROOT, ".next", "BUILD_ID"),
    join(ROOT, "build", "version.json"),
  ];
  const missing = required.filter((p) => !existsSync(p));
  if (missing.length) {
    throw new Error(
      `Local standalone build incomplete:\n  ${missing.join("\n  ")}\n` +
        "Run `npm run build` locally before deploying."
    );
  }
}

function parseBuildVerifyOutput(output) {
  const text = (output || "").trim();
  if (text.includes("BUILD_MISSING")) {
    const line = text.split("\n").find((l) => l.includes("BUILD_MISSING")) || text;
    throw new Error(line.replace(/^BUILD_MISSING:\s*/, ""));
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] || "";
}

function runCommandCaptured(command, args, label, logger) {
  console.log(`\n→ ${label}`);
  if (logger) logger.logCommand(label, `${command} ${args.join(" ")}`);

  const started = Date.now();
  const result = spawnCommand(command, args, { cwd: ROOT, capture: true });

  const stdout = typeof result.stdout === "string" ? result.stdout : result.stdout?.toString?.() || "";
  const stderr = typeof result.stderr === "string" ? result.stderr : result.stderr?.toString?.() || "";

  if (result.status !== 0 || result.error) {
    if (stdout.trim()) console.error("\n--- stdout ---\n" + stdout);
    if (stderr.trim()) console.error("\n--- stderr ---\n" + stderr);
    if (logger) {
      logger.logStep({
        step: label,
        status: "FAILED",
        durationMs: Date.now() - started,
        stdout,
        stderr,
        error: `exit ${result.status}`,
      });
    }
    throw new CommandError({
      command,
      args,
      exitCode: result.status ?? 1,
      stdout,
      stderr,
      hint: "Fix local build errors and retry deploy.",
      display: label,
    });
  }

  if (logger) {
    logger.logStep({
      step: label,
      status: "SUCCESS",
      durationMs: Date.now() - started,
      stdout: stdout.trim() ? stdout : undefined,
      stderr: stderr.trim() ? stderr : undefined,
    });
  }

  return { stdout, stderr, durationMs: Date.now() - started };
}

function runLocalInstall(logger) {
  return runCommandCaptured("npm", ["install"], "npm install (local)", logger);
}

function runLocalBuild(logger) {
  return runCommandCaptured("npm", ["run", "build"], "npm run build (local)", logger);
}

function runLocalBuildPipeline(logger, { skipInstall = false } = {}) {
  const timings = {};
  if (!skipInstall) {
    timings.install = runLocalInstall(logger).durationMs;
  }
  timings.build = runLocalBuild(logger).durationMs;
  verifyLocalStandaloneBuild();
  return timings;
}

/** @deprecated Server-side build removed — use runLocalBuildPipeline */
function buildCommand() {
  throw new Error("Server-side next build removed. Build locally with npm run deploy:build.");
}

/** @deprecated */
function verifyBuildCommand(appPath) {
  const { verifyAppBuildCommand } = require("./deploy-cloudlinux");
  return verifyAppBuildCommand(appPath);
}

function remoteBuildIdCheckCommand(releasePath) {
  const { remoteScript } = require("./resolve-server-node");
  return remoteScript(releasePath, [
    'test -f .next/BUILD_ID && cat .next/BUILD_ID || echo "BUILD_ID_MISSING"',
  ]);
}

module.exports = {
  verifyLocalStandaloneBuild,
  parseBuildVerifyOutput,
  runLocalInstall,
  runLocalBuild,
  runLocalBuildPipeline,
  buildCommand,
  verifyBuildCommand,
  remoteBuildIdCheckCommand,
};
