/**
 * Repository root validation for release/deploy scripts.
 */
const { existsSync } = require("fs");
const { join, resolve } = require("path");
const { ROOT, PACKAGE_JSON } = require("./paths");

function assertRepoRoot() {
  const cwd = resolve(process.cwd());

  if (!existsSync(PACKAGE_JSON)) {
    throw new Error(
      `Not running from repository root.\n` +
        `  cwd: ${cwd}\n` +
        `  missing: package.json\n` +
        `Run release from the BuddyIntro project root.`
    );
  }

  const lockPath = join(cwd, "package-lock.json");
  if (!existsSync(lockPath)) {
    throw new Error(
      `Not running from repository root.\n` +
        `  cwd: ${cwd}\n` +
        `  missing: package-lock.json\n` +
        `Run release from the BuddyIntro project root.`
    );
  }

  if (cwd !== ROOT) {
    throw new Error(
      `Working directory mismatch.\n` +
        `  process.cwd(): ${cwd}\n` +
        `  expected root:  ${ROOT}`
    );
  }

  return cwd;
}

module.exports = { assertRepoRoot };
