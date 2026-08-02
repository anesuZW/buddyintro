/**
 * READ-ONLY schema + migration audit for Production Readiness Phase 1–2.
 * Does not apply migrations or modify schema.
 */
import fs from "fs";
import path from "path";
import pg from "pg";

const ROOT = path.resolve(process.cwd());
const OUT_DIR = path.join(ROOT, "docs/performance/production-readiness/artifacts");

const MIGRATION_ORDER = [
  "0001_baseline",
  "0002_discoveries",
  "0003_trust_graph",
  "0004_notifications",
  "0005_moderation",
  "0006_platform",
  "0007_security_rbac",
  "0008_media_platform",
  "0009_i18n",
  "0010_pwa_push",
  "0011_message_unread_index",
];

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

function maskUrl(url: string | undefined) {
  if (!url) return null;
  return url.replace(/:[^:@/]+@/, ":***@").replace(/\?.*/, "");
}

async function introspect(label: string, connectionString: string) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 25000,
  });
  const t0 = performance.now();
  await client.connect();
  const connectMs = Math.round(performance.now() - t0);

  const tables = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const columns = await client.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
  }>(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const indexes = await client.query<{
    tablename: string;
    indexname: string;
    indexdef: string;
  }>(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);

  const fks = await client.query<{
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
  }>(`
    SELECT
      tc.constraint_name,
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `);

  const constraints = await client.query<{
    table_name: string;
    constraint_name: string;
    constraint_type: string;
  }>(`
    SELECT table_name, constraint_name, constraint_type
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
    ORDER BY table_name, constraint_type, constraint_name
  `);

  let migrations: Array<Record<string, unknown>> = [];
  let migrationsTableExists = false;
  try {
    const exists = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    `);
    migrationsTableExists = (exists.rowCount ?? 0) > 0;
    if (migrationsTableExists) {
      const rows = await client.query(`
        SELECT id, migration_name, finished_at, applied_steps_count, rolled_back_at, logs, started_at
        FROM "_prisma_migrations"
        ORDER BY started_at ASC NULLS LAST, migration_name ASC
      `);
      migrations = rows.rows;
    }
  } catch (e) {
    migrations = [{ error: String(e) }];
  }

  const preferred = await client.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'preferred_language'
  `);

  const preferredIdx = await client.query(`
    SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'users_preferred_language_idx'
  `);

  // Markers from verify-migration-baseline.sql
  const markers: Record<string, boolean> = {};
  const markerChecks: Array<[string, string]> = [
    ["has_users", `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'`],
    ["has_discoveries_posts", `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='discoveries_posts'`],
    ["has_user_connections", `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_connections'`],
    ["has_notifications", `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications'`],
    ["has_user_blocks", `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_blocks'`],
    ["has_background_jobs", `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='background_jobs'`],
    ["has_roles", `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='roles'`],
    ["has_media_objects", `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='media_objects'`],
    ["has_preferred_language_column", `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='preferred_language'`],
    ["has_push_endpoint_unique", `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='push_subscriptions_endpoint_key'`],
    [
      "has_messages_unread_idx",
      `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND (
         indexname ILIKE '%message%unread%'
         OR (tablename='messages' AND indexdef ILIKE '%read_at%')
       )`,
    ],
  ];
  for (const [name, sql] of markerChecks) {
    try {
      const r = await client.query(sql);
      markers[name] = (r.rowCount ?? 0) > 0;
    } catch {
      markers[name] = false;
    }
  }

  // users columns specifically
  const userCols = columns.rows.filter((c) => c.table_name === "users").map((c) => c.column_name);

  await client.end();

  return {
    label,
    connectMs,
    maskedUrl: maskUrl(connectionString),
    tableCount: tables.rows.length,
    tables: tables.rows.map((t) => t.table_name),
    columnCount: columns.rows.length,
    indexCount: indexes.rows.length,
    fkCount: fks.rows.length,
    constraintCount: constraints.rows.length,
    preferredLanguage: {
      exists: preferred.rows.length > 0,
      column: preferred.rows[0] ?? null,
      indexExists: preferredIdx.rows.length > 0,
      index: preferredIdx.rows[0] ?? null,
    },
    userColumns: userCols,
    markers,
    migrationsTableExists,
    migrations,
    sampleIndexes: indexes.rows.slice(0, 30),
    foreignKeysSample: fks.rows.slice(0, 40),
  };
}

