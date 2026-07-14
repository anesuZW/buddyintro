-- 0001_baseline: Core identity, stories, invitations, messages, admin settings
-- Generated from schema.prisma via prisma migrate diff

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('draft', 'published', 'expired');


-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');


-- CreateEnum
CREATE TYPE "InviteMethod" AS ENUM ('email', 'whatsapp', 'sms', 'imessage');


-- CreateEnum
CREATE TYPE "DiscoveriesVisibility" AS ENUM ('network', 'public');


-- CreateEnum
CREATE TYPE "ConversationOrigin" AS ENUM ('story', 'discoveries', 'direct');


-- CreateEnum
CREATE TYPE "IntroductionVisibilityMode" AS ENUM ('specific_people_only', 'mutual_introduction_network', 'everyone_i_have_introduced');


-- CreateEnum
CREATE TYPE "NotificationDigestFrequency" AS ENUM ('instant', 'daily', 'weekly');


-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'reviewed', 'dismissed', 'action_taken');


-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('user', 'story', 'discoveries_post', 'message');


-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('none', 'phone', 'email', 'identity', 'trusted');


-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'dead');


-- CreateEnum
CREATE TYPE "TrustRankTier" AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond');


-- CreateEnum
CREATE TYPE "TrustRiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');


-- CreateEnum
CREATE TYPE "SecurityEventSeverity" AS ENUM ('low', 'medium', 'high', 'critical');


-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('low', 'normal', 'high', 'critical');


