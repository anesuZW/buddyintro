/**
 * Preflight: confirm which baseline migrations are safe to resolve --applied.
 */
import fs from "fs";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function exists(client: pg.Client, sql: string) {
  const r = await client.query(sql);
  return (r.rowCount ?? 0) > 0;
}

async function main() {
  const url = process.env.DATABASE_URL!;
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });
  await client.connect();

  const checks: Record<string, boolean> = {
    users: await exists(
      client,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'`
    ),
    discoveries_posts: await exists(
      client,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='discoveries_posts'`
    ),
    user_connections: await exists(
      client,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_connections'`
    ),
    notifications: await exists(
      client,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications'`
    ),
    user_blocks: await exists(
      client,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_blocks'`
    ),
    background_jobs: await exists(
      client,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='background_jobs'`
    ),
    roles: await exists(
      client,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='roles'`
    ),
    media_objects: await exists(
      client,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='media_objects'`
    ),
    preferred_language: await exists(
      client,
      `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='preferred_language'`
    ),
    prisma_migrations: await exists(
      client,
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='_prisma_migrations'`
    ),
  };

  const safeToResolve = [
    "0001_baseline",
    "0002_discoveries",
    "0003_trust_graph",
    "0004_notifications",
    "0005_moderation",
    "0006_platform",
    "0007_security_rbac",
  ];
  const mustDeploy = ["0008_media_platform", "0009_i18n", "0010_pwa_push", "0011_message_unread_index"];

  const out = {
    capturedAt: new Date().toISOString(),
    checks,
    resolveAppliedSafe: safeToResolve.every((id) => {
      if (id === "0001_baseline") return checks.users;
      if (id === "0002_discoveries") return checks.discoveries_posts;
      if (id === "0003_trust_graph") return checks.user_connections;
      if (id === "0004_notifications") return checks.notifications;
      if (id === "0005_moderation") return checks.user_blocks;
      if (id === "0006_platform") return checks.background_jobs;
      if (id === "0007_security_rbac") return checks.roles;
      return false;
    }),
    doNotResolveApplied: {
      "0008_media_platform": !checks.media_objects,
      "0009_i18n": !checks.preferred_language,
    },
    mustDeploy,
  };

  fs.mkdirSync("docs/performance/production-fix/artifacts", { recursive: true });
  fs.writeFileSync(
    "docs/performance/production-fix/artifacts/preflight-markers.json",
    JSON.stringify(out, null, 2)
  );
  console.log(JSON.stringify(out, null, 2));
  await client.end();
  if (!out.resolveAppliedSafe) {
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
