import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/constants";
import { extractStoragePath } from "@/lib/storage-url";
import {
  lookupSignedUrlCache,
  setCachedSignedUrl,
  SIGNED_URL_EXPIRY_SECONDS,
} from "@/lib/storage-signed-cache";

export type SignStoragePathResult = {
  signedUrl: string;
  cacheHit: boolean;
  cacheLookupMs: number;
  createSignedUrlMs: number;
};

export async function signStoragePathDetailed(
  storedOrPath: string,
  expiresInSeconds = SIGNED_URL_EXPIRY_SECONDS
): Promise<SignStoragePathResult | null> {
  const path = extractStoragePath(storedOrPath) ?? storedOrPath;
  if (!path) return null;

  const lookup = lookupSignedUrlCache(path);
  if (lookup.hit) {
    return {
      signedUrl: lookup.signedUrl,
      cacheHit: true,
      cacheLookupMs: lookup.cacheLookupMs,
      createSignedUrlMs: 0,
    };
  }

  const signStart = performance.now();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  const createSignedUrlMs = Math.round(performance.now() - signStart);

  if (error || !data?.signedUrl) return null;

  setCachedSignedUrl(path, data.signedUrl);

  if (process.env.PROFILE_PHASE2 === "1" || process.env.PROFILE_API === "1") {
    console.log(
      `[MEDIA-CACHE] store path=${path.replace(/^\/+/, "")} createSignedUrl=${createSignedUrlMs}ms ttl=${SIGNED_URL_EXPIRY_SECONDS - 600}s`
    );
  }

  return {
    signedUrl: data.signedUrl,
    cacheHit: false,
    cacheLookupMs: lookup.cacheLookupMs,
    createSignedUrlMs,
  };
}

export async function signStoragePath(
  storedOrPath: string,
  expiresInSeconds = SIGNED_URL_EXPIRY_SECONDS
): Promise<string | null> {
  const result = await signStoragePathDetailed(storedOrPath, expiresInSeconds);
  return result?.signedUrl ?? null;
}

export async function signStoredMediaUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith("/api/media")) return stored;
  return signStoragePath(stored);
}

export {
  getSignedUrlCacheStats,
  resetSignedUrlCacheStats,
  clearSignedUrlCache,
  SIGNED_URL_EXPIRY_SECONDS,
  SIGNED_URL_CACHE_TTL_MS,
} from "@/lib/storage-signed-cache";
