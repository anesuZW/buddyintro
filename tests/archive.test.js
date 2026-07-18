/**

 * Pure Node archive packaging tests.

 */

const { describe, it, beforeEach, afterEach } = require("node:test");

const assert = require("node:assert/strict");

const {

  mkdirSync,

  writeFileSync,

  rmSync,

  existsSync,

  readFileSync,

  mkdtempSync,

  createReadStream,

  createWriteStream,

} = require("fs");

const { join, dirname } = require("path");

const { tmpdir } = require("os");

const zlib = require("zlib");

const tar = require("tar-stream");

const { createTarGzArchive, createZipArchive } = require("../scripts/lib/archive");



function extractTarGz(archivePath, destDir) {

  return new Promise((resolve, reject) => {

    const extract = tar.extract();

    extract.on("entry", (header, stream, next) => {

      const filePath = join(destDir, header.name);

      if (header.type === "file") {

        mkdirSync(dirname(filePath), { recursive: true });

        const ws = createWriteStream(filePath);

        stream.pipe(ws);

        ws.on("finish", next);

        ws.on("error", reject);

      } else if (header.type === "directory") {

        mkdirSync(filePath, { recursive: true });

        stream.on("end", next);

        stream.resume();

      } else {

        stream.on("end", next);

        stream.resume();

      }

    });

    extract.on("finish", resolve);

    extract.on("error", reject);

    createReadStream(archivePath).pipe(zlib.createGunzip()).pipe(extract);

  });

}



describe("archive.js", () => {

  let workDir;

  let sourceDir;



  beforeEach(() => {

    workDir = mkdtempSync(join(tmpdir(), "buddyintro-archive-"));

    sourceDir = join(workDir, "staging");

    mkdirSync(join(sourceDir, "nested"), { recursive: true });

    writeFileSync(join(sourceDir, "server.js"), "module.exports = {};\n");

    writeFileSync(join(sourceDir, "nested", "readme.txt"), "hello\n");

  });



  afterEach(() => {

    if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });

  });



  it("creates tar.gz without system tar executable", async () => {

    const dest = join(workDir, "release.tar.gz");

    const result = await createTarGzArchive(sourceDir, dest);

    assert.equal(result.format, "tar.gz");

    assert.ok(existsSync(dest));

    assert.ok(result.bytes > 50);

    const header = readFileSync(dest).subarray(0, 2);

    assert.deepEqual([...header], [0x1f, 0x8b]);

  });



  it("creates zip without system zip executable", async () => {

    const dest = join(workDir, "release.zip");

    const result = await createZipArchive(sourceDir, dest);

    assert.equal(result.format, "zip");

    assert.ok(existsSync(dest));

    assert.ok(result.bytes > 50);

    const header = readFileSync(dest).subarray(0, 2);

    assert.deepEqual([...header], [0x50, 0x4b]);

  });



  it("places directory contents at archive root", async () => {

    const dest = join(workDir, "release.tar.gz");

    const extractDir = join(workDir, "extracted");

    mkdirSync(extractDir, { recursive: true });



    await createTarGzArchive(sourceDir, dest);

    await extractTarGz(dest, extractDir);



    assert.ok(existsSync(join(extractDir, "server.js")));

    assert.ok(existsSync(join(extractDir, "nested", "readme.txt")));

    assert.ok(!existsSync(join(extractDir, "staging", "server.js")));

  });

});

