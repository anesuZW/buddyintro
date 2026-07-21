#!/usr/bin/env node
/**
 * Post-deploy verification: running /api/version commit must equal git HEAD.
 * Usage: npm run deploy:verify-runtime [-- --url=http://127.0.0.1:3000]
 */
const { spawnCommand } = require("./lib/exec");
const { ROOT } = require("./lib/paths");

async function main() {
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  const port = process.env.PORT || "3000";
  const base = (urlArg?.split("=")[1] || process.env.DEPLOY_VERIFY_URL || `http://127.0.0.1:${port}`).replace(
    /\/$/,
    ""
  );

  const headResult = spawnCommand("git", ["rev-parse", "HEAD"], { cwd: ROOT, capture: true });
  if (headResult.status !== 0) {
    throw new Error("git rev-parse HEAD failed");
  }
  const head = (headResult.stdout || "").trim();

  console.log(`\n=== Deployment runtime verification ===\n`);
  console.log(`Git HEAD:     ${head.slice(0, 7)} (${head})`);
  console.log(`Querying:     ${base}/api/version\n`);

  const res = await fetch(`${base}/api/version`, {
    signal: AbortSignal.timeout(30_000),
    headers: { Accept: "application/json" },
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(`/api/version HTTP ${res.status}: ${JSON.stringify(body)}`);
  }

  const runtime = body.commit;
  if (!runtime) {
    throw new Error("/api/version response missing commit field");
  }

  console.log(`Runtime:      ${runtime.slice(0, 7)} (${runtime})`);

  if (runtime !== head) {
    console.error("\n✗ DEPLOYMENT VERIFICATION FAILED");
    console.error(`  Expected commit ${head.slice(0, 7)} but server reports ${runtime.slice(0, 7)}`);
    console.error("  The running process is serving a stale standalone bundle.\n");
    process.exit(1);
  }

  console.log("\n✓ Deployment verification passed — runtime matches git HEAD\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
