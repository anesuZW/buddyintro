/**

 * Pure Node.js archive creation — no system tar/zip executables.

 * Works identically on Windows, macOS, and Linux.

 */

const { createWriteStream, existsSync, mkdirSync, rmSync, statSync } = require("fs");

const { dirname } = require("path");



/** @type {Promise<typeof import("archiver")> | null} */

let archiverModulePromise = null;



function loadArchiverModule() {

  if (!archiverModulePromise) {

    archiverModulePromise = import("archiver");

  }

  return archiverModulePromise;

}



async function createArchiveInstance(format) {

  const { TarArchive, ZipArchive } = await loadArchiverModule();

  if (format === "zip") {

    return new ZipArchive({ zlib: { level: 9 } });

  }

  return new TarArchive({ gzip: true, gzipOptions: { level: 6 } });

}



/**

 * Archive directory contents at the archive root (not wrapped in a parent folder).

 * @param {string} sourceDir

 * @param {string} destPath

 * @param {"tar.gz"|"zip"} format

 */

async function createArchiveFromDirectory(sourceDir, destPath, format = "tar.gz") {

  mkdirSync(dirname(destPath), { recursive: true });

  if (existsSync(destPath)) rmSync(destPath, { force: true });



  const archive = await createArchiveInstance(format === "zip" ? "zip" : "tar");

  const output = createWriteStream(destPath);



  archive.pipe(output);

  archive.directory(sourceDir, false);



  const closePromise = new Promise((resolve, reject) => {

    output.on("close", resolve);

    output.on("error", reject);

    archive.on("error", reject);

    archive.on("warning", (err) => {

      if (err.code === "ENOENT") return;

      reject(err);

    });

  });



  await archive.finalize();

  await closePromise;



  return {

    format: format === "zip" ? "zip" : "tar.gz",

    path: destPath,

    bytes: statSync(destPath).size,

  };

}



function createTarGzArchive(sourceDir, destPath) {

  return createArchiveFromDirectory(sourceDir, destPath, "tar.gz");

}



function createZipArchive(sourceDir, destPath) {

  return createArchiveFromDirectory(sourceDir, destPath, "zip");

}



module.exports = {

  createArchiveFromDirectory,

  createTarGzArchive,

  createZipArchive,

};

