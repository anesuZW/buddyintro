#!/usr/bin/env node
/**
 * Verify upload path limits and connectivity.
 * Usage: node scripts/verify-upload.js [--url=http://127.0.0.1:3000]
 */
const { existsSync } = require("fs");
const { join } = require("path");
const { ROOT } = require("./lib/paths");
const { MAX_UPLOAD_MB, probeUrl, mediaRootStatus, envPresent } = require("./lib/production-health-lib");

async function main() {
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  const base = (urlArg?.split("=")[1] || process.env.DEPLOY_VERIFY_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    ""
  );

  console.log("\n=== Upload path verification ===\n");
  console.log(`App upload limit: ${MAX_UPLOAD_MB} MB (lib/constants.ts)`);

  const nginxTemplate = join(ROOT, "deployment", "templates", "nginx-buddyintro.conf");
  if (existsSync(nginxTemplate)) {
    const src = require("fs").readFileSync(nginxTemplate, "utf8");
    let nginxLimit = null;
    for (const line of src.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const directive = trimmed.match(/^client_max_body_size\s+(\S+?);?\s*$/);
      if (directive) {
        nginxLimit = directive[1];
        break;
      }
    }
    console.log(`Nginx template client_max_body_size: ${nginxLimit || "not set"}`);
    if (nginxLimit && !nginxLimit.startsWith("25")) {
      console.error("✗ Nginx template body limit should be at least 25m");
      process.exitCode = 1;
    } else if (nginxLimit) {
      console.log("✓ Nginx template allows app-sized uploads");
    }
  } else {
    console.log("○ deployment/templates/nginx-buddyintro.conf not found");
  }

  console.log(`MEDIA_PROVIDER: ${process.env.MEDIA_PROVIDER || "local (default)"}`);
  const media = mediaRootStatus();
  console.log(`MEDIA_ROOT: ${media.path} (${media.exists ? "exists" : "missing"})`);
  if (!media.exists) {
    console.error("✗ MEDIA_ROOT missing");
    process.exitCode = 1;
  }

  if (envPresent("NEXT_PUBLIC_SUPABASE_URL")) {
    console.log("✓ NEXT_PUBLIC_SUPABASE_URL set (Supabase storage possible)");
  }
  if (envPresent("MEDIA_S3_BUCKET") || envPresent("MEDIA_B2_BUCKET") || envPresent("MEDIA_R2_BUCKET")) {
    console.log("✓ S3-compatible storage env present");
  }

  const health = await probeUrl(`${base}/api/health`);
  if (health.ok) {
    console.log(`✓ GET /api/health OK (${health.durationMs}ms)`);
  } else {
    console.error(`✗ Health check failed (${health.status || health.error})`);
    process.exitCode = 1;
  }

  const upload = await probeUrl(`${base}/api/media/upload`, { method: "POST" });
  if (upload.status === 401) {
    console.log("✓ POST /api/media/upload route alive (401 without session)");
  } else {
    console.log(`○ POST /api/media/upload → ${upload.status}`);
  }

  console.log("\n413 troubleshooting:");
  console.log("  • HTML 413, no X-Upload-Reject-Source header → nginx (grep nginx error.log)");
  console.log("  • JSON code=proxy_body_limit, header X-Upload-Reject-Source: proxy → proxy truncated body");
  console.log(`  • JSON code=app_body_limit, header X-Upload-Reject-Source: app → file > ${MAX_UPLOAD_MB} MB`);
  console.log("  • PM2: no 'upload request received' at failure time → nginx blocked before Next.js");
  console.log("  See docs/PRODUCTION_SERVICES.md § Proof — HTTP 413 origin");
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
