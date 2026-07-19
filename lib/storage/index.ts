import "server-only";

import type { StorageProvider } from "@/lib/storage/types";
import { getMediaProviderName, getS3CompatibleConfig } from "@/lib/storage/config";
import { LocalStorageProvider } from "@/lib/storage/local-provider";
import { SupabaseStorageProvider } from "@/lib/storage/supabase-provider";
import { S3CompatibleStorageProvider } from "@/lib/storage/s3-compatible-provider";

let cachedProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!cachedProvider) {
    const name = getMediaProviderName();
    switch (name) {
      case "supabase":
        cachedProvider = new SupabaseStorageProvider();
        break;
      case "s3":
      case "backblaze":
      case "cloudflare-r2":
        cachedProvider = new S3CompatibleStorageProvider(getS3CompatibleConfig(name));
        break;
      default:
        cachedProvider = new LocalStorageProvider();
    }
  }
  return cachedProvider;
}

/** Test helper — reset singleton between runs. */
export function resetStorageProvider(): void {
  cachedProvider = null;
}

export type { StorageProvider, StorageUploadOptions, StorageUploadResult, UploadKind, MediaVariant, MediaVariantUrls } from "@/lib/storage/types";
export {
  getMediaProviderName,
  getMediaRoot,
  isLocalMediaProvider,
  getMediaBackupProvider,
} from "@/lib/storage/config";
export {
  buildStorageObjectPath,
  buildStorageObjectBase,
  inferUploadExtension,
  isSafeStoragePath,
  normalizeStoragePath,
  uploadsPublicPath,
  mediaProxyPath,
  resolveVariantStoragePath,
  collectVariantStoragePaths,
  imageVariantStoragePath,
  videoPreviewStoragePath,
  detectStorageLayout,
  isLegacyStoragePath,
} from "@/lib/storage/paths";
export { storedMediaUrlSchema } from "@/lib/storage/validation";
