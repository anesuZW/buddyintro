/**
 * Semantic version helpers.
 */
const { readFileSync, writeFileSync } = require("fs");
const { PACKAGE_JSON } = require("./paths");

function readVersion() {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
  return pkg.version;
}

function writeVersion(version) {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
  pkg.version = version;
  writeFileSync(PACKAGE_JSON, `${JSON.stringify(pkg, null, 2)}\n`);
  return version;
}

function bumpVersion(current, type) {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid semver: ${current}`);
  }
  let [major, minor, patch] = parts;
  switch (type) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    default:
      throw new Error(`Unknown bump type: ${type}. Use patch, minor, or major.`);
  }
  return `${major}.${minor}.${patch}`;
}

function parseReleaseArgs(argv) {
  return {
    bump: argv.includes("--major") ? "major" : argv.includes("--minor") ? "minor" : "patch",
    skipBump: argv.includes("--no-bump"),
    commit: argv.includes("--commit"),
    push: argv.includes("--push"),
    dryRun: argv.includes("--dry-run"),
  };
}

module.exports = { readVersion, writeVersion, bumpVersion, parseReleaseArgs };
