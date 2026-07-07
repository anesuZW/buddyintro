#!/usr/bin/env node
/**
 * Full release pipeline.
 * Usage: npm run release [-- --minor|--major|--no-bump|--commit|--push|--dry-run]
 */
const { existsSync } = require("fs");
const { join } = require("path");
const { runNode, runNpm, runNpx, runGit, CommandError } = require("./lib/exec");
const { parseReleaseArgs, readVersion, writeVersion, bumpVersion } = require("./lib/version");
const { generateReleaseNotes } = require("./lib/release-notes");
const { ROOT } = require("./lib/paths");

const args = parseReleaseArgs(process.argv.slice(2));

function main() {
  console.log("\n=== BuddyIntro Release ===\n");
  if (args.dryRun) console.log("(dry-run mode)\n");

  let version = readVersion();
  if (!args.skipBump) {
    version = bumpVersion(version, args.bump);
    if (!args.dryRun) writeVersion(version);
    console.log(`Version: ${version} (${args.bump} bump)`);
  } else {
    console.log(`Version: ${version} (no bump)`);
  }

  const steps = [
    ["Clean", () => runNode(["scripts/clean.js"])],
    ["Install dependencies", () => runNpm(["install"])],
    ["Prisma generate", () => runNpx(["prisma", "generate"])],
    ["Verify", () => runNode(["scripts/verify.js"])],
    ["Production build", () => runNpm(["run", "build"])],
    ["Deployment package", () => runNode(["deployment/package.js", `--version=${version}`])],
  ];

  steps.forEach(([name, fn], i) => {
    console.log(`\n[${i + 1}/${steps.length + 2}] ${name}…`);
    if (!args.dryRun) fn();
  });

  console.log(`\n[${steps.length + 1}/${steps.length + 2}] Release notes…`);
  const { notesPath } = generateReleaseNotes(version);
  console.log(`  ✓ ${notesPath.replace(ROOT, ".")}`);

  if (args.commit && !args.dryRun) {
    console.log(`\n[${steps.length + 2}/${steps.length + 2}] Git commit…`);
    runGit(["add", "package.json", "package-lock.json", "deployment/"]);
    runGit(["commit", "-m", `Release v${version}`]);
    if (args.push) {
      runGit(["tag", "-a", `v${version}`, "-m", `Release v${version}`]);
      runGit(["push"]);
      runGit(["push", "origin", `v${version}`]);
    }
  } else {
    console.log(`\n[${steps.length + 2}/${steps.length + 2}] Git skipped (use --commit --push)`);
  }

  const zip = join(ROOT, "deployment", "releases", `BuddyIntro-v${version}.zip`);
  console.log("\n=== Release complete ===");
  console.log(`Version:  v${version}`);
  console.log(`Package:  ${!args.dryRun && existsSync(zip) ? zip.replace(ROOT, ".") : "(see dry-run)"}`);
  console.log(`Notes:    deployment/releases/RELEASE_NOTES_v${version}.md\n`);
}

try {
  main();
} catch (err) {
  console.error("\nRelease failed:");
  if (err instanceof CommandError) console.error(err.format());
  else console.error(err.message);
  process.exit(1);
}
