/**

 * Storage variant path tests.

 */

import { describe, it } from "node:test";

import assert from "node:assert/strict";

import {

  buildStorageObjectBase,

  collectVariantStoragePaths,

  detectStorageLayout,

  imageVariantStoragePath,

  resolveVariantStoragePath,

  videoPreviewStoragePath,

  isSafeStoragePath,

} from "../lib/storage/paths";

import { resolveMediaVariantUrl } from "../lib/storage-url";

import { sha256Buffer } from "../lib/storage/hash";



describe("image variant paths", () => {

  const legacyBase = "550e8400-e29b-41d4-a716-446655440000/image/abc123";

  const v2Base = "images/2026/07/550e8400-e29b-41d4-a716-446655440000/abc123";



  it("generates WebP variant filenames (legacy)", () => {

    assert.equal(imageVariantStoragePath(legacyBase, "tiny"), `${legacyBase}-w64.webp`);

    assert.equal(imageVariantStoragePath(legacyBase, "thumb"), `${legacyBase}-w200.webp`);

    assert.equal(imageVariantStoragePath(legacyBase, "medium"), `${legacyBase}-w800.webp`);

    assert.equal(imageVariantStoragePath(legacyBase, "large"), `${legacyBase}-w1600.webp`);

    assert.equal(imageVariantStoragePath(legacyBase, "original"), `${legacyBase}.webp`);

  });



  it("generates WebP variant filenames (v2)", () => {

    assert.equal(imageVariantStoragePath(v2Base, "tiny"), `${v2Base}-w64.webp`);

    assert.equal(imageVariantStoragePath(v2Base, "large"), `${v2Base}-w1600.webp`);

  });



  it("collects all image derivatives for delete", () => {

    const canonical = `${legacyBase}.webp`;

    const paths = collectVariantStoragePaths(canonical);

    assert.ok(paths.includes(`${legacyBase}-w64.webp`));

    assert.ok(paths.includes(`${legacyBase}-w200.webp`));

    assert.ok(paths.includes(`${legacyBase}-w800.webp`));

    assert.ok(paths.includes(`${legacyBase}-w1600.webp`));

    assert.ok(paths.includes(`${legacyBase}.webp`));

  });

});



describe("video preview paths", () => {

  const legacyVideo = "550e8400-e29b-41d4-a716-446655440000/video/clip.mp4";

  const v2Video = "videos/2026/07/550e8400-e29b-41d4-a716-446655440000/clip.mp4";



  it("stores legacy preview under thumbnails/{userId}/video/", () => {

    assert.equal(

      videoPreviewStoragePath(legacyVideo),

      "thumbnails/550e8400-e29b-41d4-a716-446655440000/video/clip.webp"

    );

  });



  it("stores v2 preview under thumbnails/YYYY/MM/{userId}/", () => {

    assert.equal(

      videoPreviewStoragePath(v2Video),

      "thumbnails/2026/07/550e8400-e29b-41d4-a716-446655440000/clip.webp"

    );

  });



  it("resolveVariantStoragePath returns preview path", () => {

    assert.equal(resolveVariantStoragePath(legacyVideo, "preview"), videoPreviewStoragePath(legacyVideo));

  });



  it("collectVariantStoragePaths includes preview and transcodes", () => {

    const paths = collectVariantStoragePaths(v2Video);

    assert.ok(paths.includes(videoPreviewStoragePath(v2Video)));

    assert.ok(paths.some((p) => p.endsWith("-720p.mp4")));

  });

});



describe("resolveMediaVariantUrl local", () => {

  const originalMedia = process.env.MEDIA_PROVIDER;

  const originalPublic = process.env.NEXT_PUBLIC_MEDIA_PROVIDER;

  process.env.MEDIA_PROVIDER = "local";

  process.env.NEXT_PUBLIC_MEDIA_PROVIDER = "local";



  const canonical = "550e8400-e29b-41d4-a716-446655440000/image/abc123.webp";



  it("maps thumb variant to /uploads/", () => {

    assert.match(resolveMediaVariantUrl(canonical, "thumb"), /\/uploads\/.*-w200\.webp$/);

  });



  it("maps tiny variant to /uploads/", () => {

    assert.match(resolveMediaVariantUrl(canonical, "tiny"), /\/uploads\/.*-w64\.webp$/);

  });



  process.env.MEDIA_PROVIDER = originalMedia;

  process.env.NEXT_PUBLIC_MEDIA_PROVIDER = originalPublic;

});



describe("filesystem layout detection", () => {

  it("detects v2 layout", () => {

    assert.equal(

      detectStorageLayout("images/2026/07/u1/file.webp"),

      "v2"

    );

    assert.equal(

      detectStorageLayout("550e8400-e29b-41d4-a716-446655440000/image/x.jpg"),

      "legacy"

    );

  });



  it("buildStorageObjectBase creates v2 hierarchical ids", () => {

    const base = buildStorageObjectBase({

      userId: "550e8400-e29b-41d4-a716-446655440000",

      kind: "image",

      date: new Date("2026-07-19T00:00:00.000Z"),

    });

    assert.match(base, /^images\/2026\/07\//);

    assert.doesNotMatch(base, /\.\w+$/);

  });

});



describe("thumbnail path safety", () => {

  it("allows legacy thumbnails/ paths with 4 segments", () => {

    assert.equal(

      isSafeStoragePath("thumbnails/550e8400-e29b-41d4-a716-446655440000/video/x.webp"),

      true

    );

  });



  it("allows v2 thumbnails/ paths with 5 segments", () => {

    assert.equal(

      isSafeStoragePath("thumbnails/2026/07/550e8400-e29b-41d4-a716-446655440000/x.webp"),

      true

    );

  });

});



describe("duplicate detection hash", () => {

  it("sha256Buffer is stable", () => {

    const hash = sha256Buffer(Buffer.from("same-content"));

    assert.equal(hash, sha256Buffer(Buffer.from("same-content")));

    assert.notEqual(hash, sha256Buffer(Buffer.from("other")));

  });

});


