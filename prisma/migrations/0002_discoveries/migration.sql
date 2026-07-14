-- 0002_discoveries: Discoveries feed and conversation context
-- Generated from schema.prisma via prisma migrate diff

-- CreateTable
CREATE TABLE "conversation_contexts" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "origin" "ConversationOrigin" NOT NULL DEFAULT 'direct',
    "story_reference" UUID,
    "discoveries_post_reference" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_contexts_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "discoveries_posts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT,
    "media_url" TEXT,
    "media_type" "MediaType",
    "visibility" "DiscoveriesVisibility" NOT NULL DEFAULT 'network',
    "introduction_category_id" UUID,
    "visibility_mode" "IntroductionVisibilityMode" NOT NULL DEFAULT 'mutual_introduction_network',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "discoveries_posts_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "discoveries_likes" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discoveries_likes_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "discoveries_comments" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discoveries_comments_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "discoveries_bookmarks" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discoveries_bookmarks_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "discoveries_shares" (
    "id" UUID NOT NULL,
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discoveries_shares_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "conversation_contexts_user_a_id_idx" ON "conversation_contexts"("user_a_id");


-- CreateIndex
CREATE INDEX "conversation_contexts_user_b_id_idx" ON "conversation_contexts"("user_b_id");


-- CreateIndex
CREATE UNIQUE INDEX "conversation_contexts_user_a_id_user_b_id_key" ON "conversation_contexts"("user_a_id", "user_b_id");


-- CreateIndex
CREATE INDEX "discoveries_posts_user_id_idx" ON "discoveries_posts"("user_id");


-- CreateIndex
CREATE INDEX "discoveries_posts_visibility_created_at_idx" ON "discoveries_posts"("visibility", "created_at");


-- CreateIndex
CREATE INDEX "discoveries_posts_expires_at_idx" ON "discoveries_posts"("expires_at");


-- CreateIndex
CREATE UNIQUE INDEX "discoveries_likes_post_id_user_id_key" ON "discoveries_likes"("post_id", "user_id");


-- CreateIndex
CREATE INDEX "discoveries_comments_post_id_created_at_idx" ON "discoveries_comments"("post_id", "created_at");


-- CreateIndex
CREATE UNIQUE INDEX "discoveries_bookmarks_post_id_user_id_key" ON "discoveries_bookmarks"("post_id", "user_id");


-- CreateIndex
CREATE INDEX "discoveries_shares_post_id_idx" ON "discoveries_shares"("post_id");


-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_discoveries_post_reference_fkey" FOREIGN KEY ("discoveries_post_reference") REFERENCES "discoveries_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "conversation_contexts" ADD CONSTRAINT "conversation_contexts_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "conversation_contexts" ADD CONSTRAINT "conversation_contexts_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "conversation_contexts" ADD CONSTRAINT "conversation_contexts_story_reference_fkey" FOREIGN KEY ("story_reference") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "conversation_contexts" ADD CONSTRAINT "conversation_contexts_discoveries_post_reference_fkey" FOREIGN KEY ("discoveries_post_reference") REFERENCES "discoveries_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_posts" ADD CONSTRAINT "discoveries_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_likes" ADD CONSTRAINT "discoveries_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "discoveries_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_likes" ADD CONSTRAINT "discoveries_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_comments" ADD CONSTRAINT "discoveries_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "discoveries_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_comments" ADD CONSTRAINT "discoveries_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_bookmarks" ADD CONSTRAINT "discoveries_bookmarks_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "discoveries_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_bookmarks" ADD CONSTRAINT "discoveries_bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_shares" ADD CONSTRAINT "discoveries_shares_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "discoveries_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_shares" ADD CONSTRAINT "discoveries_shares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

