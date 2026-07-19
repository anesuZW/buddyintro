import type { MediaProviderName } from "@/lib/storage/types";
import { resolveMediaRoot } from "@/lib/storage/media-root";

const PROVIDER_ALIASES: Record<string, MediaProviderName> = {
  local: "local",
  supabase: "supabase",
  backblaze: "backblaze",
  b2: "backblaze",
  "cloudflare-r2": "cloudflare-r2",
  r2: "cloudflare-r2",
  s3: "s3",
};

/** Active storage backend — defaults to `local` for VPS deployments. */
export function getMediaProviderName(): MediaProviderName {
  const raw = (
    process.env.MEDIA_PROVIDER ||
    process.env.NEXT_PUBLIC_MEDIA_PROVIDER ||
    "local"
  ).toLowerCase();
  return PROVIDER_ALIASES[raw] ?? "local";
}

/** Root directory for local media files. */
export function getMediaRoot(): string {
  return resolveMediaRoot();
}

export function isLocalMediaProvider(): boolean {
  return getMediaProviderName() === "local";
}

export function getMediaBackupProvider(): "none" | "backblaze" | "r2" {
  const raw = (process.env.MEDIA_BACKUP_PROVIDER || "none").toLowerCase();
  if (raw === "backblaze" || raw === "r2") return raw;
  return "none";
}

export function getS3CompatibleConfig(name: MediaProviderName) {
  const prefix = name === "s3" ? "MEDIA_S3" : name === "backblaze" ? "MEDIA_B2" : "MEDIA_R2";
  const bucket = process.env[`${prefix}_BUCKET`];
  const accessKeyId = process.env[`${prefix}_ACCESS_KEY_ID`];
  const secretAccessKey = process.env[`${prefix}_SECRET_ACCESS_KEY`];
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(`Configure ${prefix}_BUCKET, ${prefix}_ACCESS_KEY_ID, ${prefix}_SECRET_ACCESS_KEY`);
  }
  return {
    name,
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint: process.env[`${prefix}_ENDPOINT`],
    region: process.env[`${prefix}_REGION`] || "auto",
    publicBaseUrl: process.env[`${prefix}_PUBLIC_BASE_URL`],
  };
}
