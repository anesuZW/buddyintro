/**
 * Self-check: npm invoked via exec.js must behave like a manual npm run.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const path = require("path");
const {
  tryCapture,
  tryRun,
  resolveSpawn,
  npmCliPath,
  ROOT,
} = require("../scripts/lib/exec");

function manualNpmVersion() {
  if (process.platform === "win32") {
    const result = spawnSync(process.execPath, [npmCliPath(), "--version"], {
      cwd: ROOT,
      encoding: "utf8",
      shell: false,
    });
    assert.equal(result.status, 0, `manual npm failed: ${result.error?.message}`);
    return (result.stdout || "").trim();
  }
  const result = spawnSync("npm", ["--version"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
  });
  assert.equal(result.status, 0, `manual npm failed: ${result.error?.message}`);
  return (result.stdout || "").trim();
}

describe("exec npm", () => {
  it("resolveSpawn uses npm-cli.js on Windows", () => {
    const resolved = resolveSpawn("npm", ["install"]);
    if (process.platform === "win32") {
      assert.equal(resolved.executable, process.execPath);
      assert.ok(resolved.args[0].endsWith(path.join("npm", "bin", "npm-cli.js")));
      assert.equal(resolved.display, "npm install");
    } else {
      assert.equal(resolved.executable, "npm");
      assert.deepEqual(resolved.args, ["install"]);
    }
  });

  it("npm --version via runNpm matches manual npm --version", () => {
    const manual = manualNpmVersion();
    const viaExec = tryCapture("npm", ["--version"], { quiet: true });
    assert.ok(viaExec, "runNpm --version failed");
    assert.equal(viaExec, manual);
  });

  it("npm install --dry-run exits 0 from repository root", () => {
    const ok = tryRun("npm", ["install", "--dry-run"], { quiet: true });
    assert.ok(ok, "npm install --dry-run should succeed from repo root");
  });
});
