/**
 * Shared paths for release scripts.
 */
const { resolve, join } = require("path");

const ROOT = resolve(process.cwd());
const DEPLOYMENT_DIR = join(ROOT, "deployment");
const RELEASES_DIR = join(DEPLOYMENT_DIR, "releases");
const DEPLOY_LOGS_DIR = join(DEPLOYMENT_DIR, "logs");
const STAGING_DIR = join(DEPLOYMENT_DIR, "staging");
const PACKAGE_JSON = join(ROOT, "package.json");

const PRODUCTION_INCLUDES = [
  ".next",
  "public",
  "prisma",
  "package.json",
  "package-lock.json",
  "next.config.js",
  "index.js",
];

module.exports = {
  ROOT,
  DEPLOYMENT_DIR,
  RELEASES_DIR,
  DEPLOY_LOGS_DIR,
  STAGING_DIR,
  PACKAGE_JSON,
  PRODUCTION_INCLUDES,
};
