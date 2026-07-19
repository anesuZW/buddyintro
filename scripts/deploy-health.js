#!/usr/bin/env node
/** Remote health check wrapper. */
const { loadEnvFiles, getDeployConfig } = require("./lib/deploy-config");
const { pollHealth } = require("./lib/health-poll");

loadEnvFiles();

async function main() {
  const config = getDeployConfig();
  console.log(`\n=== BuddyIntro Deploy Health ===\nHealth URL: ${config.healthUrl}\n`);
  const result = await pollHealth(config.healthUrl, {
    maxMs: config.healthMaxMs,
    pollMs: config.healthPollMs,
  });
  if (!result.ok) {
    console.error("Health check failed:", result.lastBody || result.error);
    process.exit(1);
  }
  console.log("✓ Health check passed\n", result.lastBody || "");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
