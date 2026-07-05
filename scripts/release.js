#!/usr/bin/env node
/**
 * Full release pipeline.
 * Usage: npm run release [-- --minor|--major|--no-bump|--commit|--push|--dry-run]
 */
const { existsSync } = require("fs");
const { join } = require("path");
const { run, runCapture } = require("./lib/exec");
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
    ["Clean", () => run("node", ["scripts/clean.js"])],
    ["Install dependencies", () => run("npm", ["install"])],
    ["Prisma generate", () => run("npx", ["prisma", "generate"])],
    ["Verify", () => run("node", ["scripts/verify.js"])],
    ["Production build", () => run("npm", ["run", "build"])],
    ["Deployment package", () => run("node", ["deployment/package.js", `--version=${version}`])],
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
    run("git", ["add", "package.json", "package-lock.json", "deployment/"]);
    run("git", ["commit", "-m", `Release v${version}`]);
    if (args.push) {
      run("git", ["tag", "-a", `v${version}`, "-m", `Release v${version}`]);
      run("git", ["push"]);
      run("git", ["push", "origin", `v${version}`]);
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
  console.error("\nRelease failed:", err.message);
  process.exit(1);
}
