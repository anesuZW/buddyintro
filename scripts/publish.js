#!/usr/bin/env node
/**
 * Publish a built release to GitHub.
 *
 * Prerequisites: npm run release
 * Usage: npm run publish
 */
const { join } = require("path");
const { ROOT, RELEASES_DIR } = require("./lib/paths");
const { readVersion } = require("./lib/version");
const { verifyReleasePackage } = require("./lib/package-verify");
const {
  assertReleaseReadyWorkingTree,
  tagExists,
  remoteTagExists,
  commitRelease,
  tagRelease,
  pushRelease,
  deleteLocalTag,
} = require("./lib/git");
const { ensureChangelog } = require("./lib/changelog");
const {
  assertGhInstalled,
  assertGhAuthenticated,
  releaseExists,
  createGitHubRelease,
} = require("./lib/github");
const { getDeployConfig } = require("./lib/deploy-config");
const { CommandError } = require("./lib/exec");

function step(name, fn) {
  console.log(`\n[publish] ${name}`);
  try {
    return fn();
  } catch (err) {
    console.error(`\n✗ FAILED at: ${name}`);
    if (err instanceof CommandError) console.error(err.format());
    else console.error(`  ${err.message}`);
    process.exit(1);
  }
}

function main() {
  console.log("\n=== BuddyIntro Publish ===\n");

  const version = step("Read version", () => readVersion());
  const zipPath = join(RELEASES_DIR, `BuddyIntro-v${version}.zip`);
  const tag = `v${version}`;

  step("Verify GitHub CLI installed", () => {
    assertGhInstalled();
    console.log("  ✓ gh installed");
  });

  step("Verify GitHub CLI authenticated", () => {
    assertGhAuthenticated();
    console.log("  ✓ gh authenticated");
  });

  step("Verify release package", () => {
    const { size } = verifyReleasePackage(version);
    console.log(`  ✓ BuddyIntro-v${version}.zip (${Math.round(size / 1024 / 1024)} MB)`);
  });

  step("Verify tag does not exist", () => {
    if (tagExists(version)) throw new Error(`Local tag ${tag} already exists`);
    if (remoteTagExists(version)) throw new Error(`Remote tag ${tag} already exists on origin`);
    console.log(`  ✓ ${tag} is available`);
  });

  step("Verify GitHub release does not exist", () => {
    if (releaseExists(version)) {
      throw new Error(`GitHub Release ${tag} already exists — refusing to overwrite`);
    }
    console.log(`  ✓ No existing GitHub Release for ${tag}`);
  });

  step("Verify clean working tree", () => {
    const { gitStatusPorcelain } = require("./lib/git");
    const porcelain = gitStatusPorcelain();
    if (!porcelain) {
      console.log("  ✓ Working tree clean");
      return;
    }
    assertReleaseReadyWorkingTree();
    console.log("  ✓ Only release-related changes pending");
  });

  const { changelogPath, notesPath } = step("Generate CHANGELOG and release notes", () =>
    ensureChangelog(version)
  );

  step("Verify release files ready to commit", () => {
    assertReleaseReadyWorkingTree();
    console.log("  ✓ CHANGELOG and release notes ready");
  });

  step("Git commit", () => {
    commitRelease(version, [
      changelogPath,
      notesPath,
      join(ROOT, "package.json"),
      join(ROOT, "package-lock.json"),
    ]);
    console.log(`  ✓ Committed Release v${version}`);
  });

  let tagCreated = false;
  step("Git tag", () => {
    tagRelease(version);
    tagCreated = true;
    console.log(`  ✓ Tagged ${tag}`);
  });

  let pushed = false;
  step("Git push", () => {
    try {
      pushRelease();
      pushed = true;
      console.log("  ✓ Pushed branch and tags");
    } catch (err) {
      if (tagCreated && !pushed) {
        deleteLocalTag(version);
        console.error("  ✗ Push failed — local tag removed");
      }
      throw err;
    }
  });

  step("Create GitHub Release", () => {
    let repo = null;
    try {
      repo = getDeployConfig().githubRepo;
    } catch {
      // optional
    }
    createGitHubRelease({
      version,
      zipPath,
      changelogPath,
      notesPath,
      repo,
    });
    console.log(`  ✓ GitHub Release ${tag} with ZIP + CHANGELOG + release notes`);
  });

  console.log("\n=== Publish complete ===");
  console.log(`Version:  ${tag}`);
  console.log(`Package:  deployment/releases/BuddyIntro-v${version}.zip`);
  console.log(`Deploy:   npm run deploy\n`);
}

main();
