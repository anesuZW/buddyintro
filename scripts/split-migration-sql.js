#!/usr/bin/env node
/**
 * Split Prisma full-schema diff into ordered migration folders.
 * Source: prisma/_full_schema_diff.sql (from prisma migrate diff)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FULL_SQL = path.join(ROOT, "prisma", "_full_schema_diff.sql");
const MIGRATIONS_DIR = path.join(ROOT, "prisma", "migrations");

const MIGRATIONS = [
  {
    id: "0001_baseline",
    title: "Core identity, stories, invitations, messages, admin settings",
    tables: new Set([
      "users",
      "stories",
      "story_tags",
      "invitations",
      "messages",
      "posts",
      "admin_settings",
      "user_consents",
    ]),
    enums: new Set([
      "StoryStatus",
      "MediaType",
      "InviteMethod",
      "ConversationOrigin",
      "DiscoveriesVisibility",
      "IntroductionVisibilityMode",
      "NotificationDigestFrequency",
      "ReportStatus",
      "ReportTargetType",
      "VerificationLevel",
      "BackgroundJobStatus",
      "TrustRankTier",
      "TrustRiskLevel",
      "SecurityEventSeverity",
      "JobPriority",
    ]),
  },
  {
    id: "0002_discoveries",
    title: "Discoveries feed and conversation context",
    tables: new Set([
      "discoveries_posts",
      "discoveries_likes",
      "discoveries_comments",
      "discoveries_bookmarks",
      "discoveries_shares",
      "conversation_contexts",
    ]),
    enums: new Set(),
  },
  {
    id: "0003_trust_graph",
    title: "Trust graph, introduction categories, shared introducers",
    tables: new Set([
      "user_connections",
      "introduction_categories",
      "shared_introducer_relationships",
    ]),
    enums: new Set(),
  },
  {
    id: "0004_notifications",
    title: "Notifications, preferences, push, analytics",
    tables: new Set([
      "notifications",
      "notification_preferences",
      "push_subscriptions",
      "analytics_events",
    ]),
    enums: new Set(),
  },
  {
    id: "0005_moderation",
    title: "Moderation, verification challenges, user blocks, reports",
    tables: new Set([
      "phone_verification_challenges",
      "user_blocks",
      "content_reports",
    ]),
    enums: new Set(),
  },
  {
    id: "0006_platform",
    title: "Background jobs platform",
    tables: new Set(["background_jobs"]),
    enums: new Set(),
  },
  {
    id: "0007_security_rbac",
    title: "RBAC, audit logs, security events",
    tables: new Set([
      "roles",
      "permissions",
      "role_permissions",
      "user_roles",
      "admin_audit_logs",
      "security_events",
    ]),
    enums: new Set(),
  },
];

const TABLE_TO_MIGRATION = new Map();
for (const m of MIGRATIONS) {
  for (const t of m.tables) TABLE_TO_MIGRATION.set(t, m.id);
}

function migrationForTable(table) {
  return TABLE_TO_MIGRATION.get(table) || "0007_security_rbac";
}

function parseBlocks(sql) {
  const lines = sql.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("-- CreateEnum")) {
      if (current) blocks.push(current);
      current = { type: "enum", lines: [line] };
      continue;
    }
    if (line.startsWith("-- CreateTable")) {
      if (current) blocks.push(current);
      current = { type: "table", lines: [line], table: null };
      continue;
    }
    if (line.startsWith("-- CreateIndex")) {
      if (current) blocks.push(current);
      current = { type: "index", lines: [line], table: null };
      continue;
    }
    if (line.startsWith("-- AddForeignKey")) {
      if (current) blocks.push(current);
      current = { type: "fk", lines: [line], table: null };
      continue;
    }
    if (!current) continue;
    current.lines.push(line);
    if (current.type === "table" && line.startsWith('CREATE TABLE "')) {
      current.table = line.match(/CREATE TABLE "([^"]+)"/)?.[1];
    }
    if (current.type === "index" && line.startsWith("CREATE ")) {
      current.table = line.match(/ ON "([^"]+)"/)?.[1];
    }
    if (current.type === "fk" && line.startsWith("ALTER TABLE ")) {
      current.table = line.match(/ALTER TABLE "([^"]+)"/)?.[1];
    }
    if (current.type === "fk" && line.includes("REFERENCES ")) {
      current.refTable = line.match(/REFERENCES "([^"]+)"/)?.[1];
    }
    if (current.type === "enum" && line.startsWith('CREATE TYPE "')) {
      current.enum = line.match(/CREATE TYPE "([^"]+)"/)?.[1];
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

function assignBlock(block) {
  if (block.type === "enum") {
    for (const m of MIGRATIONS) {
      if (m.enums.has(block.enum)) return m.id;
    }
    return "0001_baseline";
  }
  if (block.type === "fk") {
    const source = migrationForTable(block.table);
    const target = migrationForTable(block.refTable);
    const order = MIGRATIONS.map((m) => m.id);
    return order[Math.max(order.indexOf(source), order.indexOf(target))];
  }
  if (block.table) return migrationForTable(block.table);
  return "0001_baseline";
}

function seedSql(migrationId) {
  if (migrationId === "0001_baseline") {
    return [
      "",
      "-- Seed default admin settings row",
      'INSERT INTO "admin_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;',
    ].join("\n");
  }
  if (migrationId === "0003_trust_graph") {
    return [
      "",
      "-- Seed system introduction categories",
      `INSERT INTO "introduction_categories" ("id", "name", "description", "icon", "color", "is_system", "is_active") VALUES`,
      `  (gen_random_uuid(), 'Friend', 'Close friends and companions', 'users', '#2563EB', true, true),`,
      `  ('Family', 'Relatives and family members', 'heart', '#EC4899', true, true),`,
      `  ('Church', 'Faith community connections', 'church', '#8B5CF6', true, true),`,
      `  ('Business', 'Professional and business contacts', 'briefcase', '#0EA5E9', true, true),`,
      `  ('Mentorship', 'Mentors and mentees', 'graduation-cap', '#14B8A6', true, true),`,
      `  ('Neighbour', 'Neighbours and local community', 'home', '#F59E0B', true, true),`,
      `  ('School', 'School friends and classmates', 'book-open', '#6366F1', true, true),`,
      `  ('University', 'University and alumni network', 'landmark', '#7C3AED', true, true),`,
      `  ('Sports', 'Teammates and sports community', 'trophy', '#22C55E', true, true),`,
      `  ('Community', 'Community groups and clubs', 'users-round', '#06B6D4', true, true),`,
      `  ('Entrepreneur', 'Founders and startup circles', 'rocket', '#F97316', true, true),`,
      `  ('Professional', 'Colleagues and industry peers', 'building-2', '#64748B', true, true),`,
      `  ('Creative', 'Artists and creative collaborators', 'palette', '#D946EF', true, true),`,
      `  ('Volunteer', 'Volunteer and service connections', 'hand-heart', '#10B981', true, true),`,
      `  ('Dating', 'Romantic introductions', 'sparkles', '#FB7185', true, true)`,
      `ON CONFLICT ("name") DO NOTHING;`,
    ].join("\n");
  }
  if (migrationId === "0007_security_rbac") {
    return fs.readFileSync(path.join(ROOT, "prisma", "_rbac_seed.sql"), "utf8");
  }
  return "";
}

function main() {
  if (!fs.existsSync(FULL_SQL)) {
    console.error(`Missing ${FULL_SQL}. Run: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script -o prisma/_full_schema_diff.sql`);
    process.exit(1);
  }

  const sql = fs.readFileSync(FULL_SQL, "utf8");
  const blocks = parseBlocks(sql);
  const buckets = Object.fromEntries(MIGRATIONS.map((m) => [m.id, []]));

  for (const block of blocks) {
    const id = assignBlock(block);
    buckets[id].push(block.lines.join("\n"));
  }

  for (const m of MIGRATIONS) {
    const dir = path.join(MIGRATIONS_DIR, m.id);
    fs.mkdirSync(dir, { recursive: true });
    const header = `-- ${m.id}: ${m.title}\n-- Generated from schema.prisma via prisma migrate diff\n`;
    const body = buckets[m.id].join("\n\n");
    const seed = seedSql(m.id);
    fs.writeFileSync(path.join(dir, "migration.sql"), `${header}\n${body}${seed}\n`);
    console.log(`✓ ${m.id} (${buckets[m.id].length} blocks)`);
  }
}

main();
