#!/usr/bin/env node
/**
 * Verify email provider configuration (presence only — never prints secrets).
 * Usage: node scripts/verify-email.js
 */
const { checkEnv, envPresent } = require("./lib/production-health-lib");

async function main() {
  console.log("\n=== Email / invitation delivery verification ===\n");

  const required = checkEnv(["RESEND_API_KEY", "EMAIL_FROM", "NEXT_PUBLIC_APP_URL"]);
  const smtp = checkEnv(["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"]);

  for (const item of required) {
    console.log(`${item.present ? "✓" : "✗"} ${item.name} ${item.present ? "set" : "MISSING"}`);
    if (!item.present && item.name !== "RESEND_API_KEY") process.exitCode = 1;
  }

  const hasResend = envPresent("RESEND_API_KEY");
  const hasSmtp = envPresent("SMTP_HOST") && envPresent("SMTP_PORT");
  if (!hasResend && !hasSmtp) {
    console.error("\n✗ No email provider configured (need RESEND_API_KEY or SMTP_HOST/SMTP_PORT)");
    process.exitCode = 1;
  } else if (hasResend) {
    console.log("\n✓ Primary provider: Resend");
  }
  if (hasSmtp) {
    console.log(`${hasResend ? "✓" : "○"} SMTP fallback/host configured`);
    for (const item of smtp) {
      console.log(`  ${item.present ? "✓" : "○"} ${item.name}`);
    }
  }

  console.log("\nDeliverability (configure in DNS / Resend dashboard):");
  console.log("  • SPF record for sending domain");
  console.log("  • DKIM signing enabled");
  console.log("  • DMARC policy recommended");
  console.log("  • EMAIL_FROM domain verified in Resend");

  console.log("\nInvitation pipeline:");
  console.log("  POST /api/stories (external email tag) → sendInvitationEmail → sendEmail");
  console.log("  Failures: grep 'invitation email failed' in PM2 logs for providerError object");
  console.log("  API returns emailDelivery[] with providerError.statusCode + message");
  console.log("  See docs/PRODUCTION_SERVICES.md § Proof — invitation email provider responses");
  console.log("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
