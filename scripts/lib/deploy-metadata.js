/**
 * Deployment metadata — build.json and release manifest generation.
 */
const { readFileSync, writeFileSync, mkdirSync } = require("fs");
const { join } = require("path");
const { tryGitCapture } = require("./exec");
const { ROOT, PACKAGE_JSON } = require("./paths");

function readPackageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
}

function createReleaseId(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/** CloudLinux backup folder id: YYYY-MM-DD-HHMM */
function createBackupId(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function collectBuildMetadata(releaseId) {
  const pkg = readPackageJson();
  const commit = tryGitCapture(["rev-parse", "HEAD"]) || "unknown";
  const branch = tryGitCapture(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
  const buildDate = new Date().toISOString();

  let nextVersion = "unknown";
  let prismaVersion = "unknown";
  try {
    nextVersion = require(join(ROOT, "node_modules", "next", "package.json")).version;
  } catch {
    /* optional */
  }
  try {
    prismaVersion = require(join(ROOT, "node_modules", "@prisma", "client", "package.json")).version;
  } catch {
    /* optional */
  }

  return {
    version: pkg.version || "0.0.0",
    gitCommit: commit,
    gitBranch: branch,
    buildDate,
    nodeVersion: process.version,
    nextVersion,
    prismaVersion,
    deploymentId: releaseId,
  };
}

/** Legacy shape for /api/version */
function toVersionManifest(meta) {
  return {
    commit: meta.gitCommit,
    branch: meta.gitBranch,
    version: meta.version,
    builtAt: meta.buildDate,
    node: meta.nodeVersion,
    deploymentId: meta.deploymentId,
    nextVersion: meta.nextVersion,
    prismaVersion: meta.prismaVersion,
  };
}

function writeBuildMetadata(targetDir, releaseId) {
  const meta = collectBuildMetadata(releaseId);
  const versionManifest = toVersionManifest(meta);

  const buildDir = join(targetDir, "build");
  const deploymentDir = join(targetDir, "deployment");
  mkdirSync(buildDir, { recursive: true });
  mkdirSync(deploymentDir, { recursive: true });

  writeFileSync(join(buildDir, "version.json"), `${JSON.stringify(versionManifest, null, 2)}\n`);
  writeFileSync(join(buildDir, "build.json"), `${JSON.stringify(meta, null, 2)}\n`);
  writeFileSync(join(deploymentDir, "build.json"), `${JSON.stringify(meta, null, 2)}\n`);

  const manifest = {
    releaseId,
    ...meta,
    packagedAt: new Date().toISOString(),
  };
  writeFileSync(join(deploymentDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  return { meta, manifest, versionManifest };
}

module.exports = {
  createReleaseId,
  createBackupId,
  collectBuildMetadata,
  toVersionManifest,
  writeBuildMetadata,
};
