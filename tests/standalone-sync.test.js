const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");

const {
  standalonePaths,
  syncStandaloneBundle,
  verifyStandaloneManifestIntegrity,
} = require("../scripts/lib/standalone-sync");

describe("standalone-sync", () => {
  let root;

  before(() => {
    root = mkdtempSync(join(tmpdir(), "standalone-sync-"));
    mkdirSync(join(root, ".next", "standalone"), { recursive: true });
    writeFileSync(join(root, ".next", "standalone", "server.js"), "// stub");
    mkdirSync(join(root, ".next", "static"), { recursive: true });
    writeFileSync(join(root, ".next", "static", "chunk.js"), "// static");
    mkdirSync(join(root, "public"), { recursive: true });
    writeFileSync(join(root, "public", "favicon.ico"), "ico");
  });

  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("standalonePaths resolves bundle locations", () => {
    const paths = standalonePaths(root);
    assert.equal(paths.serverJs, join(root, ".next", "standalone", "server.js"));
    assert.equal(paths.staticDest, join(root, ".next", "standalone", ".next", "static"));
    assert.equal(paths.publicDest, join(root, ".next", "standalone", "public"));
  });

  it("syncStandaloneBundle copies static/public and writes manifests", () => {
    const { paths, manifest } = syncStandaloneBundle(root, "test-release");
    assert.ok(existsSync(paths.staticDest));
    assert.ok(existsSync(paths.publicDest));
    assert.ok(existsSync(paths.deploymentBuild));
    assert.ok(existsSync(paths.buildVersion));
    assert.equal(manifest.releaseId, "test-release");

    const deployment = JSON.parse(readFileSync(paths.deploymentBuild, "utf8"));
    const version = JSON.parse(readFileSync(paths.buildVersion, "utf8"));
    assert.equal(deployment.gitCommit, version.commit);
  });

  it("verifyStandaloneManifestIntegrity requires git HEAD match", () => {
    // In CI/repo checkout, HEAD exists — after sync, manifests should match.
    const result = verifyStandaloneManifestIntegrity(root);
    assert.ok(result.head);
    assert.equal(result.deploymentCommit, result.head);
    assert.equal(result.versionCommit, result.head);
  });
});
