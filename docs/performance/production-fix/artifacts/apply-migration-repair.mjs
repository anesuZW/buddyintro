/**
 * Production stabilization: repair Prisma history + deploy missing migrations.
 * - resolve --applied ONLY for 0001–0007 (schema already present)
 * - migrate deploy for 0008–0011
 * Uses DATABASE_URL as DIRECT_URL when direct host is unreachable (pooler :5432).
 */
import fs from "fs";
import { spawnSync } from "child_process";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

// Prisma migrate uses directUrl; production DIRECT_URL host may not resolve from this machine.
process.env.DIRECT_URL = process.env.DATABASE_URL;
console.log("Using DIRECT_URL=DATABASE_URL (pooler) for migrate operations");

const log = [];
function run(cmd, args) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    encoding: "utf8",
    env: process.env,
    shell: true,
    maxBuffer: 10 * 1024 * 1024,
  });
  const entry = {
    cmd: `${cmd} ${args.join(" ")}`,
    status: r.status,
    stdout: r.stdout,
    stderr: r.stderr,
  };
  log.push(entry);
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    fs.mkdirSync("docs/performance/production-fix/artifacts", { recursive: true });
    fs.writeFileSync(
      "docs/performance/production-fix/artifacts/apply-migration-repair.log.json",
      JSON.stringify({ failed: true, log }, null, 2)
    );
    process.exit(r.status ?? 1);
  }
  return entry;
}

const toResolve = [
  "0001_baseline",
  "0002_discoveries",
  "0003_trust_graph",
  "0004_notifications",
  "0005_moderation",
  "0006_platform",
  "0007_security_rbac",
];

for (const id of toResolve) {
  run("npx", ["prisma", "migrate", "resolve", "--applied", id]);
}

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["prisma", "migrate", "status"]);

fs.mkdirSync("docs/performance/production-fix/artifacts", { recursive: true });
fs.writeFileSync(
  "docs/performance/production-fix/artifacts/apply-migration-repair.log.json",
  JSON.stringify({ failed: false, completedAt: new Date().toISOString(), log }, null, 2)
);
console.log("\nMigration repair completed successfully.");
