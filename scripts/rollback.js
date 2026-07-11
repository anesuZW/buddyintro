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
const { sshExec, verifySshReachable } = require("./lib/ssh");
const { getDeployConfig } = require("./lib/deploy-config");
const { readVersion } = require("./lib/version");
const { pollHealth } = require("./lib/health-poll");
const { rollbackToRefCommand } = require("./lib/remote-deploy");
const { DeployLogger } = require("./lib/deploy-logger");
const { CommandError } = require("./lib/exec");

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
  const logger = new DeployLogger();
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

  verifySshReachable(config);

  const tags = listVersionTags();
  if (tags.length < 1) {
    console.error("✗ No version tags found.");
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

  const tag = targetVersion.startsWith("v") ? targetVersion : `v${targetVersion}`;
  const app = config.appPath;

  console.log(`\nRolling back to ${tag} on ${config.host}…\n`);

  try {
    sshExec(rollbackToRefCommand(app, tag), `Rollback to ${tag}`, logger);
    console.log(`  ✓ Checked out ${tag}`);

    const health = await pollHealth(config.healthUrl, {
      maxMs: config.healthPollMaxMs,
      intervalMs: config.healthPollIntervalMs,
      onWait: (err) => console.log(`  … waiting (${err})`),
    });

    if (!health.ok) {
      logger.finalize("ROLLBACK_FAILED");
      console.error("\n✗ ROLLBACK FAILED at health verification");
      console.error(`  ${health.error}`);
      console.error("\n=== MANUAL INTERVENTION REQUIRED ===");
      process.exit(1);
    }

    logger.finalize("ROLLBACK_SUCCESS");
    console.log(`  ✓ /api/health → ${health.status}`);
    console.log("\n=== Rollback successful ===");
    console.log(`Active version on server: ${tag}`);
    console.log(`Health: ${config.healthUrl}\n`);
  } catch (err) {
    console.error("\n✗ ROLLBACK FAILED");
    if (err instanceof CommandError) console.error(err.format());
    else console.error(`  ${err.message}`);
    logger.finalize("ROLLBACK_FAILED");
    console.error("\n=== MANUAL INTERVENTION REQUIRED ===");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n✗ Unexpected rollback error:", err.message);
  process.exit(1);
});
