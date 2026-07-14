-- Story visibility modes: replace all_mutual/same_category with trust-first modes

CREATE TYPE "IntroductionVisibilityMode_new" AS ENUM (
  'specific_people_only',
  'mutual_introduction_network',
  'everyone_i_have_introduced'
);

ALTER TABLE stories ALTER COLUMN visibility_mode DROP DEFAULT;
ALTER TABLE stories
  ALTER COLUMN visibility_mode TYPE "IntroductionVisibilityMode_new"
  USING (
    CASE visibility_mode::text
      WHEN 'all_mutual' THEN 'mutual_introduction_network'::"IntroductionVisibilityMode_new"
      WHEN 'same_category' THEN 'specific_people_only'::"IntroductionVisibilityMode_new"
      ELSE 'mutual_introduction_network'::"IntroductionVisibilityMode_new"
    END
  );

ALTER TABLE discoveries_posts ALTER COLUMN visibility_mode DROP DEFAULT;
ALTER TABLE discoveries_posts
  ALTER COLUMN visibility_mode TYPE "IntroductionVisibilityMode_new"
  USING (
    CASE visibility_mode::text
      WHEN 'all_mutual' THEN 'mutual_introduction_network'::"IntroductionVisibilityMode_new"
      WHEN 'same_category' THEN 'specific_people_only'::"IntroductionVisibilityMode_new"
      ELSE 'mutual_introduction_network'::"IntroductionVisibilityMode_new"
    END
  );

DROP TYPE "IntroductionVisibilityMode";
ALTER TYPE "IntroductionVisibilityMode_new" RENAME TO "IntroductionVisibilityMode";

ALTER TABLE stories
  ALTER COLUMN visibility_mode SET DEFAULT 'mutual_introduction_network';

ALTER TABLE discoveries_posts
  ALTER COLUMN visibility_mode SET DEFAULT 'mutual_introduction_network';

ALTER TABLE admin_settings
  ADD COLUMN IF NOT EXISTS enable_specific_people_visibility BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS enable_mutual_introduction_network_visibility BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_everyone_introduced_visibility BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_story_visibility_mode "IntroductionVisibilityMode" NOT NULL DEFAULT 'mutual_introduction_network',
  ADD COLUMN IF NOT EXISTS allow_user_visibility_selection BOOLEAN NOT NULL DEFAULT true;
