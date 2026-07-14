/**
 * deploy-git-sha.js — commit alignment for deterministic deploys.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  shasEqual,
  normalizeSha,
  resolveDeployTarget,
  formatDeploySummary,
  formatDuration,
  gitResetToRefCommand,
  gitRevParseHeadCommand,
} = require("../scripts/lib/deploy-git-sha");
const { setRemoteNodeCache, resetRemoteNodeCache } = require("../scripts/lib/resolve-server-node");

const BIN = "/opt/alt/alt-nodejs20/root/usr/bin";

describe("shasEqual", () => {
  it("matches full SHAs", () => {
    const sha = "a1b2c3d4e5f6789012345678901234567890abcd";
    assert.equal(shasEqual(sha, sha), true);
  });

  it("matches abbreviated prefix", () => {
    const full = "a1b2c3d4e5f6789012345678901234567890abcd";
    assert.equal(shasEqual(full, "a1b2c3d"), true);
    assert.equal(shasEqual("a1b2c3d", full), true);
  });

  it("rejects different SHAs", () => {
    assert.equal(shasEqual("aaaaaaa", "bbbbbbb"), false);
  });
});

describe("normalizeSha", () => {
  it("lowercases and trims", () => {
    assert.equal(normalizeSha("  ABC123  "), "abc123");
  });
});

describe("resolveDeployTarget commit mode", () => {
  it("rejects invalid DEPLOY_COMMIT_SHA", () => {
    assert.throws(
      () =>
        resolveDeployTarget({
          gitBranch: "main",
          deployCommitSha: "not-a-sha",
        }),
      /Invalid DEPLOY_COMMIT_SHA/
    );
  });

  it("returns commit mode for valid SHA", () => {
    const sha = "a1b2c3d4e5f6789012345678901234567890abcd";
    const target = resolveDeployTarget({
      gitBranch: "main",
      deployCommitSha: sha,
    });
    assert.equal(target.mode, "commit");
    assert.equal(target.commitSha, sha);
    assert.equal(target.resetRef, sha);
  });
});

describe("formatDeployComplete", () => {
  it("includes branch, SHA, and verification statuses", () => {
    const text = formatDeploySummary({
      branch: "main",
      version: "0.1.3",
      targetSha: "abc123",
      githubSha: "abc123",
      serverSha: "abc123",
      runtimeSha: "abc123",
      buildOk: true,
      runtimeOk: true,
      healthStatus: "✓ healthy",
      rollbackStatus: "Not required",
      durationMs: 45000,
    });
    assert.ok(text.includes("Branch:             main"));
    assert.ok(text.includes("Commit:             abc123"));
    assert.ok(text.includes("Git Integrity:      ✓ VERIFIED"));
    assert.ok(text.includes("Health:             ✓ healthy"));
    assert.ok(text.includes("Duration:           45 seconds"));
  });
});

describe("formatDuration", () => {
  it("formats seconds and minutes", () => {
    assert.equal(formatDuration(500), "500ms");
    assert.equal(formatDuration(45000), "45 seconds");
    assert.equal(formatDuration(125000), "2m 5s");
  });
});

describe("remote git commands", () => {
  it("reset command uses safe ref and clean", () => {
    setRemoteNodeCache(BIN);
    const cmd = gitResetToRefCommand("/app", "origin/main");
    resetRemoteNodeCache();
    assert.ok(cmd.includes("git reset --hard origin/main"));
    assert.ok(cmd.includes("git clean -fd"));
    assert.ok(cmd.includes('export PATH="'));
  });

  it("head rev-parse uses remoteScript", () => {
    setRemoteNodeCache(BIN);
    const cmd = gitRevParseHeadCommand("/app");
    resetRemoteNodeCache();
    assert.ok(cmd.includes("git rev-parse HEAD"));
  });
});
