import "server-only";

import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import { dirname, resolve, sep } from "path";
import type { MediaVariantUrls, UploadKind } from "@/lib/storage/types";
import { getMediaRoot } from "@/lib/storage/config";
import {
  collectVariantStoragePaths,
  isSafeStoragePath,
  normalizeStoragePath,
  uploadsPublicPath,
  videoPreviewStoragePath,
  videoPosterStoragePath,
  videoVariantStoragePath,
} from "@/lib/storage/paths";
import {
  imageVariantUrlsFromPaths,
  optimizeImageVariants,
  writePreviewAndPoster,
  writeTranscodeVariant,
} from "@/lib/storage/media-optimizer";
import {
  markMediaObjectProcessing,
  updateMediaObjectVariants,
} from "@/services/media/media-registry";
import { setMediaJobProgress } from "@/services/media/media-queue";

function resolveAbsolutePath(relativePath: string): string {
  const normalized = normalizeStoragePath(relativePath);
  const root = resolve(getMediaRoot());
  const absolute = resolve(root, normalized);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    throw new Error("Invalid storage path");
  }
  return absolute;
}

async function writeStorageFile(relativePath: string, data: Buffer): Promise<void> {
  if (!isSafeStoragePath(relativePath)) throw new Error("Invalid storage path");
  const absolute = resolveAbsolutePath(relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
}

export async function processMediaObject(args: {
  mediaObjectId: string;
  storagePath: string;
  kind: UploadKind;
}): Promise<MediaVariantUrls> {
  await markMediaObjectProcessing(args.mediaObjectId);
  await setMediaJobProgress(args.mediaObjectId, 5, "started");

  try {
    if (args.kind === "image") {
      return await processImage(args.mediaObjectId, args.storagePath);
    }
    if (args.kind === "video") {
      return await processVideo(args.mediaObjectId, args.storagePath);
    }

    const urls = { original: uploadsPublicPath(args.storagePath) };
    await updateMediaObjectVariants(args.mediaObjectId, { original: args.storagePath }, "ready");
    return urls;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateMediaObjectVariants(args.mediaObjectId, { original: args.storagePath }, "failed", message);
    throw err;
  }
}

async function processImage(
  mediaObjectId: string,
  storagePath: string
): Promise<MediaVariantUrls> {
  await setMediaJobProgress(mediaObjectId, 20, "optimizing_image");
  const sourceAbsolute = resolveAbsolutePath(storagePath);
  const input = await readFile(sourceAbsolute);
  const baseId = storagePath.replace(/\.[a-z0-9]+$/i, "");
  const optimized = await optimizeImageVariants(input, baseId);

  const variantPaths: Record<string, string> = {};
  for (const [variant, buffer] of Object.entries(optimized.buffers)) {
    const path = optimized.paths[variant as keyof typeof optimized.paths];
    await writeStorageFile(path, buffer);
    variantPaths[variant] = path;
  }

  const urls = imageVariantUrlsFromPaths(optimized.paths, uploadsPublicPath);
  await updateMediaObjectVariants(mediaObjectId, variantPaths, "ready");
  await setMediaJobProgress(mediaObjectId, 100, "complete");

  if (storagePath !== optimized.paths.original) {
    try {
      await unlink(sourceAbsolute);
    } catch {
      /* best effort */
    }
  }

  return urls;
}

async function processVideo(
  mediaObjectId: string,
  storagePath: string
): Promise<MediaVariantUrls> {
  const sourceAbsolute = resolveAbsolutePath(storagePath);
  const variantPaths: Record<string, string> = { original: storagePath };

  const previewPath = videoPreviewStoragePath(storagePath);
  const posterPath = videoPosterStoragePath(storagePath);
  await writePreviewAndPoster(
    sourceAbsolute,
    resolveAbsolutePath(previewPath),
    resolveAbsolutePath(posterPath)
  );
  variantPaths.preview = previewPath;
  variantPaths.poster = posterPath;

  for (const variant of ["480p", "720p", "1080p"] as const) {
    const targetPath = videoVariantStoragePath(storagePath, variant);
    const ok = await writeTranscodeVariant(
      sourceAbsolute,
      storagePath,
      variant,
      resolveAbsolutePath(targetPath)
    );
    if (ok) variantPaths[variant] = targetPath;
  }

  const urls: MediaVariantUrls = {};
  for (const [variant, path] of Object.entries(variantPaths)) {
    urls[variant as keyof MediaVariantUrls] = uploadsPublicPath(path);
  }

  await updateMediaObjectVariants(mediaObjectId, variantPaths, "ready");
  await setMediaJobProgress(mediaObjectId, 100, "complete");
  return urls;
}

export function listAllVariantPaths(canonicalPath: string): string[] {
  return collectVariantStoragePaths(canonicalPath);
}
