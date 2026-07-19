/**
 * Production startup diagnostics — run manually, not during Next.js build.
 * Usage: npm run startup-check
 */
import fs from "fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const m = trimmed.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnv();

async function main() {
  const { runStartupDiagnostics } = await import("@/lib/diagnostics/startup-check");
  const results = await runStartupDiagnostics();

  console.log("\n=== BuddyIntro Startup Check ===\n");

  for (const item of results) {
    if (item.name === "storage" && item.messages?.length) {
      for (const line of item.messages) {
        console.log(line);
      }
      console.log("");
      continue;
    }

    const icon = item.status === "ok" ? "✓" : item.status === "warn" ? "○" : "✗";
    const label = item.name.charAt(0).toUpperCase() + item.name.slice(1);
    const detail = item.detail ? `: ${item.detail}` : "";
    console.log(`${icon} ${label}${detail}`);
  }

  console.log("");
  if (results.some((r) => r.status === "error")) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
