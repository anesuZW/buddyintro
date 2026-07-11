#!/usr/bin/env node
/**
 * Full release pipeline — build and package only (no deploy).
 * Usage: npm run release [-- --minor|--major|--no-bump|--dry-run]
 */
const { join } = require("path");
const { runNode, runNpm, runNpx, CommandError } = require("./lib/exec");
const { assertRepoRoot } = require("./lib/repo-root");
const { parseReleaseArgs, readVersion, writeVersion, bumpVersion } = require("./lib/version");
const { ensureChangelog } = require("./lib/changelog");
const { verifyReleasePackage } = require("./lib/package-verify");
const { ROOT } = require("./lib/paths");

const args = parseReleaseArgs(process.argv.slice(2));

function step(index, total, name, fn) {
  console.log(`\n[${index}/${total}] ${name}…`);
  if (!args.dryRun) fn();
}

function main() {
  console.log("\n=== BuddyIntro Release ===\n");
  console.log(`cwd: ${process.cwd()}`);
  assertRepoRoot();
  console.log("  ✓ package.json and package-lock.json found\n");

  if (args.dryRun) console.log("(dry-run mode — destructive steps skipped)\n");

  let version = readVersion();
  if (!args.skipBump) {
    version = bumpVersion(version, args.bump);
    if (!args.dryRun) writeVersion(version);
    console.log(`Version: ${version} (${args.bump} bump)`);
  } else {
    console.log(`Version: ${version} (no bump)`);
  }

  const total = 9;

  step(1, total, "Clean", () => runNode(["scripts/clean.js"]));
  step(2, total, "Install dependencies", () => runNpm(["install"]));
  step(3, total, "Prisma generate", () => runNpx(["prisma", "generate"]));
  step(4, total, "Lint, typecheck, and tests", () => runNode(["scripts/verify.js"]));
  step(5, total, "Production build", () => runNpm(["run", "build"]));
  step(6, total, "Create deployment package", () =>
    runNode(["deployment/package.js", `--version=${version}`])
  );
  step(7, total, "Generate CHANGELOG and release notes", () => {
    const { changelogPath, notesPath } = ensureChangelog(version);
    console.log(`  ✓ ${changelogPath.replace(ROOT, ".")}`);
    console.log(`  ✓ ${notesPath.replace(ROOT, ".")}`);
  });
  step(8, total, "Verify deployment package", () => {
    const { zipPath, size } = verifyReleasePackage(version);
    console.log(`  ✓ ${zipPath.replace(ROOT, ".")} (${Math.round(size / 1024 / 1024)} MB)`);
  });

  console.log(`\n[${total}/${total}] Release complete`);
  const zip = join(ROOT, "deployment", "releases", `BuddyIntro-v${version}.zip`);
  console.log("\n=== Release complete ===");
  console.log(`Version:  v${version}`);
  console.log(`Package:  ${args.dryRun ? "(dry-run)" : zip.replace(ROOT, ".")}`);
  console.log(`Next:     npm run publish\n`);
}

try {
  main();
} catch (err) {
  console.error("\nRelease failed:");
  if (err instanceof CommandError) console.error(err.format());
  else console.error(err.message);
  process.exit(1);
}
