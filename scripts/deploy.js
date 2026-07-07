#!/usr/bin/env node
/**
 * Deploy to InterServer via SSH (public-key auth only).
 *
 * Required env (.env / .env.local):
 *   DEPLOY_SSH_HOST, DEPLOY_SSH_USER, DEPLOY_SSH_KEY
 *   DEPLOY_APP_PATH (default ~/buddyintro)
 *   DEPLOY_HEALTH_URL or NEXT_PUBLIC_APP_URL
 *
 * Usage: npm run deploy [-- --tag=v0.1.0]
 */
const { sshExec, remoteScript } = require("./lib/ssh");
const { getDeployConfig } = require("./lib/deploy-config");
const { CommandError } = require("./lib/exec");

const tagArg = process.argv.find((a) => a.startsWith("--tag="));
const deployTag = tagArg ? tagArg.split("=")[1] : null;

async function waitForHealth(url, maxMs, intervalMs) {
  const deadline = Date.now() + maxMs;
  let lastError = "unknown";

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
      } else {
        const body = await res.json();
        if (body.status === "healthy" || body.status === "degraded") {
          return body;
        }
        lastError = `status=${body.status}`;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    console.log(`  … waiting for health (${lastError})`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Health check did not pass within ${maxMs}ms — last error: ${lastError}`);
}

async function main() {
  console.log("\n=== BuddyIntro Deploy (InterServer) ===\n");

  let config;
  try {
    config = getDeployConfig();
  } catch (err) {
    console.error(`✗ Configuration error: ${err.message}`);
    process.exit(1);
  }

  if (!config.healthUrl) {
    console.error("✗ Set DEPLOY_HEALTH_URL or NEXT_PUBLIC_APP_URL for post-deploy verification");
    process.exit(1);
  }

  console.log(`Host:    ${config.user}@${config.host}:${config.port}`);
  console.log(`App:     ${config.appPath}`);
  console.log(`Health:  ${config.healthUrl}`);
  console.log(`Auth:    SSH key only (${config.keyPath})`);
  if (deployTag) console.log(`Tag:     v${deployTag.replace(/^v/, "")}`);

  const app = config.appPath;
  const steps = [];

  if (deployTag) {
    const tag = deployTag.startsWith("v") ? deployTag : `v${deployTag}`;
    steps.push({
      name: `Checkout tag ${tag}`,
      cmd: remoteScript(app, ["git fetch --tags", `git checkout ${tag}`]),
    });
  } else {
    steps.push({
      name: "Git pull",
      cmd: remoteScript(app, ["git pull"]),
    });
  }

  steps.push(
    { name: "npm ci --omit=dev", cmd: remoteScript(app, ["npm ci --omit=dev"]) },
    { name: "Prisma generate", cmd: remoteScript(app, ["npx prisma generate"]) },
    { name: "Prisma migrate deploy", cmd: remoteScript(app, ["npx prisma migrate deploy"]) },
    { name: "Restart Passenger", cmd: remoteScript(app, ["mkdir -p tmp", "touch tmp/restart.txt"]) }
  );

  for (const step of steps) {
    try {
      sshExec(step.cmd, step.name);
      console.log(`  ✓ ${step.name}`);
    } catch (err) {
      console.error("\n✗ DEPLOYMENT FAILED");
      console.error(`  Step: ${err.step || step.name}`);
      if (err instanceof CommandError) console.error(err.format());
      else console.error(`  Error: ${err.message}`);
      console.error("\nNo automatic rollback was performed.");
      process.exit(1);
    }
  }

  console.log(`\n→ Waiting ${config.passengerWaitMs}ms for Passenger restart…`);
  await new Promise((r) => setTimeout(r, config.passengerWaitMs));

  try {
    console.log(`→ Verifying ${config.healthUrl}`);
    const health = await waitForHealth(config.healthUrl, 120_000, 5000);
    console.log(`  ✓ /api/health → ${health.status}`);
  } catch (err) {
    console.error("\n✗ DEPLOYMENT FAILED");
    console.error("  Step:    Health verification");
    console.error(`  URL:     ${config.healthUrl}`);
    console.error(`  Error:   ${err.message}`);
    console.error("\nServer commands completed but health check failed.");
    console.error("No automatic rollback was performed.");
    process.exit(1);
  }

  console.log("\n=== Deploy complete ===\n");
}

main().catch((err) => {
  console.error("\n✗ Unexpected deploy error:", err.message);
  process.exit(1);
});
