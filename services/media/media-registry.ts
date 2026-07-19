import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MediaVariantUrls, StorageUploadResult, UploadKind } from "@/lib/storage/types";
import { uploadsPublicPath } from "@/lib/storage/paths";
import { sha256Buffer } from "@/lib/storage/hash";

function variantUrlsFromRecord(
  variants: Prisma.JsonValue,
  fallbackPath: string
): MediaVariantUrls {
  if (!variants || typeof variants !== "object" || Array.isArray(variants)) {
    return { original: uploadsPublicPath(fallbackPath) };
  }
  const record = variants as Record<string, string>;
  const urls: MediaVariantUrls = {};
  for (const [key, value] of Object.entries(record)) {
    urls[key as keyof MediaVariantUrls] = value.startsWith("/")
      ? value
      : uploadsPublicPath(value);
  }
  return urls;
}

export async function registerOrReuseMediaObject(args: {
  data: Buffer;
  ownerId: string;
  kind: UploadKind;
  storagePath: string;
  mimeType?: string;
  skipDedup?: boolean;
}): Promise<{
  mediaObjectId: string;
  deduplicated: boolean;
  storagePath: string;
  result: Pick<StorageUploadResult, "publicUrl" | "variants" | "processingStatus">;
}> {
  const contentHash = sha256Buffer(args.data);
  const publicUrl = uploadsPublicPath(args.storagePath);

  if (!args.skipDedup) {
    const existing = await prisma.mediaObject.findUnique({ where: { contentHash } });
    if (existing) {
      await prisma.mediaObject.update({
        where: { id: existing.id },
        data: { refCount: { increment: 1 } },
      });
      return {
        mediaObjectId: existing.id,
        deduplicated: true,
        storagePath: existing.storagePath,
        result: {
          publicUrl: uploadsPublicPath(existing.storagePath),
          variants: variantUrlsFromRecord(existing.variants, existing.storagePath),
          processingStatus: existing.status,
        },
      };
    }
  }

  const created = await prisma.mediaObject.create({
    data: {
      contentHash,
      storagePath: args.storagePath,
      kind: args.kind,
      mimeType: args.mimeType,
      byteSize: args.data.length,
      ownerId: args.ownerId,
      status: args.kind === "audio" ? "ready" : "pending",
      variants: { original: args.storagePath } as Prisma.InputJsonValue,
      processedAt: args.kind === "audio" ? new Date() : undefined,
    },
  });

  return {
    mediaObjectId: created.id,
    deduplicated: false,
    storagePath: args.storagePath,
    result: {
      publicUrl,
      variants: { original: publicUrl },
      processingStatus: "pending",
    },
  };
}

export async function releaseMediaObjectByPath(
  storedPath: string
): Promise<{ deleteFiles: boolean; storagePath: string } | null> {
  const normalized = storedPath.replace(/^\/uploads\//, "");
  const row = await prisma.mediaObject.findFirst({
    where: { storagePath: normalized },
  });
  if (!row) return null;

  if (row.refCount <= 1) {
    await prisma.mediaObject.delete({ where: { id: row.id } });
    return { deleteFiles: true, storagePath: row.storagePath };
  }

  await prisma.mediaObject.update({
    where: { id: row.id },
    data: { refCount: { decrement: 1 } },
  });
  return { deleteFiles: false, storagePath: row.storagePath };
}

export async function updateMediaObjectVariants(
  mediaObjectId: string,
  variantPaths: Record<string, string>,
  status: "ready" | "failed",
  lastError?: string
): Promise<void> {
  await prisma.mediaObject.update({
    where: { id: mediaObjectId },
    data: {
      status,
      variants: variantPaths as Prisma.InputJsonValue,
      processedAt: status === "ready" ? new Date() : undefined,
      lastError: lastError ?? null,
    },
  });
}

export async function markMediaObjectProcessing(mediaObjectId: string): Promise<void> {
  await prisma.mediaObject.update({
    where: { id: mediaObjectId },
    data: { status: "processing", lastError: null },
  });
}

export async function getMediaObjectVariants(storedOrPath: string): Promise<MediaVariantUrls | null> {
  const path = storedOrPath.replace(/^\/uploads\//, "").replace(/^\/api\/media\?path=/, "");
  const row = await prisma.mediaObject.findFirst({
    where: {
      OR: [{ storagePath: path }, { storagePath: { endsWith: path.split("/").pop() || path } }],
    },
  });
  if (!row) return null;
  return variantUrlsFromRecord(row.variants, row.storagePath);
}
