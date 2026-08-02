#!/usr/bin/env node
import fs from "fs";
import { performance } from "perf_hooks";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const OUT = "docs/performance/db-forensics/artifacts";
fs.mkdirSync(OUT, { recursive: true });

function stats(samples) {
  const a = [...samples].sort((x, y) => x - y);
  const pct = (p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
  const sum = a.reduce((s, n) => s + n, 0);
  return {
    n: a.length,
    min: +a[0].toFixed(3),
    median: +pct(50).toFixed(3),
    p95: +pct(95).toFixed(3),
    p99: +pct(99).toFixed(3),
    max: +a[a.length - 1].toFixed(3),
    mean: +(sum / a.length).toFixed(3),
    samples: a.map((n) => +n.toFixed(3)),
  };
}

const { PrismaClient } = await import("@prisma/client");
const pg = await import("pg");
const { Client } = pg.default || pg;
const url = process.env.DATABASE_URL;

// Match test-db.js style: 20 serial Prisma SELECT NOW() on ONE client
const prisma = new PrismaClient();
const serialSame = [];
for (let i = 0; i < 20; i++) {
  const t0 = performance.now();
  await prisma.$queryRaw`SELECT NOW()`;
  serialSame.push(performance.now() - t0);
}
await prisma.$disconnect();

// 20 serial NEW PrismaClient each time
const serialNew = [];
for (let i = 0; i < 20; i++) {
  const t0 = performance.now();
  const p = new PrismaClient();
  await p.$queryRaw`SELECT NOW()`;
  await p.$disconnect();
  serialNew.push(performance.now() - t0);
}

// Cold-ish: process already warm, but first of a fresh client after GC pause
const coldish = [];
for (let i = 0; i < 5; i++) {
  const p = new PrismaClient();
  const t0 = performance.now();
  await p.$queryRaw`SELECT NOW()`;
  coldish.push(performance.now() - t0);
  await p.$disconnect();
}

// Parallel 10
const wall0 = performance.now();
const parallelSamples = await Promise.all(
  Array.from({ length: 10 }, async () => {
    const p = new PrismaClient();
    const t0 = performance.now();
    await p.$queryRaw`SELECT NOW()`;
    const ms = performance.now() - t0;
    await p.$disconnect();
    return ms;
  })
);
const parallelWall = performance.now() - wall0;

// pg reuse 20
const client = new Client({ connectionString: url, connectionTimeoutMillis: 30000 });
const connectT0 = performance.now();
await client.connect();
const connectMs = performance.now() - connectT0;
const pgWarm = [];
for (let i = 0; i < 20; i++) {
  const t0 = performance.now();
  await client.query("SELECT NOW()");
  pgWarm.push(performance.now() - t0);
}
await client.end();

const out = {
  at: new Date().toISOString(),
  prisma_serial_same_client_20: stats(serialSame),
  prisma_serial_new_client_20: stats(serialNew),
  prisma_fresh_client_first_query_5: stats(coldish),
  prisma_parallel_10: {
    wallMs: +parallelWall.toFixed(3),
    perClient: stats(parallelSamples),
  },
  pg_connect_ms: +connectMs.toFixed(3),
  pg_serial_reuse_20: stats(pgWarm),
};

fs.writeFileSync(`${OUT}/repeatability.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
