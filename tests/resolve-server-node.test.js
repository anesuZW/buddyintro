/**
 * resolve-server-node.js — CloudLinux / standard Linux Node resolution.
 */
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const {
  CLOUDLINUX_CANDIDATES,
  parseResolveOutput,
  parseVerifyOutput,
  buildRemoteResolveScript,
  buildVerifyConfiguredBinScript,
  withNodeEnvironment,
  setRemoteNodeCache,
  resetRemoteNodeCache,
  getRemoteNodeBin,
  logUsingServerNode,
} = require("../scripts/lib/resolve-server-node");
const { rollbackToShaCommand } = require("../scripts/lib/remote-deploy");

const BIN = "/opt/alt/alt-nodejs20/root/usr/bin";

beforeEach(() => {
  resetRemoteNodeCache();
});

describe("buildRemoteResolveScript", () => {
  it("tests CloudLinux paths with test -x, no find", () => {
    const script = buildRemoteResolveScript();
    assert.ok(script.includes(CLOUDLINUX_CANDIDATES[0]));
    assert.ok(script.includes("[ -x "));
    assert.ok(!script.includes("find /opt/alt"));
  });

  it("falls back to which node", () => {
    const script = buildRemoteResolveScript();
    assert.ok(script.includes("which node"));
  });
});

describe("buildVerifyConfiguredBinScript", () => {
  it("verifies DEPLOY_NODE_BIN with test -x", () => {
    const script = buildVerifyConfiguredBinScript(BIN);
    assert.ok(script.includes(BIN));
    assert.ok(script.includes("/node"));
    assert.ok(!script.includes("find /opt/alt"));
  });
});

describe("withNodeEnvironment", () => {
  it("prepends quoted PATH export", () => {
    const cmd = withNodeEnvironment("npm ci", BIN);
    assert.ok(cmd.includes('export PATH="/opt/alt/alt-nodejs20/root/usr/bin:$PATH"'));
  });
});

describe("rollback uses resolved Node", () => {
  it("includes PATH for backup restore", () => {
    setRemoteNodeCache(BIN, { nodeVersion: "v20.20.2", npmVersion: "10.8.2" });
    const { restoreBackupCommand } = require("../scripts/lib/deploy-releases");
    const cmd = restoreBackupCommand("/home/user/app", "2026-07-16-1540");
    assert.ok(cmd.includes(BIN));
    assert.ok(cmd.includes("backups/2026-07-16-1540"));
    assert.ok(cmd.includes("tmp/restart.txt"));
    assert.ok(!cmd.includes("ln -sfn"));
  });
});

describe("logUsingServerNode", () => {
  it("prints Using server Node path", () => {
    const lines = [];
    logUsingServerNode({ binDir: BIN }, (l) => lines.push(l));
    assert.equal(lines[0], `Using server Node:\n${BIN}`);
  });
});

describe("highest version first", () => {
  it("lists nodejs20 before nodejs18", () => {
    assert.equal(CLOUDLINUX_CANDIDATES[0], "/opt/alt/alt-nodejs20/root/usr/bin");
  });
});
