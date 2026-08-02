import fs from "fs";
import { spawnSync } from "child_process";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
process.env.DIRECT_URL = process.env.DATABASE_URL;

for (const args of [
  ["prisma", "migrate", "deploy"],
  ["prisma", "migrate", "status"],
  [
    "prisma",
    "migrate",
    "diff",
    "--from-url",
    process.env.DATABASE_URL,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
]) {
  console.log("\n>", "npx", args.join(" "));
  const r = spawnSync("npx", args, {
    encoding: "utf8",
    shell: true,
    env: process.env,
    maxBuffer: 5 * 1024 * 1024,
  });
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  if (args[1] === "diff") {
    const sql = (r.stdout || "").trim();
    console.log(sql.length === 0 ? "DIFF EMPTY — schema matches" : `DIFF REMAINING:\n${sql}`);
    fs.writeFileSync(
      "docs/performance/production-fix/artifacts/final-migrate-diff.sql",
      r.stdout || ""
    );
  } else if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}
