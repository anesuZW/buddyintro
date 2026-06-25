/**
 * Operational health check for monitoring / CI.
 * Usage: npm run health-check
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
  const { runHealthChecks } = await import("@/services/health");
  const health = await runHealthChecks();

  console.log("\n=== FriendIntro Health Check ===\n");
  console.log(`Overall: ${health.status}`);
  console.log(`Database: ${health.database}`);
  console.log(`Storage: ${health.storage}`);
  console.log(`Queue: ${health.queue}`);
  console.log(`Analytics: ${health.analytics}`);
  console.log(`Graph: ${health.graph}`);
  console.log("\nDetails:");
  for (const [k, v] of Object.entries(health.details)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\nChecked at: ${health.checkedAt}\n`);

  if (health.status === "unhealthy") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
