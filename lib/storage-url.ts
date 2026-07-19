import { STORAGE_BUCKET } from "@/lib/constants";
import { getMediaProviderName } from "@/lib/storage/config";
import { toCdnMediaUrl } from "@/lib/cdn-url";
import {
  mediaProxyPath,
  normalizeStoragePath,
  resolveVariantStoragePath,
  uploadsPublicPath,
} from "@/lib/storage/paths";
import type { MediaVariant } from "@/lib/storage/types";

/** Extract `{userId}/{kind}/{file}` from a stored media URL or path. */
export function extractStoragePath(stored: string): string | null {
  if (!stored) return null;

  if (stored.startsWith("/uploads/")) {
    return normalizeStoragePath(stored.slice("/uploads/".length));
  }

  if (!stored.includes("://") && !stored.startsWith("/api/media")) {
    const raw = normalizeStoragePath(stored);
    if (/^[0-9a-f-]{36}\/(image|video|audio)\//i.test(raw)) return raw;
    if (/^(images|videos|audio)\/\d{4}\/\d{2}\//i.test(raw)) return raw;
    if (/^thumbnails\//i.test(raw)) return raw;
    return raw.replace(/^\/+/, "") || null;
  }

  try {
    const url = stored.startsWith("/")
      ? new URL(stored, "http://local")
      : new URL(stored);
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx >= 0) {
      return decodeURIComponent(url.pathname.slice(idx + marker.length));
    }
    if (url.pathname.startsWith("/uploads/")) {
      return decodeURIComponent(url.pathname.slice("/uploads/".length));
    }
    const proxyPath = url.searchParams.get("path");
    if (proxyPath) return decodeURIComponent(proxyPath);
  } catch {
    return null;
  }
  return null;
}

export { mediaProxyPath, uploadsPublicPath };

/** Resolve a storage path to the client-facing URL for the active media provider. */
export function toClientMediaUrl(storagePath: string): string {
  const path = normalizeStoragePath(storagePath);
  const cdn = toCdnMediaUrl(path);
  if (cdn) return cdn;
  if (getMediaProviderName() === "local") {
    return uploadsPublicPath(path);
  }
  return mediaProxyPath(path);
}

/** Normalize any stored reference to a client-facing media URL. */
export function toMediaProxyUrl(stored: string): string {
  const path = extractStoragePath(stored);
  if (!path) return stored;
  return toClientMediaUrl(path);
}

/** Resolve a stored media reference to a URL the browser can load. */
export function resolveMediaUrlForClient(stored: string, variant?: MediaVariant): string {
  if (!stored) return stored;
  if (stored.startsWith("http://") || stored.startsWith("https://")) {
    const path = extractStoragePath(stored);
    if (!path) return stored;
    return variant ? resolveMediaVariantUrl(path, variant) : toClientMediaUrl(path);
  }
  const path = extractStoragePath(stored);
  if (path && variant) return resolveMediaVariantUrl(path, variant);
  return toMediaProxyUrl(stored);
}

/** Resolve a canonical storage path to a variant URL using shared path conventions. */
export function resolveMediaVariantUrl(canonicalPath: string, variant: MediaVariant): string {
  const normalized = normalizeStoragePath(canonicalPath);
  const variantPath = resolveVariantStoragePath(normalized, variant) ?? normalized;
  return toClientMediaUrl(variantPath);
}

export function withProxiedMedia<T extends { mediaUrl: string; voiceNoteUrl?: string | null }>(
  item: T
): T {
  return {
    ...item,
    mediaUrl: resolveMediaUrlForClient(item.mediaUrl),
    voiceNoteUrl: item.voiceNoteUrl
      ? resolveMediaUrlForClient(item.voiceNoteUrl)
      : item.voiceNoteUrl,
  };
}

export function withOptionalProxiedMedia<
  T extends { mediaUrl: string | null; mediaType?: string | null }
>(item: T): T {
  if (!item.mediaUrl) return item;
  return {
    ...item,
    mediaUrl: resolveMediaUrlForClient(item.mediaUrl),
  };
}
