-- Media platform v2: registry for deduplication, background processing, and analytics.

CREATE TYPE "MediaProcessingStatus" AS ENUM ('pending', 'processing', 'ready', 'failed');

CREATE TABLE "media_objects" (
    "id" UUID NOT NULL,
    "content_hash" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mime_type" TEXT,
    "byte_size" INTEGER NOT NULL,
    "ref_count" INTEGER NOT NULL DEFAULT 1,
    "status" "MediaProcessingStatus" NOT NULL DEFAULT 'pending',
    "variants" JSONB NOT NULL DEFAULT '{}',
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "media_objects_content_hash_key" ON "media_objects"("content_hash");
CREATE INDEX "media_objects_owner_id_created_at_idx" ON "media_objects"("owner_id", "created_at");
CREATE INDEX "media_objects_status_created_at_idx" ON "media_objects"("status", "created_at");
CREATE INDEX "media_objects_storage_path_idx" ON "media_objects"("storage_path");

ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
