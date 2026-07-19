import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ensureLocalStorageReady } from "../lib/diagnostics/storage-check";

describe("startup storage check", () => {
  let root = "";

  beforeEach(() => {
    root = join(tmpdir(), `buddyintro-storage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    if (root && existsSync(root)) rmSync(root, { recursive: true, force: true });
  });

  it("development creates missing ./uploads directory", async () => {
    const result = await ensureLocalStorageReady({
      cwd: root,
      raw: "./uploads",
      nodeEnv: "development",
    });

    assert.equal(result.ok, true);
    assert.equal(existsSync(join(root, "uploads")), true);
    assert.ok(result.messages.some((line) => line.includes("Creating development storage")));
    assert.ok(result.messages.some((line) => line.includes("✓ Storage ready")));
  });

  it("production fails with useful mkdir guidance when storage is missing", async () => {
    const productionPath = join(root, "shared", "uploads");
    const result = await ensureLocalStorageReady({
      cwd: root,
      raw: productionPath,
      nodeEnv: "production",
    });

    assert.equal(result.ok, false);
    assert.equal(existsSync(productionPath), false);
    assert.ok(result.messages.some((line) => line.includes("Production media storage missing")));
    assert.ok(result.messages.some((line) => line.includes(`mkdir -p ${productionPath}`)));
  });

  it("production accepts existing absolute storage directory", async () => {
    const productionPath = join(root, "shared", "uploads");
    mkdirSync(productionPath, { recursive: true });

    const result = await ensureLocalStorageReady({
      cwd: root,
      raw: productionPath,
      nodeEnv: "production",
    });

    assert.equal(result.ok, true);
    assert.ok(result.messages.some((line) => line.includes("✓ Storage ready")));
  });
});
