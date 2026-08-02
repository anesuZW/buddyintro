#!/usr/bin/env node
/**
 * READ-ONLY production schema audit.
 * Runs SELECT / information_schema / pg_catalog queries only.
 * Does NOT apply migrations, ALTER, DROP, DELETE, or RESET.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const OUT = path.join(ROOT, "docs/production-migration/artifacts");

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
  "0012_push_updated_at_no_default",
];

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}

function maskUrl(url) {
  if (!url) return null;
  return url.replace(/:[^:@/]+@/, ":***@").replace(/\?.*/, "");
}

function parseModelsFromSchema(schemaText) {
  const models = {};
  const enums = {};
  const modelRe = /model\s+(\w+)\s*\{([^}]+)\}/gs;
  const enumRe = /enum\s+(\w+)\s*\{([^}]+)\}/gs;
  let m;
  while ((m = modelRe.exec(schemaText))) {
    const name = m[1];
    const body = m[2];
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const table = mapMatch ? mapMatch[1] : name;
    const fields = [];
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("@@")) continue;
      if (trimmed.includes("@relation")) continue;
      const fm = trimmed.match(/^(\w+)\s+(\S+)/);
      if (!fm) continue;
      const fieldMap = trimmed.match(/@map\("([^"]+)"\)/);
      const col = fieldMap ? fieldMap[1] : fm[1];
      // skip relation-only fields (no scalar type markers like String/Int/DateTime/Boolean/Json/Decimal/enum)
      if (!/String|Int|Float|Boolean|DateTime|Json|BigInt|Bytes|Decimal|[A-Z][a-zA-Z]+(\?|\[\])?/.test(fm[2])) {
        continue;
      }
      // Heuristic: relation fields often end with [] or have no @db and look like ModelName
      if (/^[A-Z]/.test(fm[2].replace("?", "").replace("[]", "")) && !["String", "Int", "Float", "Boolean", "DateTime", "Json", "BigInt", "Bytes", "Decimal"].includes(fm[2].replace("?", "").replace("[]", ""))) {
        // could be enum — keep; enums are uppercase too
        if (fm[2].includes("[]") && !trimmed.includes("@")) continue;
        if (!trimmed.includes("@id") && !trimmed.includes("@default") && !trimmed.includes("@map") && !trimmed.includes("@unique") && !trimmed.includes("@db") && fm[2].endsWith("[]")) continue;
        if (!trimmed.includes("@") && /^[A-Z]/.test(fm[2]) && !fm[2].includes("?")) {
          // bare ModelName relation
          continue;
        }
      }
      fields.push({
        prisma: fm[1],
        column: col,
        type: fm[2],
        optional: fm[2].includes("?"),
        hasDefault: trimmed.includes("@default"),
        isId: trimmed.includes("@id"),
        isUnique: trimmed.includes("@unique"),
        raw: trimmed,
      });
    }
    const indexes = [...body.matchAll(/@@index\(\[([^\]]+)\](?:,\s*map:\s*"([^"]+)")?\)/g)].map(
      (x) => ({ fields: x[1], map: x[2] || null })
    );
    models[name] = { table, fields, indexes };
  }
  while ((m = enumRe.exec(schemaText))) {
    enums[m[1]] = m[2]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//"));
  }
  return { models, enums };
}

