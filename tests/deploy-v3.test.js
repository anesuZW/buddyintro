/**
 * Deployment Pipeline v3 — comprehensive unit tests.
 */
const { describe, it, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");

const { CommandError } = require("../scripts/lib/exec");
const {
  shasEqual,
  resolveTargetSha,
  assertLocalPushed,
  assertServerSynced,
  verifyAllShas,
  formatLocalNotPushedError,
  formatDeployComplete,
} = require("../scripts/lib/git-integrity");

const {
  parseBuildVerifyOutput,
  verifyBuildCommand,
  verifyLocalStandaloneBuild,
  LOCAL_DEPLOY_ARTIFACTS,
} = require("../scripts/lib/build-integrity");

const {
  classifyFetchError,
  describeHttpStatus,
  formatAttemptMessage,
  versionUrlFromBase,
} = require("../scripts/lib/health-poll");

const {
  appendDeploymentHistory,
  readHistory,
  MAX_ENTRIES,
} = require("../scripts/lib/deploy-history");

const { failureDirName, buildDiagnosticsCommand } = require("../scripts/lib/deploy-diagnostics");

const { setRemoteNodeCache, resetRemoteNodeCache } = require("../scripts/lib/resolve-server-node");
const {
  rollbackToShaCommand,
  writePreviousSuccessfulShaCommand,
  readPreviousSuccessfulShaCommand,
} = require("../scripts/lib/remote-deploy");

const BIN = "/opt/alt/alt-nodejs20/root/usr/bin";
const SHA_A = "a1b2c3d4e5f6789012345678901234567890abcd";
const SHA_B = "b2c3d4e5f6789012345678901234567890abcde";

const mockLogger = () => {
  const lines = [];
  return { lines, log: (m) => lines.push(m) };
};

beforeEach(() => resetRemoteNodeCache());

describe("CommandError captured output", () => {
  it("includes both stdout and stderr in format()", () => {
    const err = new CommandError({
      command: "ssh",
      args: ["npm run build"],
      exitCode: 1,
      stdout: "Failed to compile.\n./app/page.tsx:10:5",
      stderr: "Type error: Property 'foo' does not exist.",
      display: "ssh npm run build",
    });
    const text = err.format();
    assert.ok(text.includes("stdout:"));
    assert.ok(text.includes("Failed to compile."));
    assert.ok(text.includes("stderr:"));
    assert.ok(text.includes("Type error"));
  });
});

describe("Phase 1 — Git integrity", () => {
  it("local not pushed — abort message format", () => {
    const msg = formatLocalNotPushedError(SHA_A, SHA_B, "main");
    assert.ok(msg.includes("Deployment aborted."));
    assert.ok(msg.includes("Local:"));
    assert.ok(msg.includes(SHA_A));
    assert.ok(msg.includes("GitHub:"));
    assert.ok(msg.includes(SHA_B));
    assert.ok(msg.includes("git push origin main"));
  });

  it("assertLocalPushed throws when local differs from origin", () => {
    const exec = require("../scripts/lib/exec");
    const original = exec.runGitCapture;
    const calls = [];
    exec.runGitCapture = (args) => {
      calls.push(args.join(" "));
      if (args.includes("fetch")) return "";
      if (args.includes("--show-current")) return "main";
      if (args[0] === "rev-parse" && args[1] === "HEAD") return SHA_A;
      if (args[0] === "rev-parse" && args[1] === "main") return SHA_A;
      if (args[0] === "rev-parse" && args[1] === "origin/main") return SHA_B;
      return "";
    };
    try {
      const logger = mockLogger();
      assert.throws(
        () =>
          assertLocalPushed(
            { gitBranch: "main", deployCommitSha: null },
            { mode: "branch", branch: "main", targetSha: SHA_B },
            logger
          ),
        /Deployment aborted/
      );
    } finally {
      exec.runGitCapture = original;
    }
  });

  it("assertLocalPushed rejects wrong checked-out branch", () => {
    const exec = require("../scripts/lib/exec");
    const original = exec.runGitCapture;
    exec.runGitCapture = (args) => {
      if (args.includes("fetch")) return "";
      if (args.includes("--show-current")) return "migration-history-rebuild";
      if (args[0] === "rev-parse" && args[1] === "HEAD") return SHA_A;
      if (args[0] === "rev-parse" && args[1] === "main") return SHA_B;
      if (args[0] === "rev-parse" && args[1] === "origin/main") return SHA_B;
      return "";
    };
    try {
      const logger = mockLogger();
      assert.throws(
        () =>
          assertLocalPushed(
            { gitBranch: "main", deployCommitSha: null },
            { mode: "branch", branch: "main", targetSha: SHA_B },
            logger
          ),
        /does not match deploy branch/
      );
    } finally {
      exec.runGitCapture = original;
    }
  });

  it("origin mismatch — assertServerSynced throws", () => {
    const logger = mockLogger();
    assert.throws(() => assertServerSynced(SHA_A, SHA_B, logger), /Server not synced/);
  });

  it("server mismatch — verifyAllShas throws", () => {
    const logger = mockLogger();
    assert.throws(
      () =>
        verifyAllShas(
          {
            localSha: SHA_A,
            githubSha: SHA_A,
            serverSha: SHA_B,
            runtimeSha: SHA_A,
            targetSha: SHA_A,
            mode: "branch",
            branch: "main",
          },
          logger
        ),
      /SHA mismatch/
    );
  });

  it("detached commit deployment — resolveTargetSha commit mode", () => {
    const target = resolveTargetSha({ gitBranch: "main", deployCommitSha: SHA_A });
    assert.equal(target.mode, "commit");
    assert.equal(target.targetSha, SHA_A);
    assert.equal(target.syncCommand, "checkout");
  });

  it("runtime SHA mismatch — verifyAllShas detects", () => {
    const logger = mockLogger();
    assert.throws(
      () =>
        verifyAllShas(
          {
            localSha: SHA_A,
            githubSha: SHA_A,
            serverSha: SHA_A,
            runtimeSha: SHA_B,
            targetSha: SHA_A,
            mode: "branch",
            branch: "main",
          },
          logger
        ),
      /Runtime commit/
    );
  });
});

describe("Phase 2 — Build integrity", () => {
  it("missing BUILD_ID — parseBuildVerifyOutput throws", () => {
    assert.throws(
      () => parseBuildVerifyOutput("BUILD_MISSING: .next/BUILD_ID not found"),
      /.next\/BUILD_ID not found/
    );
  });

  it("missing .next — parseBuildVerifyOutput throws", () => {
    assert.throws(
      () => parseBuildVerifyOutput("BUILD_MISSING: .next directory not found"),
      /.next directory not found/
    );
  });

  it("verify build command checks Passenger app root artifacts", () => {
    setRemoteNodeCache(BIN);
    const cmd = verifyBuildCommand("/app");
    resetRemoteNodeCache();
    assert.ok(cmd.includes("test -f index.js"));
    assert.ok(cmd.includes("test -f server.js"));
    assert.ok(cmd.includes("test -f .next/BUILD_ID"));
    assert.ok(!cmd.includes("current"));
  });

  it("verifyLocalStandaloneBuild reports missing artifacts explicitly", () => {
    const root = join(tmpdir(), `deploy-artifacts-${Date.now()}`);
    mkdirSync(join(root, ".next", "standalone"), { recursive: true });
    writeFileSync(join(root, ".next", "standalone", "server.js"), "");
    assert.throws(
      () => verifyLocalStandaloneBuild({ root, quiet: true }),
      /Local standalone build incomplete/
    );
    rmSync(root, { recursive: true, force: true });
  });

  it("LOCAL_DEPLOY_ARTIFACTS requires standalone version manifests", () => {
    const version = LOCAL_DEPLOY_ARTIFACTS.find((a) => a.path === ".next/standalone/build/version.json");
    const buildMeta = LOCAL_DEPLOY_ARTIFACTS.find((a) => a.path === ".next/standalone/deployment/build.json");
    assert.ok(version?.required);
    assert.ok(buildMeta?.required);
  });

  it("successful build verify returns BUILD_ID", () => {
    const id = parseBuildVerifyOutput("BUILD_VERIFIED\nabc-build-id");
    assert.equal(id, "abc-build-id");
  });
});

describe("Phase 3 — Health timeout", () => {
  it("pollHealth returns failure after maxMs", async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => {
      throw Object.assign(new Error("Connection timeout"), { name: "TimeoutError" });
    };
    try {
      const { pollHealth } = require("../scripts/lib/health-poll");
      const result = await pollHealth("https://example.com/api/health", {
        maxMs: 100,
        intervalMs: 50,
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("Connection timeout") || result.lastMessage.includes("Connection timeout"));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
describe("Phase 3 — Health polling", () => {
  it("describes HTTP 503 as Application starting", () => {
    assert.equal(describeHttpStatus(503, {}), "Application starting");
  });

  it("describes HTTP 500 Prisma errors", () => {
    assert.equal(describeHttpStatus(500, { database: "error" }), "Prisma initialization failed");
  });

  it("classifies DNS failures", () => {
    const err = new Error("getaddrinfo ENOTFOUND");
    err.cause = { code: "ENOTFOUND" };
    assert.equal(classifyFetchError(err), "DNS resolution failed");
  });

  it("classifies TLS failures", () => {
    const err = new Error("certificate has expired");
    assert.equal(classifyFetchError(err), "TLS handshake failed");
  });

  it("classifies timeout", () => {
    const err = new Error("The operation was aborted");
    err.name = "TimeoutError";
    assert.equal(classifyFetchError(err), "Connection timeout");
  });

  it("formatAttemptMessage includes attempt number and body", () => {
    const msg = formatAttemptMessage(4, "HTTP 503", "Application starting", '{"status":"unhealthy"}');
    assert.ok(msg.includes("Attempt 4"));
    assert.ok(msg.includes("HTTP 503"));
    assert.ok(msg.includes("Application starting"));
    assert.ok(msg.includes("Response:"));
  });

  it("versionUrlFromBase derives /api/version", () => {
    assert.equal(
      versionUrlFromBase("https://buddyintro.com/api/health"),
      "https://buddyintro.com/api/version"
    );
  });
});

describe("Phase 4 — CloudLinux app root", () => {
  it("ensureAppLayout creates incoming staging backups not releases", () => {
    const { ensureAppLayoutCommand } = require("../scripts/lib/deploy-cloudlinux");
    const cmd = ensureAppLayoutCommand("/home/socialit/repositories/buddyintro.com");
    assert.match(cmd, /mkdir -p .*\/backups/);
    assert.match(cmd, /mkdir -p .*\/incoming/);
    assert.match(cmd, /mkdir -p .*\/staging/);
    assert.doesNotMatch(cmd, /mkdir -p .*\/releases/);
    assert.doesNotMatch(cmd, /current/);
  });

  it("restart uses tmp/restart.txt at app root", () => {
    setRemoteNodeCache(BIN);
    const { restartCloudLinuxAppCommand } = require("../scripts/lib/deploy-cloudlinux");
    const cmd = restartCloudLinuxAppCommand("/app");
    resetRemoteNodeCache();
    assert.match(cmd, /touch tmp\/restart\.txt/);
    assert.doesNotMatch(cmd, /current/);
  });

  it("legacy layout command removes current symlink", () => {
    setRemoteNodeCache(BIN);
    const { removeLegacyReleaseLayoutCommand } = require("../scripts/lib/deploy-cloudlinux");
    const cmd = removeLegacyReleaseLayoutCommand("/app");
    resetRemoteNodeCache();
    assert.match(cmd, /rm -f .*\/current/);
  });
});

describe("Phase 5 — Rollback", () => {
  it("rollback restores tar.gz backup without symlink switch", () => {
    setRemoteNodeCache(BIN);
    const { restoreBackupCommand } = require("../scripts/lib/deploy-cloudlinux");
    const cmd = restoreBackupCommand("/app", "2026-07-16-1540");
    resetRemoteNodeCache();
    assert.ok(cmd.includes("backups/2026-07-16-1540.tar.gz"));
    assert.ok(cmd.includes("tar -xzf"));
    assert.ok(cmd.includes("tmp/restart.txt"));
    assert.ok(!cmd.includes("ln -sfn"));
    assert.ok(!cmd.includes("current"));
  });

  it("previous successful backup read/write commands", () => {
    setRemoteNodeCache(BIN);
    const { writePreviousBackupCommand, readPreviousBackupCommand } = require("../scripts/lib/deploy-cloudlinux");
    const write = writePreviousBackupCommand("/app", "2026-07-16-1540", SHA_A);
    const read = readPreviousBackupCommand("/app");
    resetRemoteNodeCache();
    assert.ok(write.includes(".previous-successful-backup"));
    assert.ok(write.includes(".previous-successful-sha"));
    assert.ok(read.includes(".previous-successful-backup"));
  });
});

describe("Phase 6 — Diagnostics", () => {
  it("failureDirName uses timestamp format", () => {
    assert.match(failureDirName(), /^\d{4}-\d{2}-\d{2}-\d{4}$/);
  });

  it("diagnostics command collects server state", () => {
    setRemoteNodeCache(BIN);
    const cmd = buildDiagnosticsCommand("/app");
    resetRemoteNodeCache();
    assert.ok(cmd.includes("node -v"));
    assert.ok(cmd.includes("stderr.log"));
    assert.ok(cmd.includes("ls -la .next"));
  });
});

describe("Phase 8 — Deployment history", () => {
  it("appends and trims to MAX_ENTRIES", () => {
    const dir = join(tmpdir(), `buddyintro-history-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const historyPath = join(dir, "history.json");
    const paths = require("../scripts/lib/paths");
    const original = paths.DEPLOY_HISTORY_PATH;
    paths.DEPLOY_HISTORY_PATH = historyPath;

    try {
      for (let i = 0; i < MAX_ENTRIES + 5; i++) {
        appendDeploymentHistory({ sha: `sha${i}`, version: "0.1.0", branch: "main" });
      }
      const history = readHistory();
      assert.equal(history.length, MAX_ENTRIES);
      assert.equal(history[0].sha, `sha${MAX_ENTRIES + 4}`);
    } finally {
      paths.DEPLOY_HISTORY_PATH = original;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Final output format", () => {
  it("formatDeployComplete matches v3 banner", () => {
    const text = formatDeployComplete({
      branch: "main",
      version: "0.1.3",
      targetSha: SHA_A,
      githubSha: SHA_A,
      serverSha: SHA_A,
      runtimeSha: SHA_A,
      buildOk: true,
      runtimeOk: true,
      healthStatus: "✓ 200 OK",
      rollbackStatus: "Not required",
      durationMs: 48000,
      historyUpdated: true,
    });
    assert.ok(text.includes("BuddyIntro Deployment Complete"));
    assert.ok(text.includes("Git Integrity:      ✓ VERIFIED"));
    assert.ok(text.includes("Build:              ✓ VERIFIED"));
    assert.ok(text.includes("Runtime:            ✓ VERIFIED"));
    assert.ok(text.includes("Deployment History Updated"));
  });
});
