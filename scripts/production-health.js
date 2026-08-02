#!/usr/bin/env node
/**
 * Combined production services health report.
 * Usage: node scripts/production-health.js [--url=http://127.0.0.1:3000]
 */
const { spawnCommand } = require("./lib/exec");
const { ROOT } = require("./lib/paths");
const { checkEnv, envPresent, probeUrl, mediaRootStatus, MAX_UPLOAD_MB } = require("./lib/production-health-lib");

function runScript(script, args = []) {
  const result = spawnCommand("node", [script, ...args], { cwd: ROOT, capture: true });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

async function main() {
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  const urlFlag = urlArg ? [urlArg] : [];

  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   BuddyIntro — Production Services Health ║");
  console.log("╚══════════════════════════════════════════╝");

  console.log("\n── Environment (presence only) ──\n");
  const envChecks = [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_APP_URL",
    "MEDIA_PROVIDER",
    "MEDIA_ROOT",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "SMTP_HOST",
    "REDIS_URL",
  ];
  for (const name of envChecks) {
    console.log(`${envPresent(name) ? "✓" : "○"} ${name}`);
  }
  console.log(`\nUpload limit: ${MAX_UPLOAD_MB} MB`);

  const media = mediaRootStatus();
  console.log(`Media root: ${media.path} (${media.exists ? "ok" : "MISSING"})`);

  const base = (urlArg?.split("=")[1] || "http://127.0.0.1:3000").replace(/\/$/, "");
  const version = await probeUrl(`${base}/api/version`);
  if (version.ok) {
    console.log(`Runtime: ${base}/api/version → ${version.status}`);
  } else {
    console.error(`Runtime: ${base}/api/version unreachable (${version.error || version.status})`);
  }

  let failed = 0;
  console.log("\n── Voice / audio ──");
  failed += runScript("scripts/verify-audio.js", urlFlag) !== 0 ? 1 : 0;

  console.log("\n── Uploads ──");
  failed += runScript("scripts/verify-upload.js", urlFlag) !== 0 ? 1 : 0;

  console.log("\n── Email ──");
  failed += runScript("scripts/verify-email.js") !== 0 ? 1 : 0;

  console.log("\n════════════════════════════════════════");
  if (failed) {
    console.error(`  HEALTH CHECK: ${failed} section(s) failed`);
    process.exit(1);
  }
  console.log("  HEALTH CHECK: ALL SECTIONS PASSED");
  console.log("════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
