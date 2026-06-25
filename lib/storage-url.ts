import { STORAGE_BUCKET } from "@/lib/constants";
/** Extract `{userId}/{kind}/{file}` from a stored media URL or path. */
export function extractStoragePath(stored: string): string | null {
  if (!stored) return null;
  if (!stored.includes("://") && !stored.startsWith("/api/media")) {
    return stored.replace(/^\/+/, "");
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
    const proxyPath = url.searchParams.get("path");
    if (proxyPath) return decodeURIComponent(proxyPath);
  } catch {
    return null;
  }
  return null;
}

export function mediaProxyPath(storagePath: string): string {
  return `/api/media?path=${encodeURIComponent(storagePath)}`;
}

export function toMediaProxyUrl(stored: string): string {
  const path = extractStoragePath(stored);
  if (!path) return stored;
  return mediaProxyPath(path);
}

/** Resolve a stored media reference to an authenticated proxy URL. */
export function resolveMediaUrlForClient(stored: string): string {
  return toMediaProxyUrl(stored);
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
