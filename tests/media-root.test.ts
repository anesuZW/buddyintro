import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "path";
import { tmpdir } from "os";
import {
  getMediaRootDisplayPath,
  isProductionEnv,
  resolveMediaRoot,
  validateProductionMediaRoot,
} from "../lib/storage/media-root";

describe("media root resolution", () => {
  const cwd = resolve(tmpdir(), "buddyintro-dev-root");

  it("Windows development resolves ./uploads to absolute project path", () => {
    const resolved = resolveMediaRoot({
      cwd,
      raw: "./uploads",
      nodeEnv: "development",
    });
    assert.equal(resolved, resolve(cwd, "uploads"));
    assert.equal(
      getMediaRootDisplayPath({ cwd, raw: "./uploads", nodeEnv: "development" }),
      "./uploads"
    );
  });

  it("Linux production accepts absolute MEDIA_ROOT", () => {
    const productionPath = "/home/buddyintro/shared/uploads";
    assert.equal(
      resolveMediaRoot({
        cwd: "/home/buddyintro/current",
        raw: productionPath,
        nodeEnv: "production",
      }),
      productionPath
    );
    assert.doesNotThrow(() =>
      validateProductionMediaRoot({
        raw: productionPath,
        nodeEnv: "production",
      })
    );
  });

  it("production rejects relative MEDIA_ROOT", () => {
    assert.throws(
      () =>
        resolveMediaRoot({
          cwd,
          raw: "./uploads",
          nodeEnv: "production",
        }),
      /absolute path/
    );
  });

  it("defaults to development uploads directory when unset", () => {
    const resolved = resolveMediaRoot({ cwd, raw: "", nodeEnv: "development" });
    assert.equal(resolved, resolve(cwd, "uploads"));
  });

  it("development ignores production template paths loaded from legacy env files", () => {
    const resolved = resolveMediaRoot({
      cwd,
      raw: "/home/buddyintro/uploads",
      nodeEnv: "development",
    });
    assert.equal(resolved, resolve(cwd, "uploads"));
  });

  it("isProductionEnv detects production NODE_ENV", () => {
    assert.equal(isProductionEnv("production"), true);
    assert.equal(isProductionEnv("development"), false);
  });
});