function parsePrismaModels() {
  const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
  const models: Array<{ model: string; table: string; fields: string[] }> = [];
  const modelRe = /model\s+(\w+)\s*\{([^}]+)\}/gs;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema))) {
    const body = m[2];
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const table = mapMatch?.[1] ?? m[1];
    // Rough field names with @map
    const fields: string[] = [];
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;
      const fieldMap = trimmed.match(/@map\("([^"]+)"\)/);
      const fieldName = trimmed.match(/^(\w+)\s+/);
      if (fieldName && !["id"].includes("") ) {
        fields.push(fieldMap?.[1] ?? camelToSnakeGuess(fieldName[1], trimmed));
      }
    }
    models.push({ model: m[1], table: toSnake(table === m[1] ? guessTable(m[1], body) : table), fields });
  }
  return models;
}

function guessTable(model: string, body: string) {
  const mapMatch = body.match(/@@map\("([^"]+)"\)/);
  return mapMatch?.[1] ?? camelToSnake(model);
}

function toSnake(s: string) {
  return s;
}

function camelToSnake(s: string) {
  return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function camelToSnakeGuess(field: string, line: string) {
  if (line.includes("@map(")) {
    const m = line.match(/@map\("([^"]+)"\)/);
    if (m) return m[1];
  }
  return camelToSnake(field);
}

function listFilesystemMigrations() {
  const dir = path.join(ROOT, "prisma/migrations");
  return MIGRATION_ORDER.map((id) => {
    const sqlPath = path.join(dir, id, "migration.sql");
    return {
      id,
      exists: fs.existsSync(sqlPath),
      bytes: fs.existsSync(sqlPath) ? fs.statSync(sqlPath).size : 0,
      head: fs.existsSync(sqlPath)
        ? fs.readFileSync(sqlPath, "utf8").split(/\r?\n/).slice(0, 8).join("\n")
        : null,
    };
  });
}

async function main() {
  loadEnv();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const urls: Array<[string, string | undefined]> = [
    ["DATABASE_URL", process.env.DATABASE_URL],
    ["DIRECT_URL", process.env.DIRECT_URL],
    ["LOCAL_DATABASE_URL", process.env.LOCAL_DATABASE_URL],
  ];

  const results: Record<string, unknown> = {
    capturedAt: new Date().toISOString(),
    urlsConfigured: Object.fromEntries(
      urls.map(([k, v]) => [k, { configured: Boolean(v), masked: maskUrl(v) }])
    ),
    filesystemMigrations: listFilesystemMigrations(),
    prismaUserPreferredLanguageInSchema: fs
      .readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8")
      .includes('preferred_language'),
    targets: [] as unknown[],
  };

  // Deduplicate identical URLs
  const seen = new Set<string>();
  for (const [label, url] of urls) {
    if (!url) {
      (results.targets as unknown[]).push({ label, skipped: "not configured" });
      continue;
    }
    if (seen.has(url)) {
      (results.targets as unknown[]).push({ label, skipped: "same as previous URL", maskedUrl: maskUrl(url) });
      continue;
    }
    seen.add(url);
    try {
      const data = await introspect(label, url);
      (results.targets as unknown[]).push(data);
    } catch (e) {
      (results.targets as unknown[]).push({
        label,
        error: e instanceof Error ? e.message : String(e),
        maskedUrl: maskUrl(url),
      });
    }
  }

  // Compare Prisma expected tables (from @@map / model names) via migrate diff if possible later
  const schema = fs.readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
  const expectedTables = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]);
  results.prismaMappedTables = [...new Set(expectedTables)].sort();

  const outPath = path.join(OUT_DIR, "schema-migration-audit.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log("\nWrote", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
