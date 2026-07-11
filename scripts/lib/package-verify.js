/**
 * Release package verification.
 */
const { existsSync, statSync } = require("fs");
const { join } = require("path");
const { RELEASES_DIR } = require("./paths");

const MIN_ZIP_BYTES = 100_000;

function verifyReleasePackage(version) {
  const zipPath = join(RELEASES_DIR, `BuddyIntro-v${version}.zip`);
  if (!existsSync(zipPath)) {
    throw new Error(
      `Package not found: deployment/releases/BuddyIntro-v${version}.zip\n` +
        "Run npm run release first."
    );
  }
  const size = statSync(zipPath).size;
  if (size < MIN_ZIP_BYTES) {
    throw new Error(`Package too small (${size} bytes) — likely corrupt. Re-run npm run release.`);
  }
  return { zipPath, size };
}

module.exports = { verifyReleasePackage, MIN_ZIP_BYTES };
