/**

 * Source packaging tests (legacy standalone-runtime helpers retained for reference).

 */

const { describe, it, beforeEach, afterEach } = require("node:test");

const assert = require("node:assert/strict");

const {

  mkdirSync,

  writeFileSync,

  rmSync,

  existsSync,

  mkdtempSync,

  readFileSync,

} = require("fs");

const { join } = require("path");

const { tmpdir } = require("os");

const {

  bundleStandaloneRuntimeDeps,

  writeProductionPackageJson,

  verifyReleaseStaging,

  RELEASE_RUNTIME_REQUIRED,

} = require("../scripts/lib/standalone-runtime");

const { shouldSkip } = require("../scripts/lib/deploy-source-package");



describe("deploy-source-package.js", () => {

  it("shouldSkip excludes node_modules and .next", () => {

    assert.equal(shouldSkip("node_modules/foo"), true);

    assert.equal(shouldSkip(".next/BUILD_ID"), true);

    assert.equal(shouldSkip("app/page.tsx"), false);

  });

});



describe("standalone-runtime.js", () => {

  let workDir;



  beforeEach(() => {

    workDir = mkdtempSync(join(tmpdir(), "buddyintro-runtime-"));

    writeFileSync(join(workDir, "server.js"), "module.exports = {};\n");

    mkdirSync(join(workDir, ".next"), { recursive: true });

    writeFileSync(join(workDir, ".next", "BUILD_ID"), "test-build\n");

    mkdirSync(join(workDir, "prisma"), { recursive: true });

    writeFileSync(join(workDir, "prisma", "schema.prisma"), "generator client {}\n");

  });



  afterEach(() => {

    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });

  });



  it("bundles Prisma CLI and client from local node_modules", () => {

    bundleStandaloneRuntimeDeps(workDir);

    for (const rel of RELEASE_RUNTIME_REQUIRED) {

      if (rel.startsWith("prisma/")) continue;

      assert.ok(existsSync(join(workDir, rel)), `missing ${rel}`);

    }

  });



  it("writes production package.json without postinstall or devDependencies", () => {

    writeProductionPackageJson(workDir);

    const pkg = JSON.parse(readFileSync(join(workDir, "package.json"), "utf8"));

    assert.ok(pkg.dependencies);

    assert.equal(pkg.scripts, undefined);

    assert.equal(pkg.devDependencies, undefined);

  });



  it("verifyReleaseStaging fails when Prisma CLI is absent", () => {

    assert.throws(() => verifyReleaseStaging(workDir), /Release package incomplete/);

  });

});


