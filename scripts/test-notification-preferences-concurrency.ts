/**
 * Concurrent NotificationPreferences creation stress test (100 parallel).
 *
 * Usage: npm run test:notification-prefs-concurrency
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { isPrismaUniqueViolation } from "@/lib/prisma-errors";

const PARALLEL = Number(
  process.argv.find((a) => a.startsWith("--parallel="))?.split("=")[1] ?? 100
);

const prisma = new PrismaClient();

async function getOrCreatePreferences(userId: string) {
  const existing = await prisma.notificationPreferences.findUnique({ where: { userId } });
  if (existing) return existing;

  try {
    return await prisma.notificationPreferences.create({ data: { userId } });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return prisma.notificationPreferences.findUniqueOrThrow({ where: { userId } });
    }
    throw error;
  }
}

async function main() {
  const user = await prisma.user.findFirst({ select: { id: true, email: true } });
  if (!user) throw new Error("No users in database — seed demo users first");

  await prisma.notificationPreferences.deleteMany({ where: { userId: user.id } });

  console.log(`Running ${PARALLEL} parallel getOrCreatePreferences for ${user.email}...`);

  const failures: string[] = [];
  const results = await Promise.allSettled(
    Array.from({ length: PARALLEL }, () => getOrCreatePreferences(user.id))
  );

  for (let i = 0; i < results.length; i += 1) {
    const r = results[i];
    if (r.status === "rejected") {
      failures.push(`#${i}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    }
  }

  const count = await prisma.notificationPreferences.count({ where: { userId: user.id } });
  if (count !== 1) {
    failures.push(`Expected 1 preference row, found ${count}`);
  }

  await prisma.notificationPreferences.deleteMany({ where: { userId: user.id } });
  const wave2 = await Promise.allSettled(
    Array.from({ length: PARALLEL }, () => getOrCreatePreferences(user.id))
  );
  for (let i = 0; i < wave2.length; i += 1) {
    const r = wave2[i];
    if (r.status === "rejected") {
      failures.push(
        `wave2 #${i}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`
      );
    }
  }
  const count2 = await prisma.notificationPreferences.count({ where: { userId: user.id } });
  if (count2 !== 1) {
    failures.push(`Wave2: expected 1 preference row, found ${count2}`);
  }

  const report = {
    parallel: PARALLEL,
    failures: failures.length,
    failureMessages: failures,
    pass: failures.length === 0,
    testedAt: new Date().toISOString(),
  };

  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "docs/.notification-prefs-concurrency.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
