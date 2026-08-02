#!/usr/bin/env node
/**
 * Verify voice note recording prerequisites in production config.
 * Usage: node scripts/verify-audio.js [--url=http://127.0.0.1:3000]
 */
const {
  readPermissionsPolicyFromNextConfig,
  microphoneAllowedInPolicy,
  probeUrl,
  mediaRootStatus,
} = require("./lib/production-health-lib");

async function main() {
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  const base = (urlArg?.split("=")[1] || process.env.DEPLOY_VERIFY_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );

  console.log("\n=== Voice note / audio recording verification ===\n");

  const policy = readPermissionsPolicyFromNextConfig();
  const micOk = microphoneAllowedInPolicy(policy);
  console.log(`Permissions-Policy (next.config.js): ${policy || "not found"}`);
  if (micOk === true) {
    console.log("✓ microphone=(self) — browser recording allowed");
  } else if (micOk === false) {
    console.error("✗ microphone blocked by Permissions-Policy — voice recording will fail");
    process.exitCode = 1;
  } else {
    console.log("○ Could not determine microphone policy");
  }

  const media = mediaRootStatus();
  console.log(`MEDIA_ROOT: ${media.path} (${media.exists ? "exists" : "missing"})`);
  if (!media.exists) {
    console.error("✗ MEDIA_ROOT directory missing — audio uploads will fail on local provider");
    process.exitCode = 1;
  } else {
    console.log("✓ MEDIA_ROOT reachable");
  }

  const headers = await probeUrl(base, { method: "HEAD" });
  if (headers.ok || headers.status === 405) {
    console.log(`✓ App reachable at ${base}`);
  } else {
    console.error(`✗ App not reachable (${headers.status || headers.error})`);
    process.exitCode = 1;
  }

  const uploadProbe = await probeUrl(`${base}/api/media/upload`, { method: "POST" });
  if (uploadProbe.status === 401) {
    console.log("✓ POST /api/media/upload responds (401 without auth — route alive)");
  } else {
    console.log(`○ POST /api/media/upload status ${uploadProbe.status}`);
  }

  console.log("\nBrowser checklist:");
  console.log("  • MediaRecorder + getUserMedia supported");
  console.log("  • User grants microphone permission");
  console.log("  • Upload kind=audio with correct ext (webm or mp4 on Safari)");
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
