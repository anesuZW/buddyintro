/**
 * Database latency health check — measures infra vs query cost.
 * Usage: npx tsx scripts/check-db-latency.ts
 */
import fs from "fs";
import { PrismaClient } from "@prisma/client";

const RUNS = 10;

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

function redactUrl(url: string | undefined): string {
  if (!url) return "(unset)";
  try {
    const parsed = new URL(url.replace(/^postgresql:/, "http:"));
    const user = parsed.username ? `${parsed.username.split(".")[0]}.***` : "***";
    return `postgresql://${user}:***@${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return "(invalid url)";
  }
}

function auditUrl(url: string | undefined, label: string) {
  if (!url) {
    console.log(`  ${label}: (unset)`);
    return;
  }
  const port = url.match(/:(\d+)\//)?.[1] ?? "?";
  const params = new URL(url.replace(/^postgresql:/, "http:")).searchParams;
  console.log(`  ${label}: ${redactUrl(url)}`);
  console.log(`    port: ${port}`);
  if (label.includes("DATABASE")) {
    console.log(`    pgbouncer: ${params.get("pgbouncer") ?? "(missing)"}`);
    console.log(`    connection_limit: ${params.get("connection_limit") ?? "(missing)"}`);
    console.log(`    prepared_statements: ${params.get("prepared_statements") ?? "(default)"}`);
  }
}

function stats(label: string, samplesMs: number[]) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
  const p95Index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  const p95 = sorted[p95Index];

  console.log(`\n${label}`);
  console.log(`  runs: ${RUNS}`);
  console.log(`  min:  ${min} ms`);
  console.log(`  avg:  ${avg} ms`);
  console.log(`  p95:  ${p95} ms`);
  console.log(`  max:  ${max} ms`);
  console.log(`  all:  ${sorted.join(", ")} ms`);

  return { min, avg, p95, max };
}

async function timed(fn: () => Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return Math.round(performance.now() - t0);
}

async function main() {
  loadEnv();

  console.log("=== DATABASE URL CONFIGURATION (redacted) ===\n");
  auditUrl(process.env.DATABASE_URL, "DATABASE_URL");
  auditUrl(process.env.DIRECT_URL, "DIRECT_URL");
  console.log("\nPrisma schema: url=DATABASE_URL (runtime), directUrl=DIRECT_URL (migrations)");

  const prisma = new PrismaClient({ log: ["error"] });

  try {
    console.log("\n=== LATENCY BENCHMARK (each query × 10) ===");

    const select1: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      select1.push(await timed(() => prisma.$queryRaw`SELECT 1`));
    }
    const s1 = stats("SELECT 1", select1);

    const adminSettings: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      adminSettings.push(
        await timed(() => prisma.adminSettings.findUnique({ where: { id: 1 } }))
      );
    }
    const admin = stats("adminSettings.findUnique({ id: 1 })", adminSettings);

    const storyCount: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      storyCount.push(await timed(() => prisma.story.count()));
    }
    const stories = stats("story.count()", storyCount);

    console.log("\n=== INTERPRETATION ===");
    const infraBaseline = s1.p95;
    const adminOverhead = admin.p95 - infraBaseline;

    if (infraBaseline > 500) {
      console.log(
        `  Infrastructure: SLOW — SELECT 1 p95=${infraBaseline}ms suggests pooler/connect latency (target <100ms).`
      );
    } else {
      console.log(
        `  Infrastructure: OK — SELECT 1 p95=${infraBaseline}ms (target <100ms).`
      );
    }

    if (adminOverhead > 200 && admin.p95 > s1.avg * 2) {
      console.log(
        `  adminSettings: high variance (p95=${admin.p95}ms vs SELECT 1 avg=${s1.avg}ms) — likely pooler queueing, not query cost.`
      );
    } else if (adminOverhead > 200) {
      console.log(
        `  adminSettings: ~${adminOverhead}ms above baseline p95 — investigate query or cache.`
      );
    } else {
      console.log(`  adminSettings: ~${adminOverhead}ms above baseline p95 — mostly infra.`);
    }

    const storyDelta = stories.avg - s1.avg;
    if (s1.avg < 500 && storyDelta > 200) {
      console.log(
        `  story.count: application/query cost ~${storyDelta}ms above SELECT 1 avg (table size / missing index).`
      );
    } else {
      console.log(
        `  story.count: ~${storyDelta}ms above SELECT 1 avg — mostly infra (not application logic).`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
