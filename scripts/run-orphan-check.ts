/**
 * Run orphan checks against live PostgreSQL and print counts.
 * Usage: npx tsx scripts/run-orphan-check.ts
 */
import fs from "fs";
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

const checks: Array<{ name: string; sql: string }> = [
  {
    name: "messages.discoveries_post_reference -> discoveries_posts",
    sql: `SELECT COUNT(*)::int AS count FROM messages m
      WHERE m.discoveries_post_reference IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = m.discoveries_post_reference)`,
  },
  {
    name: "conversation_contexts.user_a_id -> users",
    sql: `SELECT COUNT(*)::int AS count FROM conversation_contexts c
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_a_id)`,
  },
  {
    name: "conversation_contexts.user_b_id -> users",
    sql: `SELECT COUNT(*)::int AS count FROM conversation_contexts c
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_b_id)`,
  },
  {
    name: "conversation_contexts.story_reference -> stories",
    sql: `SELECT COUNT(*)::int AS count FROM conversation_contexts c
      WHERE c.story_reference IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.id = c.story_reference)`,
  },
  {
    name: "conversation_contexts.discoveries_post_reference -> discoveries_posts",
    sql: `SELECT COUNT(*)::int AS count FROM conversation_contexts c
      WHERE c.discoveries_post_reference IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = c.discoveries_post_reference)`,
  },
  {
    name: "discoveries_posts.user_id -> users",
    sql: `SELECT COUNT(*)::int AS count FROM discoveries_posts dp
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dp.user_id)`,
  },
  {
    name: "discoveries_likes.post_id -> discoveries_posts",
    sql: `SELECT COUNT(*)::int AS count FROM discoveries_likes dl
      WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dl.post_id)`,
  },
  {
    name: "discoveries_likes.user_id -> users",
    sql: `SELECT COUNT(*)::int AS count FROM discoveries_likes dl
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dl.user_id)`,
  },
  {
    name: "discoveries_comments.post_id -> discoveries_posts",
    sql: `SELECT COUNT(*)::int AS count FROM discoveries_comments dc
      WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dc.post_id)`,
  },
  {
    name: "discoveries_comments.user_id -> users",
    sql: `SELECT COUNT(*)::int AS count FROM discoveries_comments dc
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dc.user_id)`,
  },
  {
    name: "discoveries_bookmarks.post_id -> discoveries_posts",
    sql: `SELECT COUNT(*)::int AS count FROM discoveries_bookmarks db
      WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = db.post_id)`,
  },
  {
    name: "discoveries_bookmarks.user_id -> users",
    sql: `SELECT COUNT(*)::int AS count FROM discoveries_bookmarks db
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = db.user_id)`,
  },
  {
    name: "discoveries_shares.post_id -> discoveries_posts",
    sql: `SELECT COUNT(*)::int AS count FROM discoveries_shares ds
      WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = ds.post_id)`,
  },
  {
    name: "discoveries_shares.user_id -> users",
    sql: `SELECT COUNT(*)::int AS count FROM discoveries_shares ds
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ds.user_id)`,
  },
  {
    name: "user_consents.user_id -> users",
    sql: `SELECT COUNT(*)::int AS count FROM user_consents uc
      WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uc.user_id)`,
  },
];

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const results: Array<{ name: string; count: number }> = [];
  for (const check of checks) {
    const res = await client.query(check.sql);
    results.push({ name: check.name, count: res.rows[0].count });
  }

  await client.end();

  console.log(JSON.stringify(results, null, 2));
  const total = results.reduce((s, r) => s + r.count, 0);
  console.log(`\nTotal orphan rows: ${total}`);
  process.exit(total > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