-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profile_picture" TEXT,
    "invites_sent" INTEGER NOT NULL DEFAULT 0,
    "invites_registered" INTEGER NOT NULL DEFAULT 0,
    "last_introductions_seen_at" TIMESTAMP(3),
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "identity_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_level" "VerificationLevel" NOT NULL DEFAULT 'none',
    "verified_at" TIMESTAMP(3),
    "trusted_user" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "suspended_at" TIMESTAMP(3),
    "banned_at" TIMESTAMP(3),
    "trust_risk_score" INTEGER NOT NULL DEFAULT 0,
    "trust_risk_level" "TrustRiskLevel" NOT NULL DEFAULT 'low',
    "trust_risk_reviewed_at" TIMESTAMP(3),
    "trust_risk_false_positive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "media_url" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "voice_note_url" TEXT,
    "text" TEXT,
    "status" "StoryStatus" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "introduction_category_id" UUID,
    "visibility_mode" "IntroductionVisibilityMode" NOT NULL DEFAULT 'mutual_introduction_network',

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "story_tags" (
    "id" UUID NOT NULL,
    "story_id" UUID NOT NULL,
    "tagged_user_id" UUID,
    "tagged_external_email" TEXT,
    "tagged_external_phone" TEXT,
    "invitation_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "story_tags_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone_number" TEXT,
    "invite_method" "InviteMethod" NOT NULL DEFAULT 'email',
    "invited_by" UUID NOT NULL,
    "invite_token" TEXT NOT NULL,
    "registered" BOOLEAN NOT NULL DEFAULT false,
    "registered_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "invitation_opened_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "story_reference" UUID,
    "discoveries_post_reference" UUID,
    "conversation_origin" "ConversationOrigin",
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT,
    "media" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "user_consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "privacy_version" TEXT NOT NULL,
    "terms_version" TEXT NOT NULL,
    "cookie_version" TEXT,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "country" TEXT,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "admin_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "invite_gate_enabled" BOOLEAN NOT NULL DEFAULT false,
    "required_invites" INTEGER NOT NULL DEFAULT 2,
    "story_expiry_hours" INTEGER NOT NULL DEFAULT 24,
    "post_expiry_hours" INTEGER NOT NULL DEFAULT 48,
    "discoveries_enabled" BOOLEAN NOT NULL DEFAULT true,
    "discoveries_expiry_hours" INTEGER,
    "discoveries_public_enabled" BOOLEAN NOT NULL DEFAULT false,
    "introductions_never_expire" BOOLEAN NOT NULL DEFAULT false,
    "discoveries_network_depth" INTEGER NOT NULL DEFAULT 2,
    "show_connection_reasons" BOOLEAN NOT NULL DEFAULT true,
    "enable_introduction_graph" BOOLEAN NOT NULL DEFAULT true,
    "allow_first_degree_discovery" BOOLEAN NOT NULL DEFAULT true,
    "allow_second_degree_discovery" BOOLEAN NOT NULL DEFAULT true,
    "allow_third_degree_discovery" BOOLEAN NOT NULL DEFAULT false,
    "allow_fourth_degree_discovery" BOOLEAN NOT NULL DEFAULT false,
    "max_discovery_depth" INTEGER NOT NULL DEFAULT 2,
    "show_connection_paths" BOOLEAN NOT NULL DEFAULT true,
    "enable_trust_scores" BOOLEAN NOT NULL DEFAULT true,
    "enable_verification_layer" BOOLEAN NOT NULL DEFAULT true,
    "enable_introduction_categories" BOOLEAN NOT NULL DEFAULT true,
    "allow_user_created_categories" BOOLEAN NOT NULL DEFAULT false,
    "allow_category_editing" BOOLEAN NOT NULL DEFAULT true,
    "require_phone_verification" BOOLEAN NOT NULL DEFAULT false,
    "require_identity_verification" BOOLEAN NOT NULL DEFAULT false,
    "show_trust_scores" BOOLEAN NOT NULL DEFAULT true,
    "show_shared_introducers" BOOLEAN NOT NULL DEFAULT true,
    "enable_shared_introducer_trust" BOOLEAN NOT NULL DEFAULT true,
    "show_shared_introducer_counts" BOOLEAN NOT NULL DEFAULT true,
    "shared_introducer_weight" INTEGER NOT NULL DEFAULT 70,
    "minimum_shared_introducers_for_messaging" INTEGER NOT NULL DEFAULT 0,
    "minimum_shared_introducers_for_discovery" INTEGER NOT NULL DEFAULT 0,
    "enable_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_in_app_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_introduction_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_discovery_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_message_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_trust_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_verification_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_announcement_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_introduction_view_notifications" BOOLEAN NOT NULL DEFAULT false,
    "enable_notification_digests" BOOLEAN NOT NULL DEFAULT false,
    "notification_digest_frequency" "NotificationDigestFrequency" NOT NULL DEFAULT 'instant',
    "enable_discovery_controls" BOOLEAN NOT NULL DEFAULT false,
    "enable_granular_verification_gates" BOOLEAN NOT NULL DEFAULT false,
    "enable_background_jobs" BOOLEAN NOT NULL DEFAULT false,
    "enable_trust_rankings" BOOLEAN NOT NULL DEFAULT true,
    "enable_trust_recommendations" BOOLEAN NOT NULL DEFAULT true,
    "allow_cross_category_discovery" BOOLEAN NOT NULL DEFAULT true,
    "allow_discovery_messaging" BOOLEAN NOT NULL DEFAULT true,
    "require_shared_introducer_for_discovery" BOOLEAN NOT NULL DEFAULT false,
    "require_shared_introducer_for_messaging" BOOLEAN NOT NULL DEFAULT false,
    "hide_discovery_from_unverified_users" BOOLEAN NOT NULL DEFAULT false,
    "require_email_verification" BOOLEAN NOT NULL DEFAULT false,
    "messaging_require_phone" BOOLEAN NOT NULL DEFAULT false,
    "messaging_require_email" BOOLEAN NOT NULL DEFAULT false,
    "messaging_require_identity" BOOLEAN NOT NULL DEFAULT false,
    "discoveries_require_phone" BOOLEAN NOT NULL DEFAULT false,
    "discoveries_require_email" BOOLEAN NOT NULL DEFAULT false,
    "discoveries_require_identity" BOOLEAN NOT NULL DEFAULT false,
    "introductions_require_phone" BOOLEAN NOT NULL DEFAULT false,
    "introductions_require_email" BOOLEAN NOT NULL DEFAULT false,
    "introductions_require_identity" BOOLEAN NOT NULL DEFAULT false,
    "enable_specific_people_visibility" BOOLEAN NOT NULL DEFAULT false,
    "enable_mutual_introduction_network_visibility" BOOLEAN NOT NULL DEFAULT true,
    "enable_everyone_introduced_visibility" BOOLEAN NOT NULL DEFAULT false,
    "default_story_visibility_mode" "IntroductionVisibilityMode" NOT NULL DEFAULT 'mutual_introduction_network',
    "allow_user_visibility_selection" BOOLEAN NOT NULL DEFAULT true,
    "enable_discoveries_hero_banner" BOOLEAN NOT NULL DEFAULT true,
    "enable_discovery_expiry_indicators" BOOLEAN NOT NULL DEFAULT true,
    "enable_discovery_trust_context" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");


-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");


-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");


-- CreateIndex
CREATE INDEX "users_verification_level_idx" ON "users"("verification_level");


-- CreateIndex
CREATE INDEX "users_trusted_user_idx" ON "users"("trusted_user");


-- CreateIndex
CREATE INDEX "stories_user_id_idx" ON "stories"("user_id");


-- CreateIndex
CREATE INDEX "stories_status_idx" ON "stories"("status");


-- CreateIndex
CREATE INDEX "stories_expires_at_idx" ON "stories"("expires_at");


-- CreateIndex
CREATE INDEX "stories_introduction_category_id_idx" ON "stories"("introduction_category_id");


-- CreateIndex
CREATE UNIQUE INDEX "story_tags_invitation_id_key" ON "story_tags"("invitation_id");


-- CreateIndex
CREATE INDEX "story_tags_story_id_idx" ON "story_tags"("story_id");


-- CreateIndex
CREATE INDEX "story_tags_tagged_user_id_idx" ON "story_tags"("tagged_user_id");


-- CreateIndex
CREATE INDEX "story_tags_tagged_external_email_idx" ON "story_tags"("tagged_external_email");


-- CreateIndex
CREATE INDEX "story_tags_tagged_external_phone_idx" ON "story_tags"("tagged_external_phone");


-- CreateIndex
CREATE UNIQUE INDEX "story_tags_story_id_tagged_user_id_key" ON "story_tags"("story_id", "tagged_user_id");


-- CreateIndex
CREATE UNIQUE INDEX "story_tags_story_id_tagged_external_email_key" ON "story_tags"("story_id", "tagged_external_email");


-- CreateIndex
CREATE UNIQUE INDEX "story_tags_story_id_tagged_external_phone_key" ON "story_tags"("story_id", "tagged_external_phone");


-- CreateIndex
CREATE UNIQUE INDEX "invitations_invite_token_key" ON "invitations"("invite_token");


-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");


-- CreateIndex
CREATE INDEX "invitations_phone_number_idx" ON "invitations"("phone_number");


-- CreateIndex
CREATE INDEX "invitations_invited_by_idx" ON "invitations"("invited_by");


-- CreateIndex
CREATE INDEX "invitations_invite_token_idx" ON "invitations"("invite_token");


-- CreateIndex
CREATE INDEX "messages_sender_id_receiver_id_created_at_idx" ON "messages"("sender_id", "receiver_id", "created_at");


-- CreateIndex
CREATE INDEX "messages_receiver_id_sender_id_created_at_idx" ON "messages"("receiver_id", "sender_id", "created_at");


-- CreateIndex
CREATE INDEX "messages_story_reference_idx" ON "messages"("story_reference");


-- CreateIndex
CREATE INDEX "messages_discoveries_post_reference_idx" ON "messages"("discoveries_post_reference");


-- CreateIndex
CREATE INDEX "posts_user_id_idx" ON "posts"("user_id");


-- CreateIndex
CREATE INDEX "posts_expires_at_idx" ON "posts"("expires_at");


-- CreateIndex
CREATE INDEX "user_consents_user_id_idx" ON "user_consents"("user_id");


-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "story_tags" ADD CONSTRAINT "story_tags_story_id_fkey" FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "story_tags" ADD CONSTRAINT "story_tags_tagged_user_id_fkey" FOREIGN KEY ("tagged_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "story_tags" ADD CONSTRAINT "story_tags_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_story_reference_fkey" FOREIGN KEY ("story_reference") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default admin settings row
INSERT INTO "admin_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
