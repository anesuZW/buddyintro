/**
 * Export all Prisma-managed tables to a timestamped backup directory.
 *
 * Usage:
 *   npm run backup:database
 *
 * Requires DATABASE_URL or DIRECT_URL in .env / .env.local
 */
import { execSync, spawnSync } from "child_process";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import pg from "pg";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      // ignore missing file
    }
  }
}

loadEnv();

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL or DIRECT_URL is required");
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = resolve(process.cwd(), "backups", timestamp);
mkdirSync(backupDir, { recursive: true });

function tryPgDump(): boolean {
  const dumpPath = resolve(backupDir, "buddyintro.dump");
  const result = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--file", dumpPath, dbUrl!], {
    stdio: "inherit",
    shell: true,
  });
  return result.status === 0;
}

async function exportViaPg(): Promise<string[]> {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  const tables = await client.query<{ tablename: string }>(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  const exported: string[] = [];
  for (const row of tables.rows) {
    const table = row.tablename;
    const filePath = resolve(backupDir, `${table}.jsonl`);
    const stream = createWriteStream(filePath);
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const res = await client.query(`SELECT * FROM "${table}" ORDER BY 1 LIMIT $1 OFFSET $2`, [
        batchSize,
        offset,
      ]);
      if (!res.rows.length) break;
      for (const record of res.rows) {
        stream.write(`${JSON.stringify(record)}\n`);
      }
      offset += res.rows.length;
      if (res.rows.length < batchSize) break;
    }

    stream.end();
    exported.push(table);
  }

  await client.end();
  return exported;
}

async function main() {
  console.log(`Backing up to ${backupDir}`);

  let method: "pg_dump" | "jsonl" = "jsonl";
  let tables: string[] = [];

  if (tryPgDump()) {
    method = "pg_dump";
    console.log("pg_dump completed");
  } else {
    console.warn("pg_dump unavailable — falling back to JSONL table export");
    tables = await exportViaPg();
    console.log(`Exported ${tables.length} tables`);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    method,
    tables,
    databaseHost: (() => {
      try {
        return new URL(dbUrl!.replace(/^postgres:/, "http:")).hostname;
      } catch {
        return "unknown";
      }
    })(),
    restoreInstructions: [
      "pg_dump restore: pg_restore --no-owner --no-acl -d \"$DATABASE_URL\" backups/<timestamp>/buddyintro.dump",
      "JSONL restore: use npm run backup:verify then manual import per table",
      "After restore: npm run prisma:deploy && npm run db:rls && npm run verify-database",
    ],
  };

  writeFileSync(resolve(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  const readme = `# Backup ${timestamp}

Method: ${method}
Created: ${manifest.createdAt}

## Restore (pg_dump)

\`\`\`bash
pg_restore --no-owner --no-acl -d "$DATABASE_URL" "${backupDir}/buddyintro.dump"
npm run db:rls
npm run verify-database
\`\`\`

## Verify

\`\`\`bash
npm run backup:verify -- --dir=${backupDir}
\`\`\`
`;
  writeFileSync(resolve(backupDir, "RESTORE.md"), readme);

  console.log(`Backup complete: ${backupDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
