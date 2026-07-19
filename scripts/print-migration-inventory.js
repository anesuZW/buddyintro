const fs = require("fs");
const path = require("path");

const ids = [
  "0001_baseline",
  "0002_discoveries",
  "0003_trust_graph",
  "0004_notifications",
  "0005_moderation",
  "0006_platform",
  "0007_security_rbac",
  "0008_media_platform",
];

for (const id of ids) {
  const sql = fs.readFileSync(path.join("prisma/migrations", id, "migration.sql"), "utf8");
  const enums = [...sql.matchAll(/CREATE TYPE "([^"]+)" AS ENUM/g)].map((m) => m[1]);
  const tables = [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]);
  const indexes = [...sql.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)"/g)].map((m) => m[1]);
  const fkeys = [...sql.matchAll(/ADD CONSTRAINT "([^"]+)" FOREIGN KEY/g)].map((m) => m[1]);
  const columns = [];
  for (const m of sql.matchAll(/CREATE TABLE "([^"]+)" \(([\s\S]*?)\n\);/g)) {
    for (const col of m[2].matchAll(/^\s*"([^"]+)"/gm)) {
      if (col[1] !== "CONSTRAINT") columns.push(`${m[1]}.${col[1]}`);
    }
  }
  console.log(`\n=== ${id} ===`);
  console.log("Enums:", enums.join(", ") || "(none)");
  console.log("Tables:", tables.join(", "));
  console.log("Columns:", columns.length);
  columns.forEach((c) => console.log("  -", c));
  console.log("Indexes:", indexes.join(", "));
  console.log("Foreign keys:", fkeys.join(", "));
}
