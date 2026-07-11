#!/usr/bin/env node
/**
 * Pre-flight checks for release and deployment tooling.
 * Usage: npm run doctor
 */
const { existsSync, readFileSync } = require("fs");
const { join } = require("path");
const { loadEnvFiles, getDeployConfig } = require("./lib/deploy-config");
const {
  REQUIRED_SERVER_ENV,
  REQUIRED_LOCAL_DEPLOY,
  getMissingEnv,
} = require("./lib/deploy-env");
const { tryGhCapture, tryGitCapture, tryCapture } = require("./lib/exec");
const { satisfiesMinVersion } = require("./lib/node-version");
const { verifySshReachable } = require("./lib/ssh");
const { runServerChecks } = require("./lib/server-verify");
const { ROOT, PACKAGE_JSON } = require("./lib/paths");

function check(name, status, message) {
  return { name, status, message };
}

function printReport(results) {
  const pad = (s, n) => s.padEnd(n);
  const maxName = Math.max(...results.map((r) => r.name.length), 10);
  console.log("\n" + pad("Check", maxName) + "  Status   Details");
  console.log("-".repeat(maxName + 50));
  for (const r of results) {
    const icon = r.status === "PASS" ? "✓" : r.status === "WARNING" ? "!" : "✗";
    console.log(`${pad(r.name, maxName)}  ${icon} ${r.status.padEnd(7)}  ${r.message}`);
  }
  const failed = results.filter((r) => r.status === "FAIL").length;
  const warned = results.filter((r) => r.status === "WARNING").length;
  console.log(`\nSummary: ${results.length - failed - warned} PASS, ${warned} WARNING, ${failed} FAIL\n`);
  return failed;
}

async function main() {
  console.log("\n=== BuddyIntro Doctor ===\n");
  loadEnvFiles();
  const results = [];

  // SSH
  try {
    const config = getDeployConfig();
    verifySshReachable(config);
    results.push(check("SSH", "PASS", `${config.user}@${config.host}:${config.port}`));
  } catch (e) {
    const missing = getMissingEnv(REQUIRED_LOCAL_DEPLOY);
    results.push(
      check(
        "SSH",
        missing.length ? "FAIL" : "FAIL",
        e instanceof Error ? e.message : String(e)
      )
    );
  }

  // GitHub remote
  const remote = tryGitCapture(["remote", "get-url", "origin"]);
  results.push(
    check("GitHub remote", remote ? "PASS" : "FAIL", remote || "No origin remote configured")
  );

  // GitHub CLI
  const ghVer = tryGhCapture(["--version"]);
  const ghAuth = tryGhCapture(["auth", "status"]);
  results.push(
    check("GitHub CLI", ghVer ? "PASS" : "FAIL", ghVer ? ghVer.split("\n")[0] : "Not installed")
  );
  results.push(
    check(
      "GitHub CLI auth",
      ghAuth ? "PASS" : "FAIL",
      ghAuth ? "Authenticated" : "Run: gh auth login"
    )
  );

  // Node
  const nodeVer = process.version;
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf8"));
  const minNode = (pkg.engines?.node || ">=18.17.0").replace(/^>=/, "");
  results.push(
    check(
      "Node",
      satisfiesMinVersion(nodeVer, minNode) ? "PASS" : "FAIL",
      `${nodeVer} (required >=${minNode})`
    )
  );

  // Prisma
  const prismaOut = tryCapture("npx", ["prisma", "-v"]);
  results.push(
    check(
      "Prisma",
      prismaOut ? "PASS" : "FAIL",
      prismaOut ? prismaOut.split("\n")[0] : "Not available"
    )
  );

  // Supabase
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supaUrl && supaKey) {
    try {
      const res = await fetch(`${supaUrl}/auth/v1/health`, {
        headers: { apikey: supaKey },
        signal: AbortSignal.timeout(10_000),
      });
      results.push(
        check("Supabase", res.ok ? "PASS" : "WARNING", `HTTP ${res.status}`)
      );
    } catch (e) {
      results.push(check("Supabase", "WARNING", e instanceof Error ? e.message : String(e)));
    }
  } else {
    results.push(check("Supabase", "WARNING", "NEXT_PUBLIC_SUPABASE_* not set locally"));
  }

  // Database
  if (process.env.DATABASE_URL) {
    results.push(check("Database", "PASS", "DATABASE_URL configured locally"));
  } else {
    results.push(check("Database", "WARNING", "DATABASE_URL not set locally"));
  }

  // Environment variables
  const missingServer = getMissingEnv(REQUIRED_SERVER_ENV);
  results.push(
    check(
      "Environment variables",
      missingServer.length ? "FAIL" : "PASS",
      missingServer.length
        ? `Missing: ${missingServer.join(", ")}`
        : "All required vars present locally"
    )
  );

  // Disk (local)
  try {
    const { statfsSync } = require("fs");
    if (statfsSync) {
      const stats = statfsSync(ROOT);
      const freeGb = (stats.bfree * stats.bsize) / 1024 ** 3;
      results.push(
        check("Disk (local)", freeGb < 1 ? "WARNING" : "PASS", `${freeGb.toFixed(1)} GB free`)
      );
    }
  } catch {
    results.push(check("Disk (local)", "WARNING", "Could not measure"));
  }

  // Memory (local) — Node heap only
  const mem = process.memoryUsage();
  results.push(
    check(
      "Memory (local)",
      "PASS",
      `RSS ${Math.round(mem.rss / 1024 / 1024)} MB`
    )
  );

  // Remote server checks (if SSH works)
  try {
    const config = getDeployConfig();
    verifySshReachable(config);
    const serverResults = await runServerChecks(config);
    for (const sr of serverResults) {
      results.push(check(`Server: ${sr.name}`, sr.status, sr.message));
    }
  } catch {
    results.push(check("Server verification", "WARNING", "Skipped — SSH not available"));
  }

  const failed = printReport(results);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
