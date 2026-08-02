import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

const out = path.resolve("docs/performance/production-readiness/artifacts/prisma-migrate-diff.sql");
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
  { encoding: "utf8", env: process.env, shell: true, maxBuffer: 20 * 1024 * 1024 }
);

fs.writeFileSync(out, r.stdout || "");
fs.writeFileSync(
  out.replace(".sql", ".meta.json"),
  JSON.stringify(
    {
      status: r.status,
      stderr: r.stderr,
      stdoutBytes: (r.stdout || "").length,
      lineCount: (r.stdout || "").split(/\r?\n/).length,
    },
    null,
    2
  )
);
console.log("status", r.status);
console.log("stderr", r.stderr?.slice(0, 500));
console.log("sql lines", (r.stdout || "").split(/\r?\n/).length);
console.log("wrote", out);
console.log("--- first 80 lines ---");
console.log((r.stdout || "").split(/\r?\n/).slice(0, 80).join("\n"));
