/**
 * Database architecture audit — read-only.
 * Usage: npm run audit:db
 */
import pg from "pg";
import fs from "fs";
import {
  loadEnv,
  printReport,
  type AuditFinding,
} from "./audit-shared";

loadEnv();

const PRISMA_MODELS = [
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
];

const SCHEMA_INDEX_HINTS: Record<string, string[]> = {
  messages: ["(receiver_id, read_at)", "(sender_id, receiver_id, created_at)"],
  discoveries_posts: ["(visibility, created_at)", "(user_id, created_at)"],
  story_tags: ["(tagged_user_id, story_id)"],
  user_connections: ["(source_user_id, degree)", "(source_user_id, trust_score)"],
  shared_introducer_relationships: ["(user_a_id, user_b_id)"],
};

async function main() {
  const findings: AuditFinding[] = [];
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    findings.push({
      severity: "CRITICAL",
      category: "Database",
      title: "DATABASE_URL / DIRECT_URL not configured",
      recommendation: "Set connection strings before running audits.",
    });
    printReport("FriendIntro Database Audit", findings);
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const tables = (
    await client.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
    )
  ).rows.map((r) => r.table_name as string);

  for (const t of PRISMA_MODELS) {
    if (tables.includes(t)) {
      findings.push({ severity: "SAFE", category: "Schema", title: `Table exists: ${t}` });
    } else {
      findings.push({
        severity: "CRITICAL",
        category: "Schema",
        title: `Missing table: ${t}`,
        recommendation: "Run npx prisma migrate deploy",
      });
    }
  }

  const migrations = await client.query(
    `SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at`
  );
  if (migrations.rows.length === 0) {
    findings.push({
      severity: "CRITICAL",
      category: "Migrations",
      title: "No applied Prisma migrations",
      recommendation: "Run npx prisma migrate deploy",
    });
  } else {
    findings.push({
      severity: "SAFE",
      category: "Migrations",
      title: `${migrations.rows.length} migrations applied`,
      detail: migrations.rows.map((r) => r.migration_name).join(", "),
    });
  }

  const migrationFiles = fs
    .readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const applied = new Set(migrations.rows.map((r) => r.migration_name as string));
  for (const mf of migrationFiles) {
    if (!applied.has(mf)) {
      findings.push({
        severity: "WARNING",
        category: "Migrations",
        title: `Migration folder not applied: ${mf}`,
        recommendation: "Run npx prisma migrate deploy on all environments",
      });
    }
  }

  const indexes = await client.query(
    `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`
  );
  const byTable = new Map<string, typeof indexes.rows>();
  for (const row of indexes.rows) {
    const list = byTable.get(row.tablename) ?? [];
    list.push(row);
    byTable.set(row.tablename, list);
  }

  for (const [table, defs] of Object.entries(SCHEMA_INDEX_HINTS)) {
    const existing = (byTable.get(table) ?? []).map((r) => r.indexdef as string).join(" ");
    for (const hint of defs) {
      const cols = hint.replace(/[()]/g, "").split(",").map((c) => c.trim());
      const covered = cols.every((c) => existing.includes(c));
      if (covered) {
        findings.push({
          severity: "SAFE",
          category: "Indexes",
          title: `${table} index covers ${hint}`,
        });
      } else {
        findings.push({
          severity: "WARNING",
          category: "Indexes",
          title: `${table} may benefit from composite index on ${hint}`,
          detail: "Query paths (discoveries feed, unread messages, graph lookups) may degrade at scale.",
          recommendation: `Add migration: CREATE INDEX CONCURRENTLY IF NOT EXISTS ... ON ${table}${hint};`,
        });
      }
    }
  }

  const dupCheck = await client.query(`
    SELECT indexdef, COUNT(*) AS cnt, array_agg(indexname) AS names
    FROM pg_indexes WHERE schemaname = 'public'
    GROUP BY indexdef HAVING COUNT(*) > 1
  `);
  for (const row of dupCheck.rows) {
    findings.push({
      severity: "WARNING",
      category: "Indexes",
      title: "Duplicate index definitions",
      detail: `${row.names.join(", ")}`,
      recommendation: "Drop redundant indexes to reduce write amplification.",
    });
  }

  const rls = await client.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname = ANY($1::text[])
  `, [PRISMA_MODELS]);

  const rlsMap = new Map(rls.rows.map((r) => [r.table_name, r.rls_enabled]));
  const rlsExpected = [
    "users", "stories", "story_tags", "messages", "discoveries_posts",
    "user_connections", "shared_introducer_relationships", "conversation_contexts",
  ];
  for (const t of rlsExpected) {
    if (!rlsMap.get(t)) {
      findings.push({
        severity: "WARNING",
        category: "Security",
        title: `RLS not enabled on ${t}`,
        detail: "App uses Prisma server-side; RLS is defense-in-depth for direct Supabase access.",
        recommendation: "Extend prisma/policies.sql and run npm run db:rls",
      });
    }
  }

  const sizes = await client.query(`
    SELECT c.relname AS table_name,
           pg_total_relation_size(c.oid) AS total_bytes,
           s.n_live_tup AS row_estimate
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname = ANY($1::text[])
    ORDER BY pg_total_relation_size(c.oid) DESC
  `, [PRISMA_MODELS]);

  for (const row of sizes.rows) {
    const mb = Number(row.total_bytes) / (1024 * 1024);
    const rows = Number(row.row_estimate ?? 0);
    if (row.table_name === "user_connections" && rows > 500_000) {
      findings.push({
        severity: "WARNING",
        category: "Scale",
        title: "user_connections row count high",
        detail: `${rows.toLocaleString()} rows (~${mb.toFixed(1)} MB)`,
        recommendation: "Consider incremental graph updates only; avoid full rebuildUserConnections in request path.",
      });
    }
    if (row.table_name === "shared_introducer_relationships" && rows > 1_000_000) {
      findings.push({
        severity: "WARNING",
        category: "Scale",
        title: "shared_introducer_relationships growing large",
        detail: `${rows.toLocaleString()} rows (~${mb.toFixed(1)} MB)`,
      });
    }
    if (row.table_name === "messages" && rows > 1_000_000) {
      findings.push({
        severity: "INFO",
        category: "Scale",
        title: "messages table size",
        detail: `${rows.toLocaleString()} rows (~${mb.toFixed(1)} MB) — ensure pagination and archival strategy`,
      });
    }
  }

  const fkeys = await client.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  findings.push({
    severity: "SAFE",
    category: "Integrity",
    title: `${fkeys.rows.length} foreign keys defined`,
  });

  await client.end();

  const critical = printReport("FriendIntro Database Audit", findings);
  process.exit(critical > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
