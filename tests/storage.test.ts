/**
 * Storage provider abstraction tests.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractStoragePath,
  resolveMediaUrlForClient,
} from "../lib/storage-url";
import {
  isSafeStoragePath,
  uploadsPublicPath,
  mediaProxyPath,
} from "../lib/storage/paths";
import { storedMediaUrlSchema } from "../lib/storage/validation";

describe("storage paths", () => {
  it("extractStoragePath parses /uploads paths", () => {
    const path = "user-1/image/file.jpg";
    assert.equal(extractStoragePath(`/uploads/${path}`), path);
  });

  it("extractStoragePath parses /api/media proxy paths", () => {
    const path = "user-1/video/clip.mp4";
    assert.equal(extractStoragePath(`/api/media?path=${encodeURIComponent(path)}`), path);
  });

  it("extractStoragePath parses raw storage paths", () => {
    const path = "550e8400-e29b-41d4-a716-446655440000/audio/note.webm";
    assert.equal(extractStoragePath(path), path);
  });

  it("isSafeStoragePath rejects traversal", () => {
    assert.equal(isSafeStoragePath("a/b/../c/file.jpg"), false);
    assert.equal(isSafeStoragePath("550e8400-e29b-41d4-a716-446655440000/image/a.jpg"), true);
  });
});

describe("storedMediaUrlSchema", () => {
  it("accepts uploads, proxy, url, and raw paths", () => {
    assert.ok(storedMediaUrlSchema.safeParse("/uploads/u1/image/x.jpg").success);
    assert.ok(storedMediaUrlSchema.safeParse("/api/media?path=u1/image/x.jpg").success);
    assert.ok(storedMediaUrlSchema.safeParse("https://example.com/x.jpg").success);
    assert.ok(
      storedMediaUrlSchema.safeParse("550e8400-e29b-41d4-a716-446655440000/image/x.jpg").success
    );
  });
});

describe("resolveMediaUrlForClient with local provider", () => {
  const originalMedia = process.env.MEDIA_PROVIDER;
  const originalPublic = process.env.NEXT_PUBLIC_MEDIA_PROVIDER;
  process.env.MEDIA_PROVIDER = "local";
  process.env.NEXT_PUBLIC_MEDIA_PROVIDER = "local";

  const userPath = "550e8400-e29b-41d4-a716-446655440000/image/x.jpg";

  it("maps raw path to /uploads/", () => {
    assert.equal(resolveMediaUrlForClient(userPath), uploadsPublicPath(userPath));
  });

  it("maps proxy path to /uploads/ when local", () => {
    assert.equal(
      resolveMediaUrlForClient(mediaProxyPath(userPath)),
      uploadsPublicPath(userPath)
    );
  });

  process.env.MEDIA_PROVIDER = originalMedia;
  process.env.NEXT_PUBLIC_MEDIA_PROVIDER = originalPublic;
});
