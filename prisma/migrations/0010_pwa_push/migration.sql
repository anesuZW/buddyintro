-- 0010_pwa_push: Extended push subscription metadata for production PWA

ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "expiration_time" TIMESTAMP(3);
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "device_type" TEXT;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "browser" TEXT;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "push_subscriptions_user_id_enabled_idx" ON "push_subscriptions"("user_id", "enabled");
CREATE INDEX IF NOT EXISTS "push_subscriptions_enabled_updated_at_idx" ON "push_subscriptions"("enabled", "updated_at");
