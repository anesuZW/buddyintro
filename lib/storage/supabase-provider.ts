import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/constants";
import type {
  MediaVariantUrls,
  StorageProvider,
  StorageProviderCapabilities,
  StoragePublicUrlOptions,
  StorageReadResult,
  StorageUploadOptions,
  StorageUploadResult,
} from "@/lib/storage/types";
import {
  buildStorageObjectPath,
  isSafeStoragePath,
  mediaProxyPath,
  normalizeStoragePath,
} from "@/lib/storage/paths";
import { extractStoragePath } from "@/lib/storage-url";
import {
  lookupSignedUrlCache,
  setCachedSignedUrl,
  SIGNED_URL_EXPIRY_SECONDS,
} from "@/lib/storage-signed-cache";

function resolveObjectPath(storedOrPath: string): string | null {
  const path = extractStoragePath(storedOrPath) ?? normalizeStoragePath(storedOrPath);
  if (!path || !isSafeStoragePath(path)) return null;
  return path;
}

/**
 * Supabase Storage provider — passthrough uploads today; variant hooks reserved for
 * future image transformation or sibling-object conventions (R2/B2 compatible API).
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase" as const;

  readonly capabilities: StorageProviderCapabilities = {
    imageOptimization: false,
    videoTranscoding: false,
    videoPreview: false,
    backgroundProcessing: false,
    deduplication: false,
    variants: ["original"],
  };

  getPublicUrl(path: string, _options?: StoragePublicUrlOptions): string {
    const objectPath = resolveObjectPath(path);
    if (!objectPath) return path;
    return mediaProxyPath(objectPath);
  }

  getVariantUrls(storedOrPath: string): MediaVariantUrls {
    const objectPath = resolveObjectPath(storedOrPath);
    if (!objectPath) return {};
    const original = mediaProxyPath(objectPath);
    return { original };
  }

  async upload(data: Buffer, options: StorageUploadOptions): Promise<StorageUploadResult> {
    const objectPath = buildStorageObjectPath(options);
    if (!isSafeStoragePath(objectPath)) {
      throw new Error("Invalid upload path");
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(objectPath, data, {
      cacheControl: "3600",
      contentType: options.contentType || undefined,
      upsert: false,
    });

    if (error) throw new Error(error.message);

    const publicUrl = mediaProxyPath(objectPath);
    return {
      path: objectPath,
      publicUrl,
      variants: { original: publicUrl },
      contentType: options.contentType,
    };
  }

  async delete(path: string): Promise<void> {
    const objectPath = resolveObjectPath(path);
    if (!objectPath) return;

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([objectPath]);
    if (error) throw new Error(error.message);
  }

  async exists(path: string): Promise<boolean> {
    const objectPath = resolveObjectPath(path);
    if (!objectPath) return false;

    const supabase = getSupabaseAdminClient();
    const folder = objectPath.split("/").slice(0, -1).join("/");
    const filename = objectPath.split("/").pop()!;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).list(folder, {
      search: filename,
      limit: 1,
    });
    if (error) return false;
    return (data ?? []).some((item) => item.name === filename);
  }

  async readFile(path: string): Promise<StorageReadResult | null> {
    const objectPath = resolveObjectPath(path);
    if (!objectPath) return null;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(objectPath);
    if (error || !data) return null;

    const buffer = Buffer.from(await data.arrayBuffer());
    return { data: buffer, contentType: data.type || "application/octet-stream" };
  }

  async getReadableUrl(
    storedOrPath: string,
    options?: { expiresInSeconds?: number; variant?: "thumb" | "medium" | "original" | "preview" }
  ): Promise<string | null> {
    const objectPath = resolveObjectPath(storedOrPath);
    if (!objectPath) return null;

    if (options?.variant && options.variant !== "original") {
      return null;
    }

    const expiresIn = options?.expiresInSeconds ?? SIGNED_URL_EXPIRY_SECONDS;
    const lookup = lookupSignedUrlCache(objectPath);
    if (lookup.hit) return lookup.signedUrl;

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(objectPath, expiresIn);

    if (error || !data?.signedUrl) return null;
    setCachedSignedUrl(objectPath, data.signedUrl);
    return data.signedUrl;
  }
}
