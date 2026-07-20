#!/usr/bin/env node
/**
 * RC1 release audit — one command pre-deployment certification.
 * Usage: npm run audit:release [-- --skip-lighthouse] [-- --skip-health]
 */
const { spawnCommand } = require("./lib/exec");
const { ROOT } = require("./lib/paths");
const { verifyLocalStandaloneBuild } = require("./lib/build-integrity");
const { ensureProductionServer, stopServer } = require("./lib/audit-server");

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
  const skipLighthouse = process.argv.includes("--skip-lighthouse");
  const skipHealth = process.argv.includes("--skip-health");
  const urlArg = process.argv.find((a) => a.startsWith("--url="));

  console.log("\n╔═══════════════════════════════════════════════╗");
  console.log("║   BuddyIntro RC1 — Release Audit (audit:release) ║");
  console.log("╚═══════════════════════════════════════════════╝\n");

  console.log("→ Verify build artifacts");
  verifyLocalStandaloneBuild();
  console.log("✓ Build artifacts");

  runStep("Static certification", "npm", ["run", "certify:production"]);

  let child = null;
  let auditBase = urlArg?.split("=")[1]?.replace(/\/$/, "") || "";

  if (!auditBase) {
    const boot = await ensureProductionServer();
    auditBase = boot.base;
    child = boot.started ? boot.child : null;
    console.log(`\n✓ Production server at ${auditBase}`);
  }

  const urlFlag = [`--url=${auditBase}`];
  process.env.AUDIT_BASE_URL = auditBase;
  process.env.LHCI_PORT = new URL(auditBase).port;
  process.env.LHCI_URL = `${auditBase}/login`;

  try {
    runStep("PWA runtime audit", "node", ["scripts/audit-pwa.js", ...urlFlag]);

    if (!skipLighthouse) {
      runStep("Lighthouse CI audit", "node", ["scripts/audit-lighthouse.js", ...urlFlag]);
    } else {
      console.log("\n○ Skipped Lighthouse (--skip-lighthouse)\n");
    }

    if (!skipHealth) {
      runStep("Health check", "node", ["scripts/healthcheck.js", `--url=${auditBase}`]);
    } else {
      console.log("\n○ Skipped health check (--skip-health)\n");
    }

    console.log("\n════════════════════════════════════════");
    console.log("  RC1 RELEASE AUDIT: PASSED");
    console.log("  Safe to deploy.");
    console.log("════════════════════════════════════════\n");
  } finally {
    if (child) await stopServer(child);
  }
}

main().catch((e) => {
  console.error("\n✗ RELEASE AUDIT FAILED:", e instanceof Error ? e.message : e);
  console.error("  Fix issues, rebuild (npm run build), then rerun: npm run audit:release\n");
  process.exit(1);
});
