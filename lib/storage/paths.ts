import type { ImageVariantName, MediaVariant, UploadKind, VideoVariantName } from "@/lib/storage/types";

export const IMAGE_VARIANT_WIDTHS: Record<ImageVariantName, number> = {
  tiny: 64,
  thumb: 200,
  medium: 800,
  large: 1600,
};

export const VIDEO_TRANSCODE_HEIGHTS: Record<VideoVariantName, number> = {
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
};

export type StorageLayout = "v2" | "legacy";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeStoragePath(path: string): string {
  return path.replace(/^\/+/, "").replace(/\\/g, "/");
}

export function detectStorageLayout(path: string): StorageLayout {
  const normalized = normalizeStoragePath(path);
  if (
    normalized.startsWith("images/") ||
    normalized.startsWith("videos/") ||
    normalized.startsWith("audio/") ||
    /^thumbnails\/\d{4}\//.test(normalized)
  ) {
    return "v2";
  }
  return "legacy";
}

export function getStorageKind(path: string): UploadKind | "thumbnail" | null {
  const normalized = normalizeStoragePath(path);
  const layout = detectStorageLayout(normalized);

  if (layout === "v2") {
    if (normalized.startsWith("images/")) return "image";
    if (normalized.startsWith("videos/")) return "video";
    if (normalized.startsWith("audio/")) return "audio";
    if (normalized.startsWith("thumbnails/")) return "thumbnail";
    return null;
  }

  const kind = normalized.split("/")[1];
  if (kind === "image" || kind === "video" || kind === "audio") return kind;
  if (normalized.startsWith("thumbnails/")) return "thumbnail";
  return null;
}

export function isSafeStoragePath(path: string): boolean {
  const normalized = normalizeStoragePath(path);
  if (!normalized || normalized.includes("..")) return false;

  const segments = normalized.split("/");
  if (segments.some((s) => !s.length)) return false;

  if (detectStorageLayout(normalized) === "v2") {
    if (normalized.startsWith("thumbnails/")) return segments.length >= 5;
    return segments.length >= 5;
  }

  if (normalized.startsWith("thumbnails/")) return segments.length >= 4;
  return segments.length >= 3;
}

function dateParts(date = new Date()): { year: string; month: string } {
  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
  };
}

/** v2 hierarchical path: `{kind}s/YYYY/MM/{userId}/{id}` without extension. */
export function buildStorageObjectBase(opts: {
  userId: string;
  kind: UploadKind;
  date?: Date;
}): string {
  const { year, month } = dateParts(opts.date);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const root = opts.kind === "image" ? "images" : opts.kind === "video" ? "videos" : "audio";
  return `${root}/${year}/${month}/${opts.userId}/${id}`;
}

export function buildStorageObjectPath(opts: {
  userId: string;
  kind: UploadKind;
  ext: string;
  date?: Date;
}): string {
  const ext = opts.ext.replace(/^\./, "").toLowerCase();
  return `${buildStorageObjectBase(opts)}.${ext}`;
}

export function inferUploadExtension(
  file: { name?: string; type?: string },
  kind: UploadKind
): string {
  if (file.name?.includes(".")) {
    return file.name.split(".").pop()!.toLowerCase();
  }
  if (file.type) {
    const sub = file.type.split("/")[1];
    if (sub) return sub.replace("+xml", "").replace("jpeg", "jpg");
  }
  if (kind === "audio") return "webm";
  if (kind === "video") return "mp4";
  return "jpg";
}

export function uploadsPublicPath(storagePath: string): string {
  return `/uploads/${normalizeStoragePath(storagePath)}`;
}

export function mediaProxyPath(storagePath: string): string {
  return `/api/media?path=${encodeURIComponent(normalizeStoragePath(storagePath))}`;
}

export function stripStorageExtension(path: string): string {
  return path.replace(/\.[a-z0-9]+$/i, "");
}

export function stripVariantSuffix(path: string): string {
  return stripStorageExtension(path)
    .replace(/-w(64|200|800|1600)$/i, "")
    .replace(/-(480p|720p|1080p)$/i, "")
    .replace(/-poster$/i, "");
}

export function imageVariantStoragePath(
  baseIdOrCanonical: string,
  variant: ImageVariantName | "original"
): string {
  const base = stripVariantSuffix(normalizeStoragePath(baseIdOrCanonical));
  switch (variant) {
    case "tiny":
      return `${base}-w64.webp`;
    case "thumb":
      return `${base}-w200.webp`;
    case "medium":
      return `${base}-w800.webp`;
    case "large":
      return `${base}-w1600.webp`;
    default:
      return `${base}.webp`;
  }
}

