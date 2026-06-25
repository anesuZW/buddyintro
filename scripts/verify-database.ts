/**
 * Database verification against prisma/schema.prisma
 * Usage: npm run verify-database
 */
import fs from "fs";
import { execSync } from "child_process";
import pg from "pg";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

type Check = { name: string; ok: boolean; detail?: string };

const checks: Check[] = [];

function pass(name: string, detail?: string) {
  checks.push({ name, ok: true, detail });
}

function fail(name: string, detail?: string) {
  checks.push({ name, ok: false, detail });
}

const expectedTables = [
  "users",
  "stories",
  "story_tags",
  "invitations",
  "messages",
  "conversation_contexts",
  "posts",
  "discoveries_posts",
  "discoveries_likes",
  "discoveries_comments",
  "discoveries_bookmarks",
  "discoveries_shares",
  "user_consents",
  "admin_settings",
  "user_connections",
  "introduction_categories",
  "shared_introducer_relationships",
  "notifications",
  "notification_preferences",
  "push_subscriptions",
  "analytics_events",
  "phone_verification_challenges",
  "user_blocks",
  "content_reports",
  "background_jobs",
  "roles",
  "permissions",
  "role_permissions",
  "user_roles",
  "admin_audit_logs",
  "security_events",
];

const expectedEnums: Record<string, string[]> = {
  StoryStatus: ["draft", "published", "expired"],
  MediaType: ["image", "video"],
  InviteMethod: ["email", "whatsapp", "sms", "imessage"],
  DiscoveriesVisibility: ["network", "public"],
  ConversationOrigin: ["story", "discoveries", "direct"],
  IntroductionVisibilityMode: [
    "specific_people_only",
    "mutual_introduction_network",
    "everyone_i_have_introduced",
  ],
  NotificationDigestFrequency: ["instant", "daily", "weekly"],
  VerificationLevel: ["none", "phone", "email", "identity", "trusted"],
  BackgroundJobStatus: ["pending", "processing", "completed", "failed", "dead"],
  TrustRankTier: ["bronze", "silver", "gold", "platinum", "diamond"],
  TrustRiskLevel: ["low", "medium", "high", "critical"],
  SecurityEventSeverity: ["low", "medium", "high", "critical"],
  JobPriority: ["low", "normal", "high", "critical"],
};

const adminColumns = [
  "introductions_never_expire",
  "discoveries_network_depth",
  "show_connection_reasons",
  "show_connection_paths",
  "enable_introduction_graph",
  "allow_first_degree_discovery",
  "allow_second_degree_discovery",
  "allow_third_degree_discovery",
  "allow_fourth_degree_discovery",
  "max_discovery_depth",
  "enable_trust_scores",
  "enable_verification_layer",
  "enable_introduction_categories",
  "allow_user_created_categories",
  "allow_category_editing",
  "require_phone_verification",
  "require_identity_verification",
  "show_trust_scores",
  "show_shared_introducers",
  "enable_shared_introducer_trust",
  "show_shared_introducer_counts",
  "shared_introducer_weight",
  "minimum_shared_introducers_for_messaging",
  "minimum_shared_introducers_for_discovery",
  "enable_notifications",
  "enable_in_app_notifications",
  "enable_push_notifications",
  "enable_email_notifications",
  "enable_introduction_notifications",
  "enable_discovery_notifications",
  "enable_message_notifications",
  "enable_trust_notifications",
  "enable_verification_notifications",
  "enable_announcement_notifications",
  "enable_introduction_view_notifications",
  "enable_notification_digests",
  "notification_digest_frequency",
  "enable_discovery_controls",
  "enable_granular_verification_gates",
  "enable_background_jobs",
  "enable_trust_rankings",
  "enable_trust_recommendations",
  "allow_cross_category_discovery",
  "allow_discovery_messaging",
  "require_shared_introducer_for_discovery",
  "require_shared_introducer_for_messaging",
  "hide_discovery_from_unverified_users",
  "require_email_verification",
  "enable_specific_people_visibility",
  "enable_mutual_introduction_network_visibility",
  "enable_everyone_introduced_visibility",
  "default_story_visibility_mode",
  "allow_user_visibility_selection",
  "enable_discoveries_hero_banner",
  "enable_discovery_expiry_indicators",
  "enable_discovery_trust_context",
];

