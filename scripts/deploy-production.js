#!/usr/bin/env node
/**
 * Deterministic VPS production deploy:
 *   git pull → npm install → prisma generate → npm run build → pm2 restart → verify runtime
 *
 * Usage: npm run deploy:production
 */
const { spawnCommand } = require("./lib/exec");
const { ROOT } = require("./lib/paths");

function runStep(label, command, args, env = {}) {
  console.log(`\n→ ${label}`);
  const result = spawnCommand(command, args, { cwd: ROOT, capture: true, env: { ...process.env, ...env } });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
  console.log(`✓ ${label}`);
}

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   BuddyIntro — Production Deploy         ║");
  console.log("╚══════════════════════════════════════════╝");

  runStep("Git pull", "git", ["pull", "--ff-only"]);
  runStep("Install dependencies", "npm", ["install"]);
  runStep("Prisma generate", "npx", ["prisma", "generate"]);
  runStep("Production build", "npm", ["run", "build"]);
  runStep("PM2 restart", "npx", ["pm2", "restart", "ecosystem.config.js", "--update-env"]);
  runStep("Runtime verification", "node", ["scripts/verify-deployment.js"]);

  console.log("\n════════════════════════════════════════");
  console.log("  PRODUCTION DEPLOY: VERIFIED");
  console.log("════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n✗ PRODUCTION DEPLOY FAILED:", err instanceof Error ? err.message : err);
  console.error("  Fix the issue above and rerun: npm run deploy:production\n");
  process.exit(1);
});
