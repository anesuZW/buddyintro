import "server-only";

import type {
  MediaVariantUrls,
  StorageProvider,
  StorageProviderCapabilities,
  StoragePublicUrlOptions,
  StorageReadResult,
  StorageUploadOptions,
  StorageUploadResult,
} from "@/lib/storage/types";
import type { MediaProviderName } from "@/lib/storage/types";
import {
  buildStorageObjectPath,
  isSafeStoragePath,
  mediaProxyPath,
  normalizeStoragePath,
} from "@/lib/storage/paths";
import { extractStoragePath } from "@/lib/storage-url";

export type S3ProviderConfig = {
  name: MediaProviderName;
  endpoint?: string;
  region?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
};

/**
 * S3-compatible storage provider (AWS S3, Backblaze B2, Cloudflare R2).
 * Uses the shared object key layout from paths.ts — switch MEDIA_PROVIDER only.
 */
export class S3CompatibleStorageProvider implements StorageProvider {
  readonly name: MediaProviderName;
  readonly capabilities: StorageProviderCapabilities = {
    imageOptimization: false,
    videoTranscoding: false,
    videoPreview: false,
    backgroundProcessing: false,
    deduplication: false,
    variants: ["original"],
  };

  private readonly config: S3ProviderConfig;
  private client: import("@aws-sdk/client-s3").S3Client | null = null;

  constructor(config: S3ProviderConfig) {
    this.config = config;
    this.name = config.name;
  }

  private async getClient() {
    if (this.client) return this.client;
    const { S3Client } = await import("@aws-sdk/client-s3");
    this.client = new S3Client({
      region: this.config.region || "auto",
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: Boolean(this.config.endpoint),
    });
    return this.client;
  }

  private resolveObjectPath(storedOrPath: string): string | null {
    const path = extractStoragePath(storedOrPath) ?? normalizeStoragePath(storedOrPath);
    if (!path || !isSafeStoragePath(path)) return null;
    return path;
  }

  getPublicUrl(path: string, _options?: StoragePublicUrlOptions): string {
    const objectPath = this.resolveObjectPath(path);
    if (!objectPath) return path;
    if (this.config.publicBaseUrl) {
      return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${objectPath}`;
    }
    return mediaProxyPath(objectPath);
  }

  getVariantUrls(storedOrPath: string): MediaVariantUrls {
    const objectPath = this.resolveObjectPath(storedOrPath);
    if (!objectPath) return {};
    const original = this.getPublicUrl(objectPath);
    return { original };
  }

  async upload(data: Buffer, options: StorageUploadOptions): Promise<StorageUploadResult> {
    const objectPath = buildStorageObjectPath(options);
    if (!isSafeStoragePath(objectPath)) throw new Error("Invalid upload path");

    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: objectPath,
        Body: data,
        ContentType: options.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    const publicUrl = this.getPublicUrl(objectPath);
    return {
      path: objectPath,
      publicUrl,
      variants: { original: publicUrl },
      contentType: options.contentType,
      processingStatus: "ready",
    };
  }

  async delete(path: string): Promise<void> {
    const objectPath = this.resolveObjectPath(path);
    if (!objectPath) return;
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: objectPath }));
  }

  async exists(path: string): Promise<boolean> {
    const objectPath = this.resolveObjectPath(path);
    if (!objectPath) return false;
    try {
      const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await this.getClient();
      await client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: objectPath }));
      return true;
    } catch {
      return false;
    }
  }

  async readFile(path: string): Promise<StorageReadResult | null> {
    const objectPath = this.resolveObjectPath(path);
    if (!objectPath) return null;
    try {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      const client = await this.getClient();
      const response = await client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: objectPath })
      );
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) return null;
      return {
        data: Buffer.from(bytes),
        contentType: response.ContentType || "application/octet-stream",
        etag: response.ETag ?? undefined,
        lastModified: response.LastModified,
      };
    } catch {
      return null;
    }
  }

  async getReadableUrl(
    storedOrPath: string,
    options?: { expiresInSeconds?: number; variant?: string }
  ): Promise<string | null> {
    const objectPath = this.resolveObjectPath(storedOrPath);
    if (!objectPath) return null;
    if (this.config.publicBaseUrl) return this.getPublicUrl(objectPath);

    const expiresIn = options?.expiresInSeconds ?? 3600;
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.getClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: objectPath }),
      { expiresIn }
    );
  }
}
