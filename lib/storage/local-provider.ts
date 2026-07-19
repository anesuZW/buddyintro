import "server-only";



import { mkdir, unlink, access, readFile, writeFile, stat } from "fs/promises";

import { constants } from "fs";

import { dirname, resolve, sep } from "path";

import type {

  MediaVariant,

  MediaVariantUrls,

  StorageProvider,

  StorageProviderCapabilities,

  StoragePublicUrlOptions,

  StorageReadResult,

  StorageUploadOptions,

  StorageUploadResult,

} from "@/lib/storage/types";

import { getMediaRoot } from "@/lib/storage/config";

import {

  buildStorageObjectPath,

  collectVariantStoragePaths,

  getStorageKind,

  imageVariantStoragePath,

  isSafeStoragePath,

  normalizeStoragePath,

  resolveVariantStoragePath,

  stripVariantSuffix,

  uploadsPublicPath,

  videoPreviewStoragePath,

} from "@/lib/storage/paths";

import { extractStoragePath } from "@/lib/storage-url";

import {

  getMediaObjectVariants,

  registerOrReuseMediaObject,

  releaseMediaObjectByPath,

} from "@/services/media/media-registry";

import { enqueueMediaProcess } from "@/services/media/media-queue";

import { etagForBuffer } from "@/services/media/media-cleanup";



function resolveAbsolutePath(relativePath: string): string {

  const normalized = normalizeStoragePath(relativePath);

  const root = resolve(getMediaRoot());

  const absolute = resolve(root, normalized);

  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {

    throw new Error("Invalid storage path");

  }

  return absolute;

}



function guessContentType(path: string): string {

  const ext = path.split(".").pop()?.toLowerCase();

  switch (ext) {

    case "jpg":

    case "jpeg":

      return "image/jpeg";

    case "png":

      return "image/png";

    case "webp":

      return "image/webp";

    case "gif":

      return "image/gif";

    case "mp4":

      return "video/mp4";

    case "webm":

      return path.includes("/audio/") || path.startsWith("audio/") ? "audio/webm" : "video/webm";

    case "mp3":

      return "audio/mpeg";

    default:

      return "application/octet-stream";

  }

}



function resolveStoredPath(storedOrPath: string): string | null {

  const path = extractStoragePath(storedOrPath) ?? normalizeStoragePath(storedOrPath);

  if (!path || !isSafeStoragePath(path)) return null;

  return path;

}



function pathBasedVariantUrls(canonical: string): MediaVariantUrls {

  const kind = getStorageKind(canonical);

  const toPublic = (storagePath: string) => uploadsPublicPath(storagePath);



  if (kind === "image") {

    const base = stripVariantSuffix(canonical);

    return {

      tiny: toPublic(imageVariantStoragePath(base, "tiny")),

      thumb: toPublic(imageVariantStoragePath(base, "thumb")),

      medium: toPublic(imageVariantStoragePath(base, "medium")),

      large: toPublic(imageVariantStoragePath(base, "large")),

      original: toPublic(imageVariantStoragePath(base, "original")),

    };

  }



  if (kind === "video") {

    return {

      original: toPublic(canonical),

      preview: toPublic(videoPreviewStoragePath(canonical)),

    };

  }



  return { original: toPublic(canonical) };

}



export class LocalStorageProvider implements StorageProvider {

  readonly name = "local" as const;



  readonly capabilities: StorageProviderCapabilities = {

    imageOptimization: true,

    videoTranscoding: true,

    videoPreview: true,

    backgroundProcessing: true,

    deduplication: true,

    variants: ["tiny", "thumb", "medium", "large", "original", "preview", "poster", "480p", "720p", "1080p"],

  };



  getPublicUrl(path: string, options?: StoragePublicUrlOptions): string {

    const canonical = resolveStoredPath(path) ?? normalizeStoragePath(path);

    const target =

      options?.variant && options.variant !== "original"

        ? resolveVariantStoragePath(canonical, options.variant) ?? canonical

        : canonical;

    return uploadsPublicPath(target);

  }



