/**

 * Package application source for CloudLinux server-side build.

 */

const {

  cpSync,

  existsSync,

  mkdirSync,

  readdirSync,

  rmSync,

  statSync,

  writeFileSync,

} = require("fs");

const { join } = require("path");

const { ROOT, STAGING_DIR, DEPLOYMENT_DIR } = require("./paths");

const { createTarGzArchive } = require("./archive");

const { writeBuildMetadata } = require("./deploy-metadata");



const SOURCE_SKIP_DIRS = new Set([

  "node_modules",

  ".next",

  ".git",

  "backups",

  "deployment/staging",

  "deployment/packages",

  "deployment/logs",

  "deployment/failures",

  ".cursor",

  "coverage",

  "dist",

]);



const SOURCE_SKIP_FILES = new Set([

  "app.zip",

  ".env",

  ".env.local",

  ".env.production",

]);



function shouldSkip(relPath) {

  const normalized = relPath.replace(/\\/g, "/");

  if (SOURCE_SKIP_FILES.has(normalized)) return true;

  for (const skip of SOURCE_SKIP_DIRS) {

    if (normalized === skip || normalized.startsWith(`${skip}/`)) return true;

  }

  return false;

}



function copySourceTree(srcRoot, destRoot, rel = "") {

  const abs = join(srcRoot, rel);

  if (shouldSkip(rel)) return;

  const st = statSync(abs);

  if (st.isDirectory()) {

    mkdirSync(join(destRoot, rel), { recursive: true });

    for (const entry of readdirSync(abs)) {

      copySourceTree(srcRoot, destRoot, join(rel, entry));

    }

    return;

  }

  mkdirSync(join(destRoot, rel, ".."), { recursive: true });

  cpSync(abs, join(destRoot, rel));

}



function dirSizeBytes(dir) {

  let total = 0;

  const walk = (p) => {

    const st = statSync(p);

    if (st.isDirectory()) {

      for (const entry of readdirSync(p)) walk(join(p, entry));

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



function assembleSourceStaging(deployId) {

  const stagingRoot = join(STAGING_DIR, deployId);

  if (existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });

  mkdirSync(stagingRoot, { recursive: true });



  copySourceTree(ROOT, stagingRoot, "");



  if (!existsSync(join(stagingRoot, "package.json"))) {

    throw new Error("Source package missing package.json");

  }

  if (!existsSync(join(stagingRoot, "deployment", "templates", "index.passenger.js"))) {

    throw new Error("Source package missing deployment/templates/index.passenger.js");

  }



  const { meta, manifest } = writeBuildMetadata(stagingRoot, deployId);

  return { stagingRoot, meta, manifest };

}



async function packageSourceRelease(deployId) {

  const { stagingRoot, meta, manifest } = assembleSourceStaging(deployId);

  const unstagedSize = dirSizeBytes(stagingRoot);



  const archivePath = join(DEPLOYMENT_DIR, "packages", `${deployId}.tar.gz`);

  const archive = await createTarGzArchive(stagingRoot, archivePath);



  rmSync(stagingRoot, { recursive: true, force: true });



  const marker = join(DEPLOYMENT_DIR, "packages", "latest.json");

  writeFileSync(

    marker,

    `${JSON.stringify(

      {

        deployId,

        releaseId: deployId,

        archive: archive.path,

        format: archive.format,

        packagedAt: new Date().toISOString(),

        packageType: "source",

        ...meta,

      },

      null,

      2

    )}\n`

  );



  return {

    deployId,

    releaseId: deployId,

    archivePath: archive.path,

    archiveFormat: archive.format,

    unstagedSize,

    compressedSize: archive.bytes,

    meta,

    manifest,

    sizeHuman: formatBytes(unstagedSize),

    compressedHuman: formatBytes(archive.bytes),

  };

}



module.exports = {

  shouldSkip,

  assembleSourceStaging,

  packageSourceRelease,

};


