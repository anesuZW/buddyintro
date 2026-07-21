/**
 * Materialize a runnable standalone bundle under .next/standalone.
 * Next.js emits server.js only; static assets and version manifests must be copied in.
 */
const { cpSync, existsSync, mkdirSync, readFileSync } = require("fs");
const { join } = require("path");
const { ROOT } = require("./paths");
const { writeBuildMetadata } = require("./deploy-metadata");
const { tryGitCapture } = require("./exec");

const STANDALONE_DIR = join(ROOT, ".next", "standalone");

function standalonePaths(root = ROOT) {
  const standalone = join(root, ".next", "standalone");
  return {
    standalone,
    serverJs: join(standalone, "server.js"),
    staticSrc: join(root, ".next", "static"),
    staticDest: join(standalone, ".next", "static"),
    publicSrc: join(root, "public"),
    publicDest: join(standalone, "public"),
    deploymentBuild: join(standalone, "deployment", "build.json"),
    buildVersion: join(standalone, "build", "version.json"),
  };
}

function copyDirIfExists(src, dest, label) {
  if (!existsSync(src)) {
    throw new Error(`Missing ${label}: ${src}`);
  }
  mkdirSync(join(dest, ".."), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

/**
 * Copy static/public into standalone and write version manifests into the bundle.
 * @param {string} [root]
 * @param {string} [releaseId]
 */
function syncStandaloneBundle(root = ROOT, releaseId) {
  const paths = standalonePaths(root);

  if (!existsSync(paths.serverJs)) {
    throw new Error(
      "Missing .next/standalone/server.js — run `next build` with output: 'standalone' in next.config.js"
    );
  }

  copyDirIfExists(paths.staticSrc, paths.staticDest, ".next/static");
  copyDirIfExists(paths.publicSrc, paths.publicDest, "public");

  const { meta, manifest } = writeBuildMetadata(paths.standalone, releaseId);

  return { paths, meta, manifest };
}

function readManifestCommit(manifestPath) {
  if (!existsSync(manifestPath)) return null;
  try {
    const json = JSON.parse(readFileSync(manifestPath, "utf8"));
    return json.gitCommit || json.commit || null;
  } catch {
    return null;
  }
}

/**
 * Verify standalone manifests match git HEAD. Throws on mismatch.
 */
function verifyStandaloneManifestIntegrity(root = ROOT) {
  const paths = standalonePaths(root);
  const head = tryGitCapture(["rev-parse", "HEAD"]);
  if (!head) {
    throw new Error("Cannot resolve git HEAD — verifyStandaloneManifestIntegrity requires a git checkout");
  }

  const deploymentCommit = readManifestCommit(paths.deploymentBuild);
  const versionCommit = readManifestCommit(paths.buildVersion);

  const errors = [];
  if (!deploymentCommit) errors.push("missing .next/standalone/deployment/build.json");
  if (!versionCommit) errors.push("missing .next/standalone/build/version.json");
  if (deploymentCommit && deploymentCommit !== head) {
    errors.push(`standalone deployment/build.json commit ${deploymentCommit.slice(0, 7)} ≠ HEAD ${head.slice(0, 7)}`);
  }
  if (versionCommit && versionCommit !== head) {
    errors.push(`standalone build/version.json commit ${versionCommit.slice(0, 7)} ≠ HEAD ${head.slice(0, 7)}`);
  }
  if (deploymentCommit && versionCommit && deploymentCommit !== versionCommit) {
    errors.push("standalone manifest files disagree with each other");
  }

  if (errors.length) {
    throw new Error(`Standalone manifest integrity check failed:\n  ${errors.join("\n  ")}`);
  }

  return { head, deploymentCommit, versionCommit, standaloneDir: paths.standalone };
}

module.exports = {
  STANDALONE_DIR,
  standalonePaths,
  syncStandaloneBundle,
  verifyStandaloneManifestIntegrity,
};
