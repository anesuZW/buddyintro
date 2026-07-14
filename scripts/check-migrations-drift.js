#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
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
  }
}

function stripComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("--"))
    .join("\n")
    .trim();
}

loadEnv();
const shadow =
  process.env.SHADOW_DATABASE_URL || process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!shadow) {
  console.error("No shadow database URL");
  process.exit(1);
}

const out = path.join(ROOT, "prisma", "_migrations_drift.sql");
const result = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-migrations",
    "prisma/migrations",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--shadow-database-url",
    shadow,
    "--script",
    "-o",
    out,
  ],
  { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32" }
);

if (result.status !== 0) {
  console.error("migrate diff failed");
  process.stderr.write(result.stderr || result.stdout || "");
  process.exit(1);
}

const drift = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
const sql = stripComments(drift);
if (sql.length > 0) {
  console.error("Drift between migrations and schema.prisma:");
  console.error(sql.slice(0, 1000));
  process.exit(1);
}

if (fs.existsSync(out)) fs.unlinkSync(out);
console.log("PASS: migrations match schema.prisma (zero drift)");
