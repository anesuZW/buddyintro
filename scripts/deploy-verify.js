#!/usr/bin/env node
/** Pre-deploy verification: build integrity, migrations, env, git state. */
const { loadEnvFiles } = require("./lib/deploy-config");
const { verifyLocalStandaloneBuild } = require("./lib/build-integrity");
const { fetchOrigin, getLocalSHA, getOriginSHA, verifyAllShas } = require("./lib/git-integrity");
const { getDeployConfig } = require("./lib/deploy-config");
const { execSync } = require("child_process");

loadEnvFiles();

async function main() {
  console.log("\n=== BuddyIntro Deploy Verify ===\n");
  const config = getDeployConfig();

  console.log("→ Validating migrations");
  execSync("node scripts/validate-migrations.js", { stdio: "inherit" });

  console.log("→ Verifying local build artifacts");
  verifyLocalStandaloneBuild();

  console.log("→ Checking git integrity");
  await fetchOrigin(config.gitRepoUrl, config.branch);
  const localSha = getLocalSHA();
  const originSha = await getOriginSHA(config.gitRepoUrl, config.branch);
  verifyAllShas({ localSha, originSha, targetSha: config.commitSha });

  console.log("\n✓ Deploy verification passed\n");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
