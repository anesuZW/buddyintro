import "server-only";

/** Signed URL lifetime passed to Supabase Storage (seconds). */
export const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

/** Cache TTL — 10 minutes shorter than signed URL expiry so cached URLs never outlive validity. */
export const SIGNED_URL_CACHE_TTL_MS = (SIGNED_URL_EXPIRY_SECONDS - 600) * 1000;

type CacheEntry = {
  signedUrl: string;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

let hits = 0;
let misses = 0;

function isProfileEnabled(): boolean {
  return process.env.PROFILE_PHASE2 === "1" || process.env.PROFILE_API === "1";
}

function normalizeCacheKey(path: string): string {
  return path.replace(/^\/+/, "");
}

export function getSignedUrlCacheStats() {
  const total = hits + misses;
  return {
    hits,
    misses,
    total,
    hitRatio: total > 0 ? Math.round((hits / total) * 1000) / 1000 : 0,
    size: cache.size,
  };
}

export function resetSignedUrlCacheStats(): void {
  hits = 0;
  misses = 0;
}

/** Clears cached entries (does not reset hit/miss counters). */
export function clearSignedUrlCache(): void {
  cache.clear();
}

export type SignedUrlCacheLookup =
  | { hit: true; signedUrl: string; cacheLookupMs: number }
  | { hit: false; cacheLookupMs: number };

export function lookupSignedUrlCache(path: string): SignedUrlCacheLookup {
  const lookupStart = performance.now();
  const key = normalizeCacheKey(path);
  const entry = cache.get(key);
  const cacheLookupMs = Math.round(performance.now() - lookupStart);

  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) cache.delete(key);
    misses += 1;
    if (isProfileEnabled()) {
      console.log(
        `[MEDIA-CACHE] miss path=${key} lookup=${cacheLookupMs}ms stats=${JSON.stringify(getSignedUrlCacheStats())}`
      );
    }
    return { hit: false, cacheLookupMs };
  }

  hits += 1;
  if (isProfileEnabled()) {
    console.log(
      `[MEDIA-CACHE] hit path=${key} lookup=${cacheLookupMs}ms stats=${JSON.stringify(getSignedUrlCacheStats())}`
    );
  }

  return { hit: true, signedUrl: entry.signedUrl, cacheLookupMs };
}

export function setCachedSignedUrl(path: string, signedUrl: string): void {
  cache.set(normalizeCacheKey(path), {
    signedUrl,
    expiresAt: Date.now() + SIGNED_URL_CACHE_TTL_MS,
  });
}