const expectedFkeys = [
  "messages_discoveries_post_reference_fkey",
  "conversation_contexts_user_a_id_fkey",
  "conversation_contexts_user_b_id_fkey",
  "conversation_contexts_story_reference_fkey",
  "conversation_contexts_discoveries_post_reference_fkey",
  "discoveries_posts_user_id_fkey",
  "discoveries_likes_post_id_fkey",
  "discoveries_likes_user_id_fkey",
  "discoveries_comments_post_id_fkey",
  "discoveries_comments_user_id_fkey",
  "discoveries_bookmarks_post_id_fkey",
  "discoveries_bookmarks_user_id_fkey",
  "discoveries_shares_post_id_fkey",
  "discoveries_shares_user_id_fkey",
  "user_consents_user_id_fkey",
  "user_connections_source_user_id_fkey",
  "user_connections_target_user_id_fkey",
  "user_connections_introduced_via_story_id_fkey",
  "shared_introducer_relationships_user_a_id_fkey",
  "shared_introducer_relationships_user_b_id_fkey",
  "shared_introducer_relationships_shared_introducer_id_fkey",
];

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("FAIL: DATABASE_URL / DIRECT_URL not set");
    process.exit(1);
  }

  try {
    execSync("npx prisma generate", { stdio: "pipe" });
    pass("Prisma client generation");
  } catch (e) {
    fail("Prisma client generation", String(e));
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = (
    await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    )
  ).rows.map((r) => r.table_name as string);

  for (const t of expectedTables) {
    if (tables.includes(t)) pass(`Table exists: ${t}`);
    else fail(`Table exists: ${t}`);
  }

  const columns = (
    await client.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
    )
  ).rows as Array<{ table_name: string; column_name: string }>;

  const colSet = new Set(columns.map((c) => `${c.table_name}.${c.column_name}`));

  const userConnectionCols = [
    "id",
    "source_user_id",
    "target_user_id",
    "degree",
    "introduced_via_story_id",
    "shared_introducer_count",
    "trust_score",
    "highest_trust_path",
    "created_at",
    "updated_at",
  ];
  for (const c of userConnectionCols) {
    const key = `user_connections.${c}`;
    if (colSet.has(key)) pass(`Column exists: ${key}`);
    else fail(`Column exists: ${key}`);
  }

  const userVerificationCols = [
    "users.phone_verified",
    "users.email_verified",
    "users.identity_verified",
    "stories.introduction_category_id",
    "stories.visibility_mode",
  ];
  for (const key of userVerificationCols) {
    if (colSet.has(key)) pass(`Column exists: ${key}`);
    else fail(`Column exists: ${key}`);
  }

  const hardeningUserCols = [
    "users.banned_at",
    "users.trust_risk_score",
    "users.trust_risk_level",
    "users.trust_risk_reviewed_at",
    "users.trust_risk_false_positive",
    "background_jobs.priority",
    "background_jobs.scheduled_at",
  ];
  for (const key of hardeningUserCols) {
    if (colSet.has(key)) pass(`Column exists: ${key}`);
    else fail(`Column exists: ${key}`);
  }

  for (const c of adminColumns) {
    const key = `admin_settings.${c}`;
    if (colSet.has(key)) pass(`Admin column: ${c}`);
    else fail(`Admin column: ${c}`);
  }

  const enums = await client.query(
    `SELECT t.typname AS enum_name, e.enumlabel AS enum_value
     FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'`
  );

  const enumMap = new Map<string, Set<string>>();
  for (const row of enums.rows) {
    const set = enumMap.get(row.enum_name) ?? new Set<string>();
    set.add(row.enum_value);
    enumMap.set(row.enum_name, set);
  }

  for (const [name, values] of Object.entries(expectedEnums)) {
    const dbValues = enumMap.get(name);
    if (!dbValues) {
      fail(`Enum exists: ${name}`);
      continue;
    }
    const missing = values.filter((v) => !dbValues.has(v));
    if (missing.length) fail(`Enum values: ${name}`, `missing ${missing.join(", ")}`);
    else pass(`Enum values: ${name}`);
  }

  const indexes = (
    await client.query(`SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`)
  ).rows.map((r) => r.indexname as string);

  const requiredIndexes = [
    "user_connections_source_user_id_idx",
    "user_connections_target_user_id_idx",
    "user_connections_degree_idx",
    "user_connections_source_user_id_target_user_id_key",
    "shared_introducer_relationships_user_pair_idx",
    "shared_introducer_relationships_introducer_idx",
    "story_tags_story_id_tagged_external_phone_key",
    "notifications_user_id_idx",
    "notifications_is_read_idx",
    "notifications_created_at_idx",
    "analytics_events_event_type_idx",
    "analytics_events_user_id_idx",
    "analytics_events_created_at_idx",
  ];

  for (const idx of requiredIndexes) {
    if (indexes.includes(idx)) pass(`Index exists: ${idx}`);
    else fail(`Index exists: ${idx}`);
  }

  const fkeys = (
    await client.query(
      `SELECT conname FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace`
    )
  ).rows.map((r) => r.conname as string);

  for (const fk of expectedFkeys) {
    if (fkeys.includes(fk)) pass(`Foreign key: ${fk}`);
    else fail(`Foreign key: ${fk}`);
  }

  const defaultRow = await client.query(
    `SELECT column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'admin_settings'
       AND column_name = 'discoveries_network_depth'`
  );
  const def = defaultRow.rows[0]?.column_default as string | undefined;
  if (def?.includes("2")) pass("admin_settings.discoveries_network_depth default = 2");
  else fail("admin_settings.discoveries_network_depth default = 2", def ?? "not set");

  const migrateTable = tables.includes("_prisma_migrations");
  if (migrateTable) pass("Prisma migrations table exists");
  else fail("Prisma migrations table exists", "run npx prisma migrate deploy");

  await client.end();

  console.log("\n=== FriendIntro Database Verification ===\n");
  let failed = 0;
  for (const c of checks) {
    const icon = c.ok ? "✓" : "✗";
    console.log(`${icon} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
    if (!c.ok) failed++;
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