async function introspect(connectionString) {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();

  const tables = (
    await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)
  ).rows.map((r) => r.table_name);

  const columns = (
    await client.query(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
             character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `)
  ).rows;

  const indexes = (
    await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `)
  ).rows;

  const enums = (
    await client.query(`
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value, e.enumsortorder
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `)
  ).rows;

  const constraints = (
    await client.query(`
      SELECT tc.table_name, tc.constraint_name, tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `)
  ).rows;

  let migrations = { exists: false, rows: [], error: null };
  try {
    const has = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
    `);
    if (has.rowCount > 0) {
      migrations.exists = true;
      migrations.rows = (
        await client.query(`
          SELECT migration_name, finished_at, rolled_back_at, applied_steps_count,
                 started_at, logs
          FROM "_prisma_migrations"
          ORDER BY started_at NULLS LAST, migration_name
        `)
      ).rows;
    }
  } catch (e) {
    migrations.error = e.message;
  }

  const markers = {};
  const markerQueries = {
    preferred_language: `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='preferred_language'`,
    users_preferred_language_idx: `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='users_preferred_language_idx'`,
    media_objects: `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='media_objects'`,
    push_subscriptions_updated_at: `SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='push_subscriptions' AND column_name='updated_at'`,
    messages_receiver_id_read_at_idx: `SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='messages_receiver_id_read_at_idx'`,
  };
  for (const [k, q] of Object.entries(markerQueries)) {
    try {
      const r = await client.query(q);
      markers[k] = k === "push_subscriptions_updated_at" ? r.rows[0]?.column_default ?? null : r.rowCount > 0;
    } catch (e) {
      markers[k] = { error: e.message };
    }
  }

  // Sample: can we SELECT preferred_language?
  let preferredLanguageSelect = null;
  try {
    await client.query(`SELECT preferred_language FROM users LIMIT 0`);
    preferredLanguageSelect = { ok: true };
  } catch (e) {
    preferredLanguageSelect = { ok: false, code: e.code, message: e.message };
  }

  await client.end();
  return {
    tables,
    columns,
    indexes,
    enums,
    constraints,
    migrations,
    markers,
    preferredLanguageSelect,
  };
}

function compare(schemaPath, live) {
  const schemaText = fs.readFileSync(schemaPath, "utf8");
  const { models, enums: schemaEnums } = parseModelsFromSchema(schemaText);
  const liveTables = new Set(live.tables);
  const colsByTable = {};
  for (const c of live.columns) {
    (colsByTable[c.table_name] ??= new Set()).add(c.column_name);
  }
  const idxNames = new Set(live.indexes.map((i) => i.indexname));
  const liveEnumNames = new Set(live.enums.map((e) => e.enum_name));

  const missingTables = [];
  const missingColumns = [];
  const missingIndexes = [];
  const missingEnums = [];

  for (const [enumName] of Object.entries(schemaEnums)) {
    // Prisma enums often map to same name in PG
    if (!liveEnumNames.has(enumName)) missingEnums.push(enumName);
  }

  for (const [, model] of Object.entries(models)) {
    if (!liveTables.has(model.table)) {
      missingTables.push(model.table);
      continue;
    }
    for (const f of model.fields) {
      // skip relation arrays / bare relations already filtered; skip fields that are clearly relations
      if (f.type.endsWith("[]") && !["String", "Int"].some((t) => f.type.startsWith(t))) continue;
      if (!colsByTable[model.table]?.has(f.column)) {
        missingColumns.push({
          table: model.table,
          column: f.column,
          prismaField: f.prisma,
          type: f.type,
          hasDefault: f.hasDefault,
          optional: f.optional,
        });
      }
    }
    for (const idx of model.indexes) {
      if (idx.map && !idxNames.has(idx.map)) {
        missingIndexes.push({ table: model.table, index: idx.map, fields: idx.fields });
      }
    }
  }

  return {
    missingTables,
    missingColumns,
    missingIndexes,
    missingEnums,
    modelCount: Object.keys(models).length,
    schemaEnumCount: Object.keys(schemaEnums).length,
  };
}

function migrationFileHeads() {
  const dir = path.join(ROOT, "prisma/migrations");
  const out = {};
  for (const name of MIGRATION_ORDER) {
    const p = path.join(dir, name, "migration.sql");
    if (!fs.existsSync(p)) {
      out[name] = { missingFile: true };
      continue;
    }
    const sql = fs.readFileSync(p, "utf8");
    out[name] = {
      bytes: sql.length,
      head: sql.slice(0, 400),
      hasDrop: /^\s*DROP\s/im.test(sql),
      hasDelete: /^\s*DELETE\s/im.test(sql),
      hasTruncate: /^\s*TRUNCATE\s/im.test(sql),
    };
  }
  return out;
}

async function main() {
  loadEnv();
  fs.mkdirSync(OUT, { recursive: true });

  const databaseUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL missing");

  const report = {
    at: new Date().toISOString(),
    mode: "READ_ONLY",
    urls: {
      DATABASE_URL: maskUrl(databaseUrl),
      DIRECT_URL: maskUrl(directUrl),
    },
    migrationFiles: migrationFileHeads(),
    live: null,
    liveSource: null,
    compare: null,
    errors: [],
  };

  async function tryConnect(label, url) {
    if (!url) return null;
    try {
      const live = await introspect(url);
      report.live = live;
      report.liveSource = label;
      return live;
    } catch (e) {
      report.errors.push({ label, message: e.message, code: e.code });
      return null;
    }
  }

  let live = await tryConnect("DATABASE_URL", databaseUrl);
  if (!live) live = await tryConnect("DIRECT_URL", directUrl);
  if (!live) {
    fs.writeFileSync(path.join(OUT, "audit-failed.json"), JSON.stringify(report, null, 2));
    console.error(JSON.stringify(report, null, 2));
    process.exit(2);
  }

  report.compare = compare(path.join(ROOT, "prisma/schema.prisma"), live);

  // Migration status vs files
  const applied = new Set(
    (live.migrations.rows || [])
      .filter((r) => r.finished_at && !r.rolled_back_at)
      .map((r) => r.migration_name)
  );
  const failed = (live.migrations.rows || []).filter(
    (r) => !r.finished_at || r.rolled_back_at || (r.logs && String(r.logs).length)
  );
  report.migrationStatus = {
    tableExists: live.migrations.exists,
    applied: MIGRATION_ORDER.map((name) => ({
      name,
      recorded: applied.has(name),
      // object-level hints
      objectHint: {
        "0009_i18n": live.markers.preferred_language,
        "0008_media_platform": live.markers.media_objects,
        "0011_message_unread_index": live.markers.messages_receiver_id_read_at_idx,
      }[name],
    })),
    failedOrIncomplete: failed,
    recordedNames: [...applied],
  };

  fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        liveSource: report.liveSource,
        markers: live.markers,
        preferredLanguageSelect: live.preferredLanguageSelect,
        migrationsTable: live.migrations.exists,
        appliedCount: applied.size,
        missingColumns: report.compare.missingColumns.length,
        missingTables: report.compare.missingTables.length,
        missingIndexes: report.compare.missingIndexes.length,
        missingEnums: report.compare.missingEnums.length,
        missingColumnSample: report.compare.missingColumns.slice(0, 40),
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
