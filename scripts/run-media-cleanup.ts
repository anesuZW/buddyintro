/**
 * Nightly orphan media cleanup.
 * Usage: npm run media:cleanup
 */
import fs from "fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { runMediaCleanup } = await import("@/services/media/media-cleanup");
  const report = await runMediaCleanup({ dryRun, maxAgeHours: 24 });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
