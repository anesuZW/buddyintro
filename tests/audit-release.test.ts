/**
 * RC1 release audit script presence tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

describe("RC1 release audit scripts", () => {
  const scripts = [
    "scripts/audit-pwa.js",
    "scripts/audit-lighthouse.js",
    "scripts/audit-release.js",
    "scripts/lib/audit-server.js",
    "scripts/lib/pwa-runtime-checks.js",
    "scripts/lib/lighthouse-audit.js",
    ".lighthouserc.cjs",
    "docs/RELEASE_CHECKLIST.md",
  ];

  for (const rel of scripts) {
    it(`has ${rel}`, () => {
      assert.ok(fs.existsSync(path.join(ROOT, rel)), `missing ${rel}`);
    });
  }

  it("package.json defines audit:release", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    assert.ok(pkg.scripts["audit:release"]);
    assert.ok(pkg.scripts["audit:pwa"]);
    assert.ok(pkg.scripts["audit:lighthouse"]);
  });

  it("lighthouserc defines category score thresholds", () => {
    const cfg = fs.readFileSync(path.join(ROOT, ".lighthouserc.cjs"), "utf8");
    assert.match(cfg, /categories:performance/);
    assert.match(cfg, /categories:accessibility/);
  });
});
