-- CreateEnum
CREATE TYPE "MediaProcessingStatus" AS ENUM ('pending', 'processing', 'ready', 'failed');

-- AlterTable
ALTER TABLE "push_subscriptions" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "device_type" TEXT,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "expiration_time" TIMESTAMP(3),
ADD COLUMN     "last_used_at" TIMESTAMP(3),
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferred_language" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_content_hash_key" ON "media_objects"("content_hash");

-- CreateIndex
CREATE INDEX "media_objects_owner_id_created_at_idx" ON "media_objects"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "media_objects_status_created_at_idx" ON "media_objects"("status", "created_at");

-- CreateIndex
CREATE INDEX "media_objects_storage_path_idx" ON "media_objects"("storage_path");

-- CreateIndex
CREATE INDEX "messages_receiver_id_read_at_idx" ON "messages"("receiver_id", "read_at");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_enabled_idx" ON "push_subscriptions"("user_id", "enabled");

-- CreateIndex
CREATE INDEX "push_subscriptions_enabled_updated_at_idx" ON "push_subscriptions"("enabled", "updated_at");

-- CreateIndex
CREATE INDEX "users_preferred_language_idx" ON "users"("preferred_language");

-- AddForeignKey
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

