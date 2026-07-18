/**
 * Shared paths for release scripts.
 * ROOT is anchored to the repository (parent of scripts/), not process.cwd(),
 * so git/npm commands stay correct when invoked from another working directory.
 */
const { resolve, join } = require("path");

const ROOT = resolve(__dirname, "../..");
const DEPLOYMENT_DIR = join(ROOT, "deployment");
const RELEASES_DIR = join(DEPLOYMENT_DIR, "releases");
const PACKAGES_DIR = join(DEPLOYMENT_DIR, "packages");
const DEPLOY_LOGS_DIR = join(DEPLOYMENT_DIR, "logs");
const DEPLOY_FAILURES_DIR = join(DEPLOYMENT_DIR, "failures");
const DEPLOY_HISTORY_PATH = join(DEPLOYMENT_DIR, "history.json");
const STAGING_DIR = join(DEPLOYMENT_DIR, "staging");
const LATEST_PACKAGE_PATH = join(PACKAGES_DIR, "latest.json");
const PACKAGE_JSON = join(ROOT, "package.json");

/** Legacy ZIP release includes — standalone deploy uses deploy-package.js */
const PRODUCTION_INCLUDES = [
  ".next",
  "public",
  "prisma",
  "package.json",
  "package-lock.json",
  "next.config.js",
  "index.js",
  "build",
  "deployment",
];

module.exports = {
  ROOT,
  DEPLOYMENT_DIR,
  RELEASES_DIR,
  PACKAGES_DIR,
  DEPLOY_LOGS_DIR,
  DEPLOY_FAILURES_DIR,
  DEPLOY_HISTORY_PATH,
  STAGING_DIR,
  LATEST_PACKAGE_PATH,
  PACKAGE_JSON,
  PRODUCTION_INCLUDES,
};
