#!/usr/bin/env node
/**
 * Rollback production to a previous git tag via SSH.
 *
 * Usage:
 *   npm run rollback
 *   npm run rollback -- --tag=v0.1.0
 *   npm run rollback -- --list
 */
const readline = require("readline");
const { listVersionTags } = require("./lib/git");
const { sshExec } = require("./lib/ssh");
const { getDeployConfig } = require("./lib/deploy-config");
const { readVersion } = require("./lib/version");

async function waitForHealth(url, maxMs) {
  const deadline = Date.now() + maxMs;
  let lastError = "unknown";

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const body = await res.json();
        if (body.status === "healthy" || body.status === "degraded") return body;
        lastError = `status=${body.status}`;
      } else {
        lastError = `HTTP ${res.status}`;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Health check failed: ${lastError}`);
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function selectTag(tags, currentVersion) {
  const listArg = process.argv.includes("--list");
  const tagArg = process.argv.find((a) => a.startsWith("--tag="));

  if (tagArg) {
    return tagArg.split("=")[1].replace(/^v/, "");
  }

  console.log("\nAvailable releases:\n");
  tags.forEach((v, i) => {
    const marker = v === currentVersion ? " (current)" : "";
    console.log(`  [${i + 1}] v${v}${marker}`);
  });

  if (listArg) process.exit(0);

  const currentIdx = tags.indexOf(currentVersion);
  const defaultIdx = currentIdx > 0 ? currentIdx - 1 : tags.length > 1 ? 1 : 0;
  const defaultTag = tags[defaultIdx];

  const answer = await prompt(
    `\nSelect release to rollback to [1-${tags.length}] (default: v${defaultTag}): `
  );

  if (!answer) return defaultTag;

  const num = Number(answer);
  if (Number.isFinite(num) && num >= 1 && num <= tags.length) {
    return tags[num - 1];
  }

  const cleaned = answer.replace(/^v/, "");
  if (tags.includes(cleaned)) return cleaned;

  throw new Error(`Invalid selection: ${answer}`);
}

async function main() {
  console.log("\n=== BuddyIntro Rollback ===\n");

  let config;
  try {
    config = getDeployConfig();
  } catch (err) {
    console.error(`✗ Configuration error: ${err.message}`);
    process.exit(1);
  }

  if (!config.healthUrl) {
    console.error("✗ Set DEPLOY_HEALTH_URL or NEXT_PUBLIC_APP_URL");
    process.exit(1);
  }

  const tags = listVersionTags();
  if (tags.length < 2) {
    console.error("✗ Need at least 2 version tags to rollback.");
    process.exit(1);
  }

  const currentVersion = readVersion();
  let targetVersion;
  try {
    targetVersion = await selectTag(tags, currentVersion);
  } catch (err) {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  }

  const tag = `v${targetVersion}`;
  const app = config.appPath;

  console.log(`\nRolling back to ${tag} on ${config.host}…\n`);

  const steps = [
    { name: `Checkout ${tag}`, cmd: `cd ${app} && git fetch --tags && git checkout ${tag}` },
    { name: "npm ci --omit=dev", cmd: `cd ${app} && npm ci --omit=dev` },
    { name: "Prisma generate", cmd: `cd ${app} && npx prisma generate` },
    { name: "Restart Passenger", cmd: `cd ${app} && mkdir -p tmp && touch tmp/restart.txt` },
  ];

  for (const step of steps) {
    try {
      sshExec(step.cmd, step.name);
      console.log(`  ✓ ${step.name}`);
    } catch (err) {
      console.error("\n✗ ROLLBACK FAILED");
      console.error(`  Step:    ${err.step || step.name}`);
      console.error(`  Command: ${err.command || step.cmd}`);
      console.error(`  Error:   ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n→ Waiting ${config.passengerWaitMs}ms for Passenger…`);
  await new Promise((r) => setTimeout(r, config.passengerWaitMs));

  try {
    const health = await waitForHealth(config.healthUrl, 120_000);
    console.log(`  ✓ /api/health → ${health.status}`);
  } catch (err) {
    console.error("\n✗ ROLLBACK FAILED at health verification");
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  console.log("\n=== Rollback successful ===");
  console.log(`Active version on server: ${tag}`);
  console.log(`Health: ${config.healthUrl}\n`);
}

main().catch((err) => {
  console.error("\n✗ Unexpected rollback error:", err.message);
  process.exit(1);
});
