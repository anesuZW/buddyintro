import fs from "fs";
import { spawnSync } from "child_process";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

process.env.DIRECT_URL = process.env.DATABASE_URL;

async function schemaChecks() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const preferred = await client.query(
    `SELECT column_name, data_type, column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' AND column_name='preferred_language'`
  );
  const media = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='media_objects'`
  );
  const idx = await client.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN (
      'users_preferred_language_idx','messages_receiver_id_read_at_idx',
      'push_subscriptions_user_id_enabled_idx','media_objects_content_hash_key'
    ) ORDER BY indexname`
  );
  const pushCols = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='push_subscriptions'
     ORDER BY ordinal_position`
  );
  const migrations = await client.query(
    `SELECT migration_name, finished_at IS NOT NULL AS finished
     FROM "_prisma_migrations" ORDER BY migration_name`
  );
  await client.end();
  return {
    preferredLanguage: preferred.rows[0] ?? null,
    mediaObjects: (media.rowCount ?? 0) > 0,
    indexes: idx.rows.map((r) => r.indexname),
    pushColumns: pushCols.rows.map((r) => r.column_name),
    migrations: migrations.rows,
  };
}

function migrateDiff() {
  const r = spawnSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-url",
      process.env.DATABASE_URL!,
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    { encoding: "utf8", shell: true, env: process.env, maxBuffer: 5 * 1024 * 1024 }
  );
  const sql = (r.stdout || "").trim();
  return { status: r.status, empty: sql.length === 0, sql, stderr: r.stderr };
}

async function cookie() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const auth = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.signInWithPassword({
    email: "user1@friendintro.com",
    password: "123456",
  });
  if (error || !data.session) throw new Error(error?.message ?? "login failed");
  const jar: Record<string, string> = {};
  const sb = createServerClient(url, key, {
    cookies: {
      get: (n) => jar[n],
      set: (n, v) => {
        jar[n] = v;
      },
      remove: (n) => {
        delete jar[n];
      },
    },
  });
  await sb.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function hitPages(base: string, cookieHeader: string) {
  const pages = ["/home", "/discoveries", "/messages", "/profile"];
  const out = [];
  for (const page of pages) {
    const t0 = performance.now();
    const res = await fetch(`${base}${page}`, {
      headers: { Cookie: cookieHeader },
      redirect: "manual",
    });
    const text = await res.text();
    const totalMs = Math.round(performance.now() - t0);
    const p2022 =
      text.includes("preferred_language") ||
      text.includes("P2022") ||
      text.includes("does not exist in the current database");
    out.push({
      page,
      status: res.status,
      totalMs,
      bodyBytes: text.length,
      schemaErrorSuspect: p2022,
    });
    console.log(`${page} ${res.status} ${totalMs}ms schemaError=${p2022}`);
  }
  return out;
}

async function main() {
  const bases = [
    "http://127.0.0.1:3020",
    "http://127.0.0.1:3012",
    "http://127.0.0.1:3010",
    "http://127.0.0.1:3000",
  ];
  let base: string | null = null;
  for (const b of bases) {
    try {
      const r = await fetch(`${b}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (r.ok || r.status === 200) {
        base = b;
        break;
      }
    } catch {
      /* try next */
    }
  }

  const schema = await schemaChecks();
  const diff = migrateDiff();
  let pages: unknown = null;
  let pageError: string | null = null;
  if (base) {
    try {
      const c = await cookie();
      pages = await hitPages(base, c);
    } catch (e) {
      pageError = e instanceof Error ? e.message : String(e);
    }
  } else {
    pageError = "No local server responding on 3012/3010/3000";
  }

  const out = {
    capturedAt: new Date().toISOString(),
    schema,
    migrateDiffEmpty: diff.empty,
    migrateDiffPreview: diff.sql.slice(0, 500),
    base,
    pages,
    pageError,
  };
  fs.mkdirSync("docs/performance/production-fix/artifacts", { recursive: true });
  fs.writeFileSync(
    "docs/performance/production-fix/artifacts/post-verify.json",
    JSON.stringify(out, null, 2)
  );
  console.log(JSON.stringify(out, null, 2));
  const pagesOk =
    Array.isArray(pages) &&
    pages.every(
      (p: { status: number; schemaErrorSuspect: boolean }) =>
        p.status === 200 && !p.schemaErrorSuspect
    );
  if (!diff.empty || !schema.preferredLanguage || !schema.mediaObjects || !pagesOk) {
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
