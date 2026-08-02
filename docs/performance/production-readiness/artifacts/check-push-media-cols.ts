import fs from "fs";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const push = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='push_subscriptions'
    ORDER BY ordinal_position`);
  const mediaEnum = await client.query(`
    SELECT t.typname FROM pg_type t
    JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='MediaProcessingStatus'`);
  const idxs = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename IN ('push_subscriptions','messages','media_objects','users')
    ORDER BY tablename, indexname`);
  const out = {
    pushColumns: push.rows.map((r) => r.column_name),
    mediaProcessingEnum: mediaEnum.rows.length > 0,
    relatedIndexes: idxs.rows.map((r) => r.indexname),
  };
  fs.writeFileSync(
    "docs/performance/production-readiness/artifacts/push-media-cols.json",
    JSON.stringify(out, null, 2)
  );
  console.log(JSON.stringify(out, null, 2));
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
