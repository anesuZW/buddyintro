export type UploadKind = "image" | "video" | "audio";

export type MediaProviderName =
  | "local"
  | "supabase"
  | "backblaze"
  | "cloudflare-r2"
  | "s3";

export type ImageVariantName = "tiny" | "thumb" | "medium" | "large";
export type VideoVariantName = "480p" | "720p" | "1080p";

export type MediaVariant =
  | ImageVariantName
  | "original"
  | "preview"
  | "poster"
  | VideoVariantName;

export type MediaVariantUrls = Partial<Record<MediaVariant, string>>;

export type MediaProcessingState = "pending" | "processing" | "ready" | "failed";

export type StorageProviderCapabilities = {
  imageOptimization: boolean;
  videoTranscoding: boolean;
  videoPreview: boolean;
  backgroundProcessing: boolean;
  deduplication: boolean;
  variants: MediaVariant[];
};

export type StoragePublicUrlOptions = {
  variant?: MediaVariant;
};

export type StorageUploadOptions = {
  userId: string;
  kind: UploadKind;
  ext: string;
  contentType?: string;
  /** Skip deduplication (e.g. seeds). */
  skipDedup?: boolean;
};

export type StorageUploadResult = {
  path: string;
  publicUrl: string;
  variants?: MediaVariantUrls;
  contentType?: string;
  processingStatus?: MediaProcessingState;
  deduplicated?: boolean;
  mediaObjectId?: string;
};

export type StorageReadResult = {
  data: Buffer;
  contentType: string;
  etag?: string;
  lastModified?: Date;
};

export interface StorageProvider {
  readonly name: MediaProviderName;
  readonly capabilities: StorageProviderCapabilities;

  upload(data: Buffer, options: StorageUploadOptions): Promise<StorageUploadResult>;
  delete(path: string): Promise<void>;
  getPublicUrl(path: string, options?: StoragePublicUrlOptions): string;
  getVariantUrls(storedOrPath: string): MediaVariantUrls;
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<StorageReadResult | null>;
  getReadableUrl(
    storedOrPath: string,
    options?: { expiresInSeconds?: number; variant?: MediaVariant }
  ): Promise<string | null>;
}

export type MediaProcessJobPayload = {
  mediaObjectId: string;
  storagePath: string;
  kind: UploadKind;
  ownerId: string;
};

export type MediaCleanupJobPayload = {
  dryRun?: boolean;
  maxAgeHours?: number;
};
