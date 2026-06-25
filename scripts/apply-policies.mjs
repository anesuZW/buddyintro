// One-shot runner for prisma/policies.sql.
// Reads DIRECT_URL (session-pooler) or DATABASE_URL from env and executes
// the policies file as a single multi-statement query.
//
// Usage:
//   node --env-file=.env scripts/apply-policies.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, "..", "prisma", "policies.sql");
const sql = readFileSync(sqlPath, "utf8");

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DIRECT_URL or DATABASE_URL must be set.");
  process.exit(1);
}

// Force IPv4 first (some hosts only have IPv6 routable).
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  console.log("Connecting…");
  await client.connect();
  console.log("Applying", path.relative(process.cwd(), sqlPath), "…");
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("✔ policies.sql applied successfully.");
} catch (err) {
  try {
    await client.query("rollback");
  } catch {}
  console.error("✗ Failed:", err.message);
  if (err.position) console.error("  near position:", err.position);
  if (err.detail) console.error("  detail:", err.detail);
  process.exitCode = 1;
} finally {
  await client.end();
}
