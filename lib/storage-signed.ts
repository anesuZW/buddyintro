import "server-only";

import { extractStoragePath } from "@/lib/storage-url";
import { getStorageProvider } from "@/lib/storage/index";
import {
  lookupSignedUrlCache,
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

  const provider = getStorageProvider();
  const lookup =
    provider.name === "supabase" ? lookupSignedUrlCache(path) : { hit: false, cacheLookupMs: 0, signedUrl: "" };

  if (lookup.hit) {
    return {
      signedUrl: lookup.signedUrl,
      cacheHit: true,
      cacheLookupMs: lookup.cacheLookupMs,
      createSignedUrlMs: 0,
    };
  }

  const signStart = performance.now();
  const signedUrl = await provider.getReadableUrl(path, { expiresInSeconds });
  const createSignedUrlMs = Math.round(performance.now() - signStart);

  if (!signedUrl) return null;

  if (process.env.PROFILE_PHASE2 === "1" || process.env.PROFILE_API === "1") {
    console.log(
      `[MEDIA-CACHE] store path=${path.replace(/^\/+/, "")} resolve=${createSignedUrlMs}ms provider=${provider.name}`
    );
  }

  return {
    signedUrl,
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
  if (stored.startsWith("/api/media") || stored.startsWith("/uploads/")) {
    return signStoragePath(stored);
  }
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    const path = extractStoragePath(stored);
    if (path) return signStoragePath(path);
    return stored;
  }
  return signStoragePath(stored);
}

export {
  getSignedUrlCacheStats,
  resetSignedUrlCacheStats,
  clearSignedUrlCache,
  SIGNED_URL_EXPIRY_SECONDS,
  SIGNED_URL_CACHE_TTL_MS,
} from "@/lib/storage-signed-cache";
