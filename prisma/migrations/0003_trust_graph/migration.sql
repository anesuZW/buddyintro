-- 0003_trust_graph: Trust graph, introduction categories, shared introducers
-- Generated from schema.prisma via prisma migrate diff

-- CreateTable
CREATE TABLE "user_connections" (
    "id" UUID NOT NULL,
    "source_user_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "degree" INTEGER NOT NULL,
    "introduced_via_story_id" UUID,
    "shared_introducer_count" INTEGER NOT NULL DEFAULT 0,
    "trust_score" INTEGER NOT NULL DEFAULT 10,
    "trust_rank" INTEGER NOT NULL DEFAULT 0,
    "trust_rank_tier" "TrustRankTier" NOT NULL DEFAULT 'bronze',
    "highest_trust_path" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_connections_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "introduction_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "introduction_categories_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "shared_introducer_relationships" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "shared_introducer_id" UUID NOT NULL,
    "first_introduction_story_id" UUID,
    "second_introduction_story_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_introducer_relationships_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "user_connections_source_user_id_idx" ON "user_connections"("source_user_id");


-- CreateIndex
CREATE INDEX "user_connections_target_user_id_idx" ON "user_connections"("target_user_id");


-- CreateIndex
CREATE INDEX "user_connections_degree_idx" ON "user_connections"("degree");


-- CreateIndex
CREATE INDEX "user_connections_source_user_id_degree_idx" ON "user_connections"("source_user_id", "degree");


-- CreateIndex
CREATE INDEX "user_connections_source_user_id_shared_introducer_count_idx" ON "user_connections"("source_user_id", "shared_introducer_count");


-- CreateIndex
CREATE INDEX "user_connections_source_user_id_trust_score_idx" ON "user_connections"("source_user_id", "trust_score");


-- CreateIndex
CREATE UNIQUE INDEX "user_connections_source_user_id_target_user_id_key" ON "user_connections"("source_user_id", "target_user_id");


-- CreateIndex
CREATE INDEX "introduction_categories_is_active_idx" ON "introduction_categories"("is_active");


-- CreateIndex
CREATE UNIQUE INDEX "introduction_categories_name_key" ON "introduction_categories"("name");


-- CreateIndex
CREATE INDEX "shared_introducer_relationships_user_a_id_user_b_id_idx" ON "shared_introducer_relationships"("user_a_id", "user_b_id");


-- CreateIndex
CREATE INDEX "shared_introducer_relationships_shared_introducer_id_idx" ON "shared_introducer_relationships"("shared_introducer_id");


-- CreateIndex
CREATE UNIQUE INDEX "shared_introducer_relationships_user_a_id_user_b_id_shared__key" ON "shared_introducer_relationships"("user_a_id", "user_b_id", "shared_introducer_id");


-- AddForeignKey
ALTER TABLE "stories" ADD CONSTRAINT "stories_introduction_category_id_fkey" FOREIGN KEY ("introduction_category_id") REFERENCES "introduction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "discoveries_posts" ADD CONSTRAINT "discoveries_posts_introduction_category_id_fkey" FOREIGN KEY ("introduction_category_id") REFERENCES "introduction_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_source_user_id_fkey" FOREIGN KEY ("source_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "user_connections" ADD CONSTRAINT "user_connections_introduced_via_story_id_fkey" FOREIGN KEY ("introduced_via_story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "introduction_categories" ADD CONSTRAINT "introduction_categories_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "shared_introducer_relationships" ADD CONSTRAINT "shared_introducer_relationships_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "shared_introducer_relationships" ADD CONSTRAINT "shared_introducer_relationships_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "shared_introducer_relationships" ADD CONSTRAINT "shared_introducer_relationships_shared_introducer_id_fkey" FOREIGN KEY ("shared_introducer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "shared_introducer_relationships" ADD CONSTRAINT "shared_introducer_relationships_first_introduction_story_i_fkey" FOREIGN KEY ("first_introduction_story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE "shared_introducer_relationships" ADD CONSTRAINT "shared_introducer_relationships_second_introduction_story__fkey" FOREIGN KEY ("second_introduction_story_id") REFERENCES "stories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed system introduction categories
INSERT INTO "introduction_categories" ("id", "name", "description", "icon", "color", "is_system", "is_active") VALUES
  (gen_random_uuid(), 'Friend', 'Close friends and companions', 'users', '#2563EB', true, true),
  (gen_random_uuid(), 'Family', 'Relatives and family members', 'heart', '#EC4899', true, true),
  (gen_random_uuid(), 'Church', 'Faith community connections', 'church', '#8B5CF6', true, true),
  (gen_random_uuid(), 'Business', 'Professional and business contacts', 'briefcase', '#0EA5E9', true, true),
  (gen_random_uuid(), 'Mentorship', 'Mentors and mentees', 'graduation-cap', '#14B8A6', true, true),
  (gen_random_uuid(), 'Neighbour', 'Neighbours and local community', 'home', '#F59E0B', true, true),
  (gen_random_uuid(), 'School', 'School friends and classmates', 'book-open', '#6366F1', true, true),
  (gen_random_uuid(), 'University', 'University and alumni network', 'landmark', '#7C3AED', true, true),
  (gen_random_uuid(), 'Sports', 'Teammates and sports community', 'trophy', '#22C55E', true, true),
  (gen_random_uuid(), 'Community', 'Community groups and clubs', 'users-round', '#06B6D4', true, true),
  (gen_random_uuid(), 'Entrepreneur', 'Founders and startup circles', 'rocket', '#F97316', true, true),
  (gen_random_uuid(), 'Professional', 'Colleagues and industry peers', 'building-2', '#64748B', true, true),
  (gen_random_uuid(), 'Creative', 'Artists and creative collaborators', 'palette', '#D946EF', true, true),
  (gen_random_uuid(), 'Volunteer', 'Volunteer and service connections', 'hand-heart', '#10B981', true, true),
  (gen_random_uuid(), 'Dating', 'Romantic introductions', 'sparkles', '#FB7185', true, true)
ON CONFLICT ("name") DO NOTHING;
