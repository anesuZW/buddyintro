/**
 * Static migration audit helpers — used by certification tests.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const MIGRATIONS_DIR = path.join(ROOT, "prisma", "migrations");
const SCHEMA_PATH = path.join(ROOT, "prisma", "schema.prisma");

const MIGRATION_ORDER = [
  "0001_baseline",
  "0002_discoveries",
  "0003_trust_graph",
  "0004_notifications",
  "0005_moderation",
  "0006_platform",
  "0007_security_rbac",
  "0008_media_platform",
];

const TABLE_MIGRATION = {
  users: "0001_baseline",
  stories: "0001_baseline",
  story_tags: "0001_baseline",
  invitations: "0001_baseline",
  messages: "0001_baseline",
  posts: "0001_baseline",
  admin_settings: "0001_baseline",
  user_consents: "0001_baseline",
  discoveries_posts: "0002_discoveries",
  discoveries_likes: "0002_discoveries",
  discoveries_comments: "0002_discoveries",
  discoveries_bookmarks: "0002_discoveries",
  discoveries_shares: "0002_discoveries",
  conversation_contexts: "0002_discoveries",
  user_connections: "0003_trust_graph",
  introduction_categories: "0003_trust_graph",
  shared_introducer_relationships: "0003_trust_graph",
  notifications: "0004_notifications",
  notification_preferences: "0004_notifications",
  push_subscriptions: "0004_notifications",
  analytics_events: "0004_notifications",
  phone_verification_challenges: "0005_moderation",
  user_blocks: "0005_moderation",
  content_reports: "0005_moderation",
  background_jobs: "0006_platform",
  roles: "0007_security_rbac",
  permissions: "0007_security_rbac",
  role_permissions: "0007_security_rbac",
  user_roles: "0007_security_rbac",
  admin_audit_logs: "0007_security_rbac",
  security_events: "0007_security_rbac",
  media_objects: "0008_media_platform",
};

function listMigrationSql() {
  return MIGRATION_ORDER.map((id) => ({
    id,
    sql: fs.readFileSync(path.join(MIGRATIONS_DIR, id, "migration.sql"), "utf8"),
  }));
}

function parseCreateTables(sql) {
  const tables = [];
  const re = /CREATE TABLE "([^"]+)"/g;
  let m;
  while ((m = re.exec(sql))) tables.push(m[1]);
  return tables;
}

function parseForeignKeys(sql) {
  const fks = [];
  const re = /ALTER TABLE "([^"]+)" ADD CONSTRAINT "[^"]+" FOREIGN KEY \([^)]+\) REFERENCES "([^"]+)"/g;
  let m;
  while ((m = re.exec(sql))) {
    fks.push({ from: m[1], to: m[2] });
  }
  return fks;
}

function parseInserts(sql) {
  return (sql.match(/INSERT INTO/gi) || []).length;
}

function migrationIndex(id) {
  return MIGRATION_ORDER.indexOf(id);
}

function auditFkOrdering() {
  const issues = [];
  const created = new Set();

  for (const { id, sql } of listMigrationSql()) {
    for (const table of parseCreateTables(sql)) {
      created.add(table);
    }
    for (const fk of parseForeignKeys(sql)) {
      if (!created.has(fk.to)) {
        issues.push(`${id}: FK ${fk.from} → ${fk.to} references table not yet created`);
      }
      const fromIdx = migrationIndex(TABLE_MIGRATION[fk.from] || id);
      const toIdx = migrationIndex(TABLE_MIGRATION[fk.to]);
      if (toIdx > migrationIndex(id) && !created.has(fk.to)) {
        issues.push(`${id}: FK ${fk.from} → ${fk.to} crosses migration boundary incorrectly`);
      }
    }
  }
  return issues;
}

function auditSeeds() {
  const issues = [];
  const baseline = fs.readFileSync(path.join(MIGRATIONS_DIR, "0001_baseline", "migration.sql"), "utf8");
  if (!baseline.includes('"updated_at"') || !baseline.match(/INSERT INTO "admin_settings"[^;]*"updated_at"/)) {
    issues.push("0001_baseline: admin_settings seed must include updated_at");
  }
  const trust = fs.readFileSync(path.join(MIGRATIONS_DIR, "0003_trust_graph", "migration.sql"), "utf8");
  if (!trust.includes('INSERT INTO "introduction_categories" ("id"')) {
    issues.push("0003_trust_graph: introduction_categories seed must include id");
  }
  const rbac = fs.readFileSync(path.join(MIGRATIONS_DIR, "0007_security_rbac", "migration.sql"), "utf8");
  if (!rbac.includes('gen_random_uuid()')) {
    issues.push("0007_security_rbac: roles/permissions seed must generate UUIDs");
  }
  return issues;
}

function auditDuplicates() {
  const issues = [];
  const allSql = listMigrationSql().map((m) => m.sql).join("\n");
  const enums = [...allSql.matchAll(/CREATE TYPE "([^"]+)"/g)].map((m) => m[1]);
  const tables = [...allSql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]);
  for (const [name, arr] of [
    ["enum", enums],
    ["table", tables],
  ]) {
    const seen = new Set();
    for (const item of arr) {
      if (seen.has(item)) issues.push(`Duplicate ${name}: ${item}`);
      seen.add(item);
    }
  }
  return issues;
}

function auditBaselineCompleteness() {
  const baseline = fs.readFileSync(path.join(MIGRATIONS_DIR, "0001_baseline", "migration.sql"), "utf8");
  const required = ["users", "stories", "invitations", "messages", "admin_settings", "user_consents"];
  const missing = required.filter((t) => !baseline.includes(`CREATE TABLE "${t}"`));
  return missing.map((t) => `0001_baseline missing table: ${t}`);
}

function auditSchemaEnums() {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8");
  const schemaEnums = [...schema.matchAll(/^enum (\w+)/gm)].map((m) => m[1]);
  const allSql = listMigrationSql().map((m) => m.sql).join("\n");
  const sqlEnums = [...allSql.matchAll(/CREATE TYPE "([^"]+)"/g)].map((m) => m[1]);
  const issues = [];
  for (const e of schemaEnums) {
    if (!sqlEnums.includes(e)) issues.push(`Missing enum in migrations: ${e}`);
  }
  for (const e of sqlEnums) {
    if (!schemaEnums.includes(e)) issues.push(`Extra enum in migrations: ${e}`);
  }
  return issues;
}

function runStaticAudit() {
  return {
    fkOrdering: auditFkOrdering(),
    seeds: auditSeeds(),
    duplicates: auditDuplicates(),
    baseline: auditBaselineCompleteness(),
    enums: auditSchemaEnums(),
  };
}

module.exports = {
  MIGRATION_ORDER,
  TABLE_MIGRATION,
  listMigrationSql,
  auditFkOrdering,
  auditSeeds,
  auditDuplicates,
  auditBaselineCompleteness,
  auditSchemaEnums,
  runStaticAudit,
};
