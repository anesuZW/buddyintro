/**
 * Git helpers for publish pipeline.
 */
const { relative } = require("path");
const { runGit, runGitCapture, tryGitCapture, tryRun } = require("./exec");

const RELEASE_ALLOWLIST = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^CHANGELOG\.md$/,
  /^deployment\/package\.js$/,
  /^deployment\/releases\/RELEASE_NOTES_v[\d.]+\.md$/,
  /^deployment\/releases\/\.gitkeep$/,
  /^scripts\/(clean|verify|package|release|publish|deploy|rollback|healthcheck|doctor)\.js$/,
  /^scripts\/lib\/[\w-]+\.js$/,
];

function gitStatusPorcelain() {
  return runGitCapture(["status", "--porcelain"]);
}

function parseStatusLine(line) {
  if (line.startsWith("?? ")) {
    return line.slice(3);
  }
  if (line.startsWith("??")) {
    return line.slice(2).trim();
  }

  const match = line.match(/^[ MADRCU.]{1,2} (.+)$/);
  if (!match) return line.trim();

  const entry = match[1];
  return entry.includes(" -> ") ? entry.split(" -> ")[1] : entry;
}

function parseStatusLines(porcelain) {
  return porcelain
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseStatusLine);
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
  return tryGitCapture(["rev-parse", `v${version}`]) !== null;
}

function remoteTagExists(version) {
  const out = tryGitCapture(["ls-remote", "--tags", "origin", `refs/tags/v${version}`]);
  return Boolean(out && out.length > 0);
}

function commitRelease(version, absolutePaths) {
  const files = absolutePaths.map((p) => relative(process.cwd(), p).replace(/\\/g, "/"));
  runGit(["add", ...files]);
  runGit(["commit", "-m", `Release v${version}`]);
}

function tagRelease(version) {
  if (tagExists(version)) {
    throw new Error(`Tag v${version} already exists locally — refusing to overwrite.`);
  }
  runGit(["tag", "-a", `v${version}`, "-m", `BuddyIntro v${version}`]);
}

function pushRelease() {
  runGit(["push"]);
  runGit(["push", "--tags"]);
}

function listVersionTags() {
  const out = tryGitCapture(["tag", "--list", "v*", "--sort=-version:refname"]);
  if (!out) return [];
  return out
    .split("\n")
    .filter(Boolean)
    .map((t) => t.replace(/^v/, ""));
}

function deleteLocalTag(version) {
  tryRun("git", ["tag", "-d", `v${version}`]);
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
  deleteLocalTag,
  listVersionTags,
  RELEASE_ALLOWLIST,
};
