#!/usr/bin/env node
/**
 * Pre-flight checks for release and deployment tooling (v3).
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
const { verifySshReachable, sshExecCapture } = require("./lib/ssh");
const {
  resolveServerNode,
  resolveServerPrisma,
  logUsingServerNode,
} = require("./lib/resolve-server-node");
const { runServerChecks } = require("./lib/server-verify");
const { ROOT, PACKAGE_JSON } = require("./lib/paths");
const {
  fetchOrigin,
  getLocalSHA,
  getOriginSHA,
  shasEqual,
} = require("./lib/git-integrity");
const {
  remoteBuildIdCheckCommand,
  verifyBuildCommand,
} = require("./lib/build-integrity");
const { classifyFetchError, versionUrlFromBase } = require("./lib/health-poll");
const { readPreviousSuccessfulShaCommand } = require("./lib/remote-deploy");

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

async function probeUrl(url, label) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, error: classifyFetchError(e), label };
  }
}

async function main() {
  console.log("\n=== BuddyIntro Doctor v3 ===\n");
  loadEnvFiles();
  const results = [];
  let config;

  try {
    config = getDeployConfig();
    verifySshReachable(config);
    results.push(check("SSH", "PASS", `${config.user}@${config.host}:${config.port}`));
  } catch (e) {
    const missing = getMissingEnv(REQUIRED_LOCAL_DEPLOY);
    results.push(
      check("SSH", "FAIL", e instanceof Error ? e.message : String(e))
    );
    if (missing.length) {
      results.push(check("Deploy env", "FAIL", `Missing: ${missing.join(", ")}`));
    }
  }

  const remote = tryGitCapture(["remote", "get-url", "origin"]);
  results.push(
    check("GitHub remote", remote ? "PASS" : "FAIL", remote || "No origin remote configured")
  );

  const ghVer = tryGhCapture(["--version"]);
  const ghAuth = tryGhCapture(["auth", "status"]);
  results.push(
    check("GitHub CLI", ghVer ? "PASS" : "FAIL", ghVer ? ghVer.split("\n")[0] : "Not installed")
  );
  results.push(
    check(
      "GitHub auth",
      ghAuth ? "PASS" : "FAIL",
      ghAuth ? "Authenticated" : "Run: gh auth login"
    )
  );

  try {
    fetchOrigin(config?.gitBranch || "main");
    const localSha = getLocalSHA();
    const originSha = getOriginSHA(config?.gitBranch || "main");
    const aligned = shasEqual(localSha, originSha);
    results.push(
      check(
        "Git SHAs (local vs origin)",
        aligned ? "PASS" : "FAIL",
        aligned
          ? `${localSha.slice(0, 7)} aligned`
          : `Local ${localSha.slice(0, 7)} ≠ origin ${originSha.slice(0, 7)} — run git push`
      )
    );
  } catch (e) {
    results.push(check("Git SHAs", "WARNING", e instanceof Error ? e.message : String(e)));
  }

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

  const prismaOut = tryCapture("npx", ["prisma", "-v"]);
  results.push(
    check("Prisma", prismaOut ? "PASS" : "FAIL", prismaOut ? prismaOut.split("\n")[0] : "Not available")
  );

  const schemaPath = join(ROOT, "prisma", "schema.prisma");
  results.push(
    check(
      "Prisma schema",
      existsSync(schemaPath) ? "PASS" : "FAIL",
      existsSync(schemaPath) ? "prisma/schema.prisma" : "Missing"
    )
  );

  if (config?.healthUrl) {
    const healthProbe = await probeUrl(config.healthUrl, "health");
    if (healthProbe.error) {
      results.push(check("DNS/TLS (/api/health)", "FAIL", healthProbe.error));
    } else {
      results.push(check("/api/health", healthProbe.ok ? "PASS" : "WARNING", `HTTP ${healthProbe.status}`));
    }

    const versionUrl = config.versionUrl || versionUrlFromBase(config.healthUrl);
    const versionProbe = await probeUrl(versionUrl, "version");
    if (versionProbe.error) {
      results.push(check("DNS/TLS (/api/version)", "FAIL", versionProbe.error));
    } else if (versionProbe.ok) {
      try {
        const data = JSON.parse(versionProbe.body);
        results.push(check("/api/version", "PASS", `v${data.version} @ ${data.commit?.slice(0, 7)}`));
        results.push(check("Runtime SHA", data.commit ? "PASS" : "WARNING", data.commit || "missing"));
        console.log("\nServer Runtime");
        console.log(`Commit:      ${data.commit || "unknown"}`);
        console.log(`Version:     ${data.version || "unknown"}`);
        console.log(`Environment: ${data.environment || "unknown"}`);
        console.log(`Built at:    ${data.builtAt || "unknown"}`);
      } catch {
        results.push(check("/api/version", "WARNING", "Invalid JSON response"));
      }
    } else {
      results.push(check("/api/version", "WARNING", `HTTP ${versionProbe.status}`));
    }
  } else {
    results.push(check("/api/health", "WARNING", "DEPLOY_HEALTH_URL not set"));
  }

  if (process.env.DATABASE_URL) {
    results.push(check("Database", "PASS", "DATABASE_URL configured locally"));
  } else {
    results.push(check("Database", "WARNING", "DATABASE_URL not set locally"));
  }

  const missingServer = getMissingEnv(REQUIRED_SERVER_ENV);
  results.push(
    check(
      "Environment variables",
      missingServer.length ? "FAIL" : "PASS",
      missingServer.length ? `Missing: ${missingServer.join(", ")}` : "All required vars present locally"
    )
  );

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

  const mem = process.memoryUsage();
  results.push(check("Memory (local)", "PASS", `RSS ${Math.round(mem.rss / 1024 / 1024)} MB`));

  if (config) {
    try {
      verifySshReachable(config);
      const nodeEnv = await resolveServerNode({ sshExecCapture });
      logUsingServerNode(nodeEnv);
      results.push(check("Server Node", "PASS", nodeEnv.nodeVersion));
      results.push(check("Server npm", "PASS", nodeEnv.npmVersion));

      try {
        const prismaVersion = await resolveServerPrisma(config.appPath, { sshExecCapture });
        results.push(check("Server Prisma", "PASS", prismaVersion.split("\n")[0]));
      } catch (e) {
        results.push(check("Server Prisma", "FAIL", e.message));
      }

      const buildIdOut = sshExecCapture(remoteBuildIdCheckCommand(config.appPath));
      if (buildIdOut.includes("BUILD_ID_MISSING")) {
        results.push(check("Server BUILD_ID", "WARNING", ".next/BUILD_ID missing — run deploy"));
      } else {
        results.push(check("Server BUILD_ID", "PASS", buildIdOut.trim()));
      }

      try {
        sshExecCapture(verifyBuildCommand(config.appPath));
        results.push(check("Server build", "PASS", ".next and build/version.json present"));
      } catch {
        results.push(check("Server build", "WARNING", "Build artifacts incomplete"));
      }

      const prevSha = sshExecCapture(readPreviousSuccessfulShaCommand(config.appPath)).trim();
      results.push(
        check(
          "Previous successful SHA",
          prevSha ? "PASS" : "WARNING",
          prevSha || "Not set (first deploy)"
        )
      );

      const serverResults = await runServerChecks(config, nodeEnv);
      for (const sr of serverResults) {
        if (["Node version", "npm version", "Prisma version"].includes(sr.name)) continue;
        results.push(check(`Server: ${sr.name}`, sr.status, sr.message));
      }
    } catch (e) {
      results.push(check("Server checks", "FAIL", e.message));
    }
  }

  const failed = printReport(results);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
