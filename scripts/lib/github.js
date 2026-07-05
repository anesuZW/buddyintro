/**
 * GitHub Release creation via gh CLI.
 */
const { existsSync } = require("fs");
const { run, runCapture } = require("./exec");

function assertGhInstalled() {
  try {
    runCapture("gh", ["--version"]);
  } catch {
    throw new Error("GitHub CLI (gh) is required. Install: https://cli.github.com/");
  }
}

function assertGhAuthenticated() {
  try {
    runCapture("gh", ["auth", "status"]);
  } catch {
    throw new Error("gh is not authenticated. Run: gh auth login");
  }
}

function releaseExists(version) {
  try {
    runCapture("gh", ["release", "view", `v${version}`]);
    return true;
  } catch {
    return false;
  }
}

function createGitHubRelease({ version, zipPath, changelogPath, notesPath, repo }) {
  if (releaseExists(version)) {
    throw new Error(
      `GitHub Release v${version} already exists — refusing to overwrite.\n` +
        "Bump version with npm run release -- --patch before publishing again."
    );
  }

  for (const f of [zipPath, changelogPath, notesPath]) {
    if (!existsSync(f)) {
      throw new Error(`Missing release asset: ${f}`);
    }
  }

  const args = [
    "release",
    "create",
    `v${version}`,
    "--title",
    `BuddyIntro v${version}`,
    "--notes-file",
    notesPath,
    zipPath,
    changelogPath,
    notesPath,
  ];

  if (repo) args.push("--repo", repo);

  console.log("\n→ Creating GitHub Release…");
  run("gh", args);
}

module.exports = {
  assertGhInstalled,
  assertGhAuthenticated,
  releaseExists,
  createGitHubRelease,
};
