/**
 * Git helpers for publish pipeline.
 */
const { run, runCapture } = require("./exec");

const RELEASE_ALLOWLIST = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^CHANGELOG\.md$/,
  /^deployment\/releases\/RELEASE_NOTES_v[\d.]+\.md$/,
  /^deployment\/releases\/\.gitkeep$/,
];

function gitStatusPorcelain() {
  return runCapture("git", ["status", "--porcelain"]);
}

function parseStatusLines(porcelain) {
  return porcelain
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const entry = line.slice(3);
      return entry.includes(" -> ") ? entry.split(" -> ")[1] : entry;
    });
}

function assertReleaseReadyWorkingTree() {
  const porcelain = gitStatusPorcelain();
  if (!porcelain) return;

  const files = parseStatusLines(porcelain);
  const disallowed = files.filter((f) => !RELEASE_ALLOWLIST.some((re) => re.test(f.replace(/\\/g, "/"))));

  if (disallowed.length) {
    throw new Error(
      `Working tree has uncommitted changes outside release files:\n  ${disallowed.join("\n  ")}\n` +
        "Commit or stash unrelated work before npm run publish."
    );
  }
}

function assertCleanWorkingTree() {
  const porcelain = gitStatusPorcelain();
  if (porcelain) {
    throw new Error(
      `Git working tree is not clean:\n${porcelain}\n` +
        "Run npm run release first, then npm run publish."
    );
  }
}

function tagExists(version) {
  try {
    runCapture("git", ["rev-parse", `v${version}`]);
    return true;
  } catch {
    return false;
  }
}

function remoteTagExists(version) {
  try {
    const out = runCapture("git", ["ls-remote", "--tags", "origin", `refs/tags/v${version}`]);
    return out.length > 0;
  } catch {
    return false;
  }
}

function commitRelease(version, absolutePaths) {
  const { relative } = require("path");
  const files = absolutePaths.map((p) => relative(process.cwd(), p).replace(/\\/g, "/"));
  run("git", ["add", ...files]);
  run("git", ["commit", "-m", `Release v${version}`]);
}

function tagRelease(version) {
  if (tagExists(version)) {
    throw new Error(`Tag v${version} already exists locally — refusing to overwrite.`);
  }
  run("git", ["tag", "-a", `v${version}`, "-m", `BuddyIntro v${version}`]);
}

function pushRelease() {
  run("git", ["push"]);
  run("git", ["push", "--tags"]);
}

function listVersionTags() {
  try {
    const out = runCapture("git", ["tag", "--list", "v*", "--sort=-version:refname"]);
    return out
      .split("\n")
      .filter(Boolean)
      .map((t) => t.replace(/^v/, ""));
  } catch {
    return [];
  }
}

module.exports = {
  assertCleanWorkingTree,
  assertReleaseReadyWorkingTree,
  gitStatusPorcelain,
  tagExists,
  remoteTagExists,
  commitRelease,
  tagRelease,
  pushRelease,
  listVersionTags,
  RELEASE_ALLOWLIST,
};