export function videoVariantStoragePath(
  canonicalVideoPath: string,
  variant: VideoVariantName | "original"
): string {
  const normalized = normalizeStoragePath(canonicalVideoPath);
  const base = stripVariantSuffix(normalized);
  if (variant === "original") {
    const ext = normalized.split(".").pop()?.toLowerCase() || "mp4";
    return `${base}.${ext}`;
  }
  return `${base}-${variant}.mp4`;
}

/** Thumbnail/poster path for a video canonical path (v2 + legacy). */
export function videoPreviewStoragePath(videoPath: string): string {
  const normalized = normalizeStoragePath(videoPath);
  const layout = detectStorageLayout(normalized);
  const stem = stripVariantSuffix(normalized.split("/").pop() || normalized);

  if (layout === "v2") {
    const segments = normalized.split("/");
    // videos/YYYY/MM/userId/file.mp4
    if (segments.length >= 5 && segments[0] === "videos") {
      const [, year, month, userId] = segments;
      return `thumbnails/${year}/${month}/${userId}/${stem}.webp`;
    }
  }

  // legacy: thumbnails/{userId}/video/{stem}.webp
  const segments = normalized.split("/");
  const userId = layout === "legacy" ? segments[0] : segments[3];
  return `thumbnails/${userId}/video/${stem}.webp`;
}

export function videoPosterStoragePath(videoPath: string): string {
  const preview = videoPreviewStoragePath(videoPath);
  if (detectStorageLayout(videoPath) === "v2") {
    return preview.replace(/\.webp$/, "-poster.webp");
  }
  return preview.replace(/\.webp$/, "-poster.webp");
}

export function resolveVariantStoragePath(
  canonicalPath: string,
  variant: MediaVariant
): string | null {
  const normalized = normalizeStoragePath(canonicalPath);
  const kind = getStorageKind(normalized);

  if (kind === "image") {
    if (variant === "preview" || variant === "poster") return null;
    if (variant === "480p" || variant === "720p" || variant === "1080p") return null;
    const base = stripVariantSuffix(normalized);
    if (variant === "tiny") return imageVariantStoragePath(base, "tiny");
    if (variant === "thumb") return imageVariantStoragePath(base, "thumb");
    if (variant === "medium") return imageVariantStoragePath(base, "medium");
    if (variant === "large") return imageVariantStoragePath(base, "large");
    return imageVariantStoragePath(base, "original");
  }

  if (kind === "video") {
    if (variant === "preview") return videoPreviewStoragePath(normalized);
    if (variant === "poster") return videoPosterStoragePath(normalized);
    if (variant === "480p" || variant === "720p" || variant === "1080p") {
      return videoVariantStoragePath(normalized, variant);
    }
    return videoVariantStoragePath(normalized, "original");
  }

  if (kind === "audio") {
    return variant === "original" ? normalized : null;
  }

  return null;
}

export function collectVariantStoragePaths(canonicalPath: string): string[] {
  const normalized = normalizeStoragePath(canonicalPath);
  const kind = getStorageKind(normalized);
  const paths = new Set<string>([normalized]);

  if (kind === "image") {
    const base = stripVariantSuffix(normalized);
    for (const variant of ["tiny", "thumb", "medium", "large", "original"] as const) {
      paths.add(imageVariantStoragePath(base, variant));
    }
  } else if (kind === "video") {
    paths.add(videoPreviewStoragePath(normalized));
    paths.add(videoPosterStoragePath(normalized));
    for (const variant of ["480p", "720p", "1080p"] as const) {
      paths.add(videoVariantStoragePath(normalized, variant));
    }
  }

  return [...paths];
}

export function buildVariantUrlsFromStoragePaths(
  paths: Partial<Record<MediaVariant, string>>,
  toPublicUrl: (storagePath: string) => string
): Partial<Record<MediaVariant, string>> {
  const urls: Partial<Record<MediaVariant, string>> = {};
  for (const [variant, storagePath] of Object.entries(paths) as [MediaVariant, string][]) {
    if (storagePath) urls[variant] = toPublicUrl(storagePath);
  }
  return urls;
}

/** Immutable cache-friendly public URL — paths already contain content id + timestamp. */
export function immutableUploadsPublicPath(storagePath: string): string {
  return uploadsPublicPath(storagePath);
}

export function isLegacyStoragePath(path: string): boolean {
  return detectStorageLayout(path) === "legacy";
}

/** Parse legacy `{userId}/{kind}/...` paths for backward-compatible variant resolution. */
export function legacyKindFromPath(path: string): UploadKind | null {
  const segments = normalizeStoragePath(path).split("/");
  if (segments.length < 3 || !UUID_RE.test(segments[0]!)) return null;
  const kind = segments[1];
  if (kind === "image" || kind === "video" || kind === "audio") return kind;
  return null;
}
