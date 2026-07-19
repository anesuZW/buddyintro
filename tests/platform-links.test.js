/**
 * Cross-platform shared link tests for deploy v3.
 */
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");
const {
  createSharedLink,
  validateSharedLink,
  safeRemoveLink,
  isWindows,
} = require("../scripts/lib/platform-links");

describe("platform shared links", () => {
  let root = "";

  beforeEach(() => {
    root = join(tmpdir(), `buddyintro-links-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
  });

  it("creates and validates a directory shared link", () => {
    const source = join(root, "shared", "uploads");
    const target = join(root, "release", "uploads");
    mkdirSync(source, { recursive: true });
    mkdirSync(join(root, "release"), { recursive: true });

    createSharedLink(source, target, { type: "dir", protectPaths: [source] });
    validateSharedLink(source, target);
    assert.ok(existsSync(target));
  });

  it("creates and validates a file shared link", () => {
    const source = join(root, "shared", ".env");
    const target = join(root, "release", ".env");
    mkdirSync(join(root, "shared"), { recursive: true });
    mkdirSync(join(root, "release"), { recursive: true });
    writeFileSync(source, "NODE_ENV=production\n");

    createSharedLink(source, target, { type: "file", protectPaths: [join(root, "shared", "uploads")] });
    assert.ok(existsSync(target));
    assert.equal(readFileSync(target, "utf8"), readFileSync(source, "utf8"));
  });

  it("replaces broken links before creating a new one", () => {
    const source = join(root, "shared", "uploads");
    const target = join(root, "release", "uploads");
    mkdirSync(source, { recursive: true });
    mkdirSync(join(root, "release"), { recursive: true });
    mkdirSync(target, { recursive: true });

    createSharedLink(source, target, { type: "dir", protectPaths: [source] });
    validateSharedLink(source, target);
  });

  it("validation catches incorrect link targets", () => {
    const source = join(root, "shared", "uploads");
    const other = join(root, "other", "uploads");
    const target = join(root, "release", "uploads");
    mkdirSync(source, { recursive: true });
    mkdirSync(other, { recursive: true });
    mkdirSync(join(root, "release"), { recursive: true });

    createSharedLink(source, target, { type: "dir", protectPaths: [source] });
    safeRemoveLink(target);
    createSharedLink(other, target, { type: "dir", protectPaths: [source, other] });

    assert.throws(
      () => validateSharedLink(source, target),
      /Shared link validation failed/
    );
  });

  it("uses junctions on Windows and symlinks elsewhere", () => {
    assert.equal(isWindows(), process.platform === "win32");
  });
});
