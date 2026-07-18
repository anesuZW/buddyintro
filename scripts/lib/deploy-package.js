/**

 * Assemble standalone Next.js production package for release-based deployment.

 */

const {

  cpSync,

  existsSync,

  mkdirSync,

  readFileSync,

  rmSync,

  statSync,

  writeFileSync,

} = require("fs");

const { join } = require("path");

const { ROOT, STAGING_DIR, DEPLOYMENT_DIR } = require("./paths");

const { writeBuildMetadata } = require("./deploy-metadata");

const { createTarGzArchive } = require("./archive");

const {

  bundleStandaloneRuntimeDeps,

  writeProductionPackageJson,

  verifyReleaseStaging,

} = require("./standalone-runtime");



const PASSENGER_INDEX = join(ROOT, "deployment", "templates", "index.passenger.js");



const STANDALONE_REQUIRED = [

  ".next/standalone/server.js",

  ".next/BUILD_ID",

];



function verifyLocalStandaloneBuild() {

  const missing = STANDALONE_REQUIRED.filter((p) => !existsSync(join(ROOT, p)));

  if (missing.length) {

    throw new Error(

      `Local standalone build incomplete. Missing:\n  ${missing.join("\n  ")}\n` +

        "Run `npm run build` with output: 'standalone' in next.config.js."

    );

  }

}



function copyDir(src, dest) {

  cpSync(src, dest, { recursive: true });

}



function dirSizeBytes(dir) {

  let total = 0;

  const walk = (p) => {

    const st = statSync(p);

    if (st.isDirectory()) {

      for (const entry of require("fs").readdirSync(p)) {

        walk(join(p, entry));

      }

    } else {

      total += st.size;

    }

  };

  walk(dir);

  return total;

}



function formatBytes(bytes) {

  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

}



function assembleReleaseStaging(releaseId) {

  verifyLocalStandaloneBuild();



  const stagingRoot = join(STAGING_DIR, releaseId);

  if (existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });

  mkdirSync(stagingRoot, { recursive: true });



  const standaloneSrc = join(ROOT, ".next", "standalone");

  for (const entry of require("fs").readdirSync(standaloneSrc)) {

    copyDir(join(standaloneSrc, entry), join(stagingRoot, entry));

  }



  mkdirSync(join(stagingRoot, ".next"), { recursive: true });

  copyDir(join(ROOT, ".next", "static"), join(stagingRoot, ".next", "static"));

  copyDir(join(ROOT, "public"), join(stagingRoot, "public"));

  copyDir(join(ROOT, "prisma"), join(stagingRoot, "prisma"));



  bundleStandaloneRuntimeDeps(stagingRoot);

  writeProductionPackageJson(stagingRoot);



  if (existsSync(join(ROOT, "next.config.js"))) {

    copyDir(join(ROOT, "next.config.js"), join(stagingRoot, "next.config.js"));

  }



  writeFileSync(join(stagingRoot, "index.js"), readFileSync(PASSENGER_INDEX, "utf8"));

  verifyReleaseStaging(stagingRoot);



  const { meta, manifest } = writeBuildMetadata(stagingRoot, releaseId);



  return { stagingRoot, meta, manifest };

}



async function createArchive(stagingRoot, archivePath) {

  return createTarGzArchive(stagingRoot, archivePath);

}



async function packageRelease(releaseId) {

  const { stagingRoot, meta, manifest } = assembleReleaseStaging(releaseId);

  const unstagedSize = dirSizeBytes(stagingRoot);



  const archivePath = join(DEPLOYMENT_DIR, "packages", `${releaseId}.tar.gz`);

  const archive = await createArchive(stagingRoot, archivePath);

  const compressedSize = archive.bytes;



  rmSync(stagingRoot, { recursive: true, force: true });



  const marker = join(DEPLOYMENT_DIR, "packages", "latest.json");

  writeFileSync(

    marker,

    `${JSON.stringify({ releaseId, deployId: releaseId, packageType: "standalone", archive: archive.path, format: archive.format, packagedAt: new Date().toISOString(), ...meta }, null, 2)}\n`

  );



  return {

    releaseId,

    archivePath: archive.path,

    archiveFormat: archive.format,

    unstagedSize,

    compressedSize,

    meta,

    manifest,

    sizeHuman: formatBytes(unstagedSize),

    compressedHuman: formatBytes(compressedSize),

  };

}



module.exports = {

  verifyLocalStandaloneBuild,

  assembleReleaseStaging,

  packageRelease,

  formatBytes,

  verifyReleaseStaging,

};


