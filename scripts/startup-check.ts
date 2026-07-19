/**
 * Production startup diagnostics — run manually, not during Next.js build.
 * Usage: npm run startup-check
 */
import fs from "fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

async function main() {
  const { runStartupDiagnostics } = await import("@/lib/diagnostics/startup-check");
  const results = await runStartupDiagnostics();
  console.log(JSON.stringify(results, null, 2));
  if (results.some((r) => r.status === "error")) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
