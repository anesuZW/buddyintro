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
  it("includes PATH for npm and npx", () => {
    setRemoteNodeCache(BIN, { nodeVersion: "v20.20.2", npmVersion: "10.8.2" });
    const cmd = rollbackToShaCommand("/home/user/app", "a1b2c3d4e5f6789012345678901234567890abcd");
    assert.ok(cmd.includes(BIN));
    assert.ok(cmd.includes("npm ci"));
    assert.ok(cmd.includes("npx prisma generate"));
    assert.ok(cmd.includes("npm run build"));
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