  getVariantUrls(storedOrPath: string): MediaVariantUrls {

    const canonical = resolveStoredPath(storedOrPath);

    if (!canonical) return {};

    return pathBasedVariantUrls(canonical);

  }



  async upload(data: Buffer, options: StorageUploadOptions): Promise<StorageUploadResult> {

    const objectPath = buildStorageObjectPath(options);

    if (!isSafeStoragePath(objectPath)) {

      throw new Error("Invalid upload path");

    }



    const registered = await registerOrReuseMediaObject({

      data,

      ownerId: options.userId,

      kind: options.kind,

      storagePath: objectPath,

      mimeType: options.contentType,

      skipDedup: options.skipDedup,

    });



    if (!registered.deduplicated) {

      await this.writeStorageFile(objectPath, data);

    }



    const needsProcessing = options.kind === "image" || options.kind === "video";

    if (
      needsProcessing &&
      registered.result.processingStatus !== "ready" &&
      registered.result.processingStatus !== "processing"
    ) {

      await enqueueMediaProcess({

        mediaObjectId: registered.mediaObjectId,

        storagePath: registered.storagePath,

        kind: options.kind,

        ownerId: options.userId,

      });

    }



    const registryVariants =

      (await getMediaObjectVariants(registered.storagePath)) ?? registered.result.variants;



    return {

      path: registered.storagePath,

      publicUrl: registered.result.publicUrl,

      variants: registryVariants ?? pathBasedVariantUrls(registered.storagePath),

      contentType: options.contentType || guessContentType(objectPath),

      processingStatus: registered.result.processingStatus ?? (needsProcessing ? "pending" : "ready"),

      deduplicated: registered.deduplicated,

      mediaObjectId: registered.mediaObjectId,

    };

  }



  private async writeStorageFile(relativePath: string, data: Buffer): Promise<void> {

    if (!isSafeStoragePath(relativePath)) {

      throw new Error("Invalid storage path");

    }

    const absolute = resolveAbsolutePath(relativePath);

    await mkdir(dirname(absolute), { recursive: true });

    await writeFile(absolute, data);

  }



  async delete(path: string): Promise<void> {

    const canonical = resolveStoredPath(path);

    if (!canonical) return;



    const release = await releaseMediaObjectByPath(canonical);

    if (release && !release.deleteFiles) return;



    const targets = collectVariantStoragePaths(release?.storagePath ?? canonical);

    await Promise.all(

      targets.map(async (target) => {

        try {

          await unlink(resolveAbsolutePath(target));

        } catch (err: unknown) {

          if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") throw err;

        }

      })

    );

  }



  async exists(path: string): Promise<boolean> {

    const storagePath = resolveStoredPath(path);

    if (!storagePath) return false;



    try {

      await access(resolveAbsolutePath(storagePath), constants.R_OK);

      return true;

    } catch {

      return false;

    }

  }



  async readFile(path: string): Promise<StorageReadResult | null> {

    const storagePath = resolveStoredPath(path);

    if (!storagePath) return null;



    try {

      const absolute = resolveAbsolutePath(storagePath);

      const [data, fileStat] = await Promise.all([readFile(absolute), stat(absolute)]);

      return {

        data,

        contentType: guessContentType(storagePath),

        etag: etagForBuffer(data),

        lastModified: fileStat.mtime,

      };

    } catch {

      return null;

    }

  }



  async getReadableUrl(

    storedOrPath: string,

    options?: { expiresInSeconds?: number; variant?: MediaVariant }

  ): Promise<string | null> {

    const canonical = resolveStoredPath(storedOrPath);

    if (!canonical) return null;



    const target =

      options?.variant && options.variant !== "original"

        ? resolveVariantStoragePath(canonical, options.variant) ?? canonical

        : canonical;



    if (!(await this.exists(target))) return null;



    const relative = uploadsPublicPath(target);

    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return `${base.replace(/\/$/, "")}${relative}`;

  }

}


