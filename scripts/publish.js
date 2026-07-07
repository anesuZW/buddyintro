#!/usr/bin/env node
/**
 * Publish a built release to GitHub.
 *
 * Prerequisites:
 *   npm run release -- --no-bump   (or --patch / --minor / --major)
 *
 * Usage:
 *   npm run publish
 *
 * Stops on any failure. Never overwrites existing tags or GitHub releases.
 */
const { existsSync, statSync } = require("fs");
const { join } = require("path");
const { ROOT, RELEASES_DIR } = require("./lib/paths");
const { readVersion } = require("./lib/version");
const {
  assertReleaseReadyWorkingTree,
  tagExists,
  remoteTagExists,
  commitRelease,
  tagRelease,
  pushRelease,
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
    if (err instanceof CommandError) {
      console.error(err.format());
    } else {
      console.error(`  ${err.message}`);
    }
    process.exit(1);
  }
}

function main() {
  console.log("\n=== BuddyIntro Publish ===\n");

  const version = step("Read version", () => readVersion());
  const zipPath = join(RELEASES_DIR, `BuddyIntro-v${version}.zip`);
  const tag = `v${version}`;

  step("Verify release package exists", () => {
    if (!existsSync(zipPath)) {
      throw new Error(
        `Package not found: deployment/releases/BuddyIntro-v${version}.zip\n` +
          "Run: npm run release -- --no-bump"
      );
    }
    const size = statSync(zipPath).size;
    if (size < 100_000) {
      throw new Error(`Package too small (${size} bytes) — likely corrupt. Re-run npm run release.`);
    }
    console.log(`  ✓ BuddyIntro-v${version}.zip (${Math.round(size / 1024 / 1024)} MB)`);
  });

  step("Verify tag does not exist", () => {
    if (tagExists(version)) throw new Error(`Local tag ${tag} already exists`);
    if (remoteTagExists(version)) throw new Error(`Remote tag ${tag} already exists on origin`);
    console.log(`  ✓ ${tag} is available`);
  });

  step("Verify GitHub release does not exist", () => {
    assertGhInstalled();
    assertGhAuthenticated();
    if (releaseExists(version)) {
      throw new Error(`GitHub Release ${tag} already exists — refusing to overwrite`);
    }
    console.log(`  ✓ No existing GitHub Release for ${tag}`);
  });

  step("Verify git working tree is clean", () => {
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
    console.log("  ✓ CHANGELOG and release notes staged for commit");
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

  step("Git tag", () => {
    tagRelease(version);
    console.log(`  ✓ Tagged ${tag}`);
  });

  step("Git push", () => {
    pushRelease();
    console.log("  ✓ Pushed branch and tags");
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
    console.log(`  ✓ GitHub Release ${tag} created with ZIP + CHANGELOG + release notes`);
  });

  console.log("\n=== Publish complete ===");
  console.log(`Version:  ${tag}`);
  console.log(`Package:  deployment/releases/BuddyIntro-v${version}.zip`);
  console.log(`Deploy:   npm run deploy\n`);
}

main();
