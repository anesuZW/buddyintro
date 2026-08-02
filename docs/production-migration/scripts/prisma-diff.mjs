#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "docs/production-migration/artifacts");

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

loadEnv();
fs.mkdirSync(OUT, { recursive: true });
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const r = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-url",
    url,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  { encoding: "utf8", cwd: ROOT, shell: true, timeout: 180000 }
);

fs.writeFileSync(path.join(OUT, "prisma-migrate-diff.sql"), r.stdout || "");
fs.writeFileSync(path.join(OUT, "prisma-migrate-diff.err.txt"), r.stderr || "");
console.log("status", r.status);
console.log("stdout_len", (r.stdout || "").length);
console.log("stdout:\n", (r.stdout || "").slice(0, 4000));
console.log("stderr:\n", (r.stderr || "").slice(0, 2000));
