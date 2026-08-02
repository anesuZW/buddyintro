#!/usr/bin/env node
/** Reproduce root test-db.js timing (5 runs, new PrismaClient each). */
import fs from "fs";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const { PrismaClient } = await import("@prisma/client");
const samples = [];
for (let i = 0; i < 5; i++) {
  const prisma = new PrismaClient();
  console.time(`Run ${i + 1}`);
  const t0 = performance.now();
  const result = await prisma.$queryRaw`SELECT NOW()`;
  const ms = performance.now() - t0;
  console.timeEnd(`Run ${i + 1}`);
  samples.push(+ms.toFixed(3));
  console.log(result);
  await prisma.$disconnect();
}
const sorted = [...samples].sort((a, b) => a - b);
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
const out = {
  at: new Date().toISOString(),
  samples,
  mean: +mean.toFixed(3),
  median: sorted[Math.floor(samples.length / 2)],
  min: sorted[0],
  max: sorted[sorted.length - 1],
};
fs.writeFileSync(
  "docs/performance/db-forensics/artifacts/test-db-equivalent.json",
  JSON.stringify(out, null, 2)
);
console.log(JSON.stringify(out, null, 2));
