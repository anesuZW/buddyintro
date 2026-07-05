#!/usr/bin/env node
/**
 * Create production deployment ZIP.
 * Usage: node deployment/package.js [--version=0.1.0]
 */
const {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  statSync,
} = require("fs");
const { join } = require("path");
const { spawnSync } = require("child_process");
const {
  ROOT,
  RELEASES_DIR,
  STAGING_DIR,
  PRODUCTION_INCLUDES,
} = require("../scripts/lib/paths");

function readVersion() {
  const arg = process.argv.find((a) => a.startsWith("--version="));
  if (arg) return arg.split("=")[1];
  return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
}

function fillTemplate(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function createZip(sourceDir, zipPath) {
  if (process.platform === "win32") {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const ps = `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force`;
      const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
      if (r.status === 0 && existsSync(zipPath) && statSync(zipPath).size > 100_000) return;
      if (attempt < 3) {
        console.warn(`  Zip attempt ${attempt} failed — retrying in 2s…`);
        spawnSync("powershell", ["-Command", "Start-Sleep -Seconds 2"], { stdio: "ignore" });
      }
    }
    throw new Error("Compress-Archive failed after 3 attempts");
  }
  if (spawnSync("zip", ["--version"], { stdio: "ignore" }).status === 0) {
    const r = spawnSync("zip", ["-r", zipPath, "."], { cwd: sourceDir, stdio: "inherit" });
    if (r.status !== 0) throw new Error("zip failed");
    return;
  }
  throw new Error("No zip tool found (install zip on Linux/macOS)");
}

function main() {
  const version = readVersion();
  if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) {
    console.error("ERROR: No production build. Run `npm run build` first.");
    process.exit(1);
  }

  console.log(`Packaging BuddyIntro v${version}…`);

  if (existsSync(STAGING_DIR)) rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true });
  mkdirSync(RELEASES_DIR, { recursive: true });

  for (const item of PRODUCTION_INCLUDES) {
    const src = join(ROOT, item);
    if (!existsSync(src)) {
      console.error(`ERROR: Missing ${item}`);
      process.exit(1);
    }
    cpSync(src, join(STAGING_DIR, item), { recursive: true });
    console.log(`  ✓ ${item}`);
  }

  const template = readFileSync(
    join(ROOT, "deployment", "templates", "README_DEPLOY.md"),
    "utf8"
  );
  writeFileSync(
    join(STAGING_DIR, "README_DEPLOY.md"),
    fillTemplate(template, {
      VERSION: version,
      GENERATED_AT: new Date().toISOString(),
    })
  );
  console.log("  ✓ README_DEPLOY.md");

  const zipName = `BuddyIntro-v${version}.zip`;
  const zipPath = join(RELEASES_DIR, zipName);
  if (existsSync(zipPath)) rmSync(zipPath);
  createZip(STAGING_DIR, zipPath);
  rmSync(STAGING_DIR, { recursive: true, force: true });

  console.log(`\n✓ Package created: deployment/releases/${zipName}\n`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
