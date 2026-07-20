#!/usr/bin/env node
/**
 * Runtime PWA audit against the production build.
 * Usage: npm run audit:pwa [-- --url=http://localhost:3000] [-- --no-browser]
 */
const { verifyLocalStandaloneBuild } = require("./lib/build-integrity");
const { ensureProductionServer, stopServer } = require("./lib/audit-server");
const {
  buildArtifactChecks,
  buildHttpChecks,
  buildSwSourceChecks,
  runBrowserPwaAudit,
  runChecks,
} = require("./lib/pwa-runtime-checks");

async function main() {
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  const skipBrowser = process.argv.includes("--no-browser");
  const base = (urlArg?.split("=")[1] || process.env.AUDIT_BASE_URL || "").replace(/\/$/, "");

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   BuddyIntro RC1 — PWA Runtime Audit ║");
  console.log("╚══════════════════════════════════════╝");

  verifyLocalStandaloneBuild({ quiet: true });

  let child = null;
  let auditBase = base;
  let bootPort;

  if (auditBase) {
    console.log(`\nUsing server at ${auditBase}\n`);
    bootPort = new URL(auditBase).port;
  } else {
    const boot = await ensureProductionServer();
    auditBase = boot.base;
    child = boot.child;
    bootPort = boot.port;
    if (boot.started) console.log(`\nStarted production server at ${auditBase}\n`);
  }

  process.env.AUDIT_BASE_URL = auditBase;
  process.env.LHCI_PORT = String(bootPort);

  try {
    const allResults = [];

    allResults.push(...(await runChecks(buildArtifactChecks(), "Build artifacts")));
    allResults.push(...(await runChecks(buildSwSourceChecks(), "Service worker (built)")));
    allResults.push(...(await runChecks(buildHttpChecks(auditBase), "HTTP runtime")));

    if (!skipBrowser) {
      console.log("\n=== Browser runtime (headless Chrome) ===\n");
      try {
        const browserResult = await runBrowserPwaAudit(auditBase);
        console.log(`  ✓ Service Worker registered (${browserResult.registration.scriptURL})`);
        console.log(`  ✓ Cache Storage: ${browserResult.cacheNames.join(", ")}`);
        console.log(`  ✓ Manifest link: ${browserResult.manifestHref}`);
        console.log(`  ✓ SKIP_WAITING handler accepted`);
        allResults.push({ name: "browser: SW registration", ok: true });
        allResults.push({ name: "browser: Cache Storage", ok: true });
        allResults.push({ name: "browser: manifest link", ok: true });
        allResults.push({ name: "browser: update flow (SKIP_WAITING)", ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ✗ Browser audit: ${msg}`);
        allResults.push({ name: "browser: runtime", ok: false, error: msg });
      }
    }

    const failed = allResults.filter((r) => !r.ok);
    console.log(
      `\n${failed.length ? "FAILED" : "PASSED"} — ${allResults.length - failed.length}/${allResults.length} checks OK\n`
    );

    if (failed.length) {
      process.exit(1);
    }
  } finally {
    if (child) await stopServer(child);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
