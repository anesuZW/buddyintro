/**

 * Bundle runtime dependencies into standalone release staging (zero-install deploy).

 */

const { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } = require("fs");

const { join } = require("path");

const { ROOT } = require("./paths");



/** Directories copied from project node_modules into the release (merge/overwrite). */

const RUNTIME_MODULE_DIRS = [

  [".prisma"],

  ["@prisma"],

  ["prisma"],

];



const RUNTIME_MODULE_FILES = [[".bin", "prisma"]];



const RELEASE_RUNTIME_REQUIRED = [

  "server.js",

  ".next/BUILD_ID",

  "node_modules/.prisma/client/index.js",

  "node_modules/@prisma/client/index.js",

  "node_modules/prisma/build/index.js",

  "node_modules/@prisma/engines/package.json",

  "prisma/schema.prisma",

];



function copyIntoStaging(stagingRoot, relParts) {

  const src = join(ROOT, "node_modules", ...relParts);

  const dest = join(stagingRoot, "node_modules", ...relParts);

  if (!existsSync(src)) {

    throw new Error(

      `Missing runtime dependency: node_modules/${relParts.join("/")}\n` +

        "Run `npm install` and `npm run build` locally before packaging."

    );

  }

  mkdirSync(join(stagingRoot, "node_modules"), { recursive: true });

  const stat = require("fs").statSync(src);

  if (stat.isDirectory()) {

    cpSync(src, dest, { recursive: true });

  } else {

    mkdirSync(join(dest, ".."), { recursive: true });

    cpSync(src, dest);

    try {

      chmodSync(dest, 0o755);

    } catch {

      /* Windows */

    }

  }

}



function bundleStandaloneRuntimeDeps(stagingRoot) {

  for (const parts of RUNTIME_MODULE_DIRS) {

    copyIntoStaging(stagingRoot, parts);

  }

  for (const parts of RUNTIME_MODULE_FILES) {

    copyIntoStaging(stagingRoot, parts);

  }

}



function writeProductionPackageJson(stagingRoot) {

  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

  const production = {

    name: pkg.name,

    version: pkg.version,

    private: true,

    engines: pkg.engines,

    dependencies: pkg.dependencies,

  };

  writeFileSync(join(stagingRoot, "package.json"), `${JSON.stringify(production, null, 2)}\n`);

}



function verifyReleaseStaging(stagingRoot) {

  const missing = RELEASE_RUNTIME_REQUIRED.filter((rel) => !existsSync(join(stagingRoot, rel)));

  if (missing.length) {

    throw new Error(

      `Release package incomplete — missing runtime artifacts:\n  ${missing.join("\n  ")}\n` +

        "Rebuild with `npm run build` and repackage."

    );

  }

}



module.exports = {

  RUNTIME_MODULE_DIRS,

  RELEASE_RUNTIME_REQUIRED,

  bundleStandaloneRuntimeDeps,

  writeProductionPackageJson,

  verifyReleaseStaging,

};


