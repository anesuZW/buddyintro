import { getMediaProviderName } from "@/lib/storage/config";
import { normalizeStoragePath } from "@/lib/storage/paths";

const CDN_PROVIDERS = new Set(["s3", "backblaze", "cloudflare-r2"]);

/** Resolve a public CDN URL for object storage paths when CDN_URL is configured. */
export function toCdnMediaUrl(storagePath: string): string | null {
  const provider = getMediaProviderName();
  if (!CDN_PROVIDERS.has(provider)) return null;

  const cdnBase =
    process.env.CDN_URL ||
    process.env.MEDIA_S3_PUBLIC_BASE_URL ||
    process.env.MEDIA_B2_PUBLIC_BASE_URL ||
    process.env.MEDIA_R2_PUBLIC_BASE_URL;

  if (!cdnBase) return null;
  const path = normalizeStoragePath(storagePath);
  return `${cdnBase.replace(/\/$/, "")}/${path}`;
}

export function isCdnEnabled(): boolean {
  return Boolean(process.env.CDN_URL?.trim());
}
