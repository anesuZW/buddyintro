/**
 * Local build verification — standalone output only (no server-side build).
 */
const { existsSync, statSync } = require("fs");
const { join } = require("path");
const { ROOT } = require("./paths");
const { runNpm, spawnCommand, CommandError } = require("./exec");

/**
 * Required after `npm run build` (Next standalone + sync-standalone.js).
 * Version manifests live under .next/standalone only — not the repo root.
 */
const LOCAL_DEPLOY_ARTIFACTS = [
  { path: ".next", type: "directory", required: true },
  { path: ".next/standalone", type: "directory", required: true },
  { path: ".next/standalone/server.js", type: "file", required: true },
  { path: ".next/standalone/deployment/build.json", type: "file", required: true },
  { path: ".next/standalone/build/version.json", type: "file", required: true },
  { path: ".next/standalone/.next/static", type: "directory", required: true },
  { path: ".next/standalone/public", type: "directory", required: true },
  { path: ".next/static", type: "directory", required: true },
  { path: ".next/BUILD_ID", type: "file", required: true },
  { path: "public/sw.js", type: "file", required: true },
  { path: "public/workbox/workbox-sw.js", type: "file", required: true },
];

function artifactExists(root, artifact) {
  const absolute = join(root, artifact.path);
  if (!existsSync(absolute)) return false;
  if (artifact.type === "directory") {
    return statSync(absolute).isDirectory();
  }
  return statSync(absolute).isFile();
}

function verifyLocalStandaloneBuild(options = {}) {
  const root = options.root || ROOT;
  const missing = [];
  const optionalMissing = [];

  for (const artifact of LOCAL_DEPLOY_ARTIFACTS) {
    if (artifactExists(root, artifact)) continue;
    const label = artifact.path;
    if (artifact.required) {
      missing.push(label);
      console.error(`✗ Missing ${label}`);
    } else {
      optionalMissing.push(label);
    }
  }

  if (optionalMissing.length && !options.quiet) {
    for (const label of optionalMissing) {
      console.log(`○ Optional artifact not present: ${label} (written during release packaging)`);
    }
  }

  if (missing.length) {
    throw new Error(
      `Local standalone build incomplete. Missing ${missing.length} required artifact(s).\n` +
        "Run `npm run build` locally before deploying."
    );
  }

  if (!options.quiet) {
    console.log("✓ Local build artifacts verified");
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
  const { verifyStandaloneManifestIntegrity } = require("./standalone-sync");
  verifyStandaloneManifestIntegrity();
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
  LOCAL_DEPLOY_ARTIFACTS,
  verifyLocalStandaloneBuild,
  parseBuildVerifyOutput,
  runLocalInstall,
  runLocalBuild,
  runLocalBuildPipeline,
  buildCommand,
  verifyBuildCommand,
  remoteBuildIdCheckCommand,
};
