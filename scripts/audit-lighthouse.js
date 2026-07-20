#!/usr/bin/env node
/**
 * Lighthouse audit for RC1 release validation (programmatic, Windows-safe).
 * Usage: npm run audit:lighthouse [-- --url=http://localhost:3001]
 */
const { verifyLocalStandaloneBuild } = require("./lib/build-integrity");
const { ensureProductionServer, stopServer } = require("./lib/audit-server");
const { runLighthouseAudit } = require("./lib/lighthouse-audit");

async function main() {
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  const base = (urlArg?.split("=")[1] || process.env.AUDIT_BASE_URL || "").replace(/\/$/, "");

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   BuddyIntro RC1 — Lighthouse CI Audit   ║");
  console.log("╚══════════════════════════════════════════╝\n");

  verifyLocalStandaloneBuild({ quiet: true });

  let child = null;
  let auditBase = base;

  if (!auditBase) {
    const boot = await ensureProductionServer();
    auditBase = boot.base;
    child = boot.started ? boot.child : null;
    if (boot.started) console.log(`Started production server at ${auditBase}\n`);
  } else {
    console.log(`Using server at ${auditBase}\n`);
  }

  const loginUrl = `${auditBase}/login`;

  try {
    await runLighthouseAudit(loginUrl);
    console.log("\n✓ Lighthouse audit passed\n");
  } finally {
    if (child) await stopServer(child);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
