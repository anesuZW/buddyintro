/**
 * Benchmark UserConnection hot-path queries (before/after optimization).
 *
 * Usage: npm run benchmark:user-connections
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TARGET_MS = 500;
const NETWORK_IDS_CAP = 2500;
const PER_DEGREE_CAP = 500;
const TRUST_BATCH = 500;

type BenchRow = {
  label: string;
  route: string;
  purpose: string;
  rowCount: number;
  ms: number;
  pass: boolean;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = performance.now();
  const value = await fn();
  return { ms: Math.round(performance.now() - start), value };
}

async function main() {
  const user = await prisma.user.findFirst({
    where: { connectionsFrom: { some: {} } },
    select: { id: true, email: true },
  });
  if (!user) throw new Error("No user with connections — run seed or rebuild-connections");

  const totalConnections = await prisma.userConnection.count();
  const rows: BenchRow[] = [];

  const network = await timed(() =>
    prisma.userConnection.findMany({
      where: { sourceUserId: user.id, degree: { lte: 2, gte: 1 } },
      select: { targetUserId: true },
      take: NETWORK_IDS_CAP,
    })
  );
  rows.push({
    label: "getNetworkUserIdsFromConnections",
    route: "GET /discoveries (SSR)",
    purpose: "Network author IDs for feed IN clause",
    rowCount: network.value.length,
    ms: network.ms,
    pass: network.ms <= TARGET_MS,
  });

  const degree1 = await timed(() =>
    prisma.userConnection.findMany({
      where: { sourceUserId: user.id, degree: 1 },
      select: { targetUserId: true },
      take: PER_DEGREE_CAP,
    })
  );
  rows.push({
    label: "connectionsAtDegree (degree=1)",
    route: "GET /introductions/network",
    purpose: "Degree-1 connection listing",
    rowCount: degree1.value.length,
    ms: degree1.ms,
    pass: degree1.ms <= TARGET_MS,
  });

  const trustBulkTargets = await prisma.userConnection.findMany({
    where: { sourceUserId: user.id },
    select: { targetUserId: true },
    take: 20,
  });
  const trustBulk = await timed(() =>
    prisma.userConnection.findMany({
      where: {
        sourceUserId: user.id,
        targetUserId: { in: trustBulkTargets.map((r) => r.targetUserId) },
      },
      select: {
        targetUserId: true,
        sharedIntroducerCount: true,
        trustScore: true,
        degree: true,
      },
    })
  );
  rows.push({
    label: "getTrustProfilesBulk subset",
    route: "GET /discoveries trust context",
    purpose: "Bulk trust scores for visible authors",
    rowCount: trustBulk.value.length,
    ms: trustBulk.ms,
    pass: trustBulk.ms <= TARGET_MS,
  });

  const refresh = await timed(async () => {
    let updated = 0;
    let cursor: string | undefined;
    while (true) {
      const batch = await prisma.userConnection.findMany({
        where: { sourceUserId: user.id },
        take: TRUST_BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
        select: { id: true, trustScore: true },
      });
      if (!batch.length) break;
      updated += batch.length;
      cursor = batch[batch.length - 1].id;
      if (batch.length < TRUST_BATCH) break;
    }
    return updated;
  });
  rows.push({
    label: "refreshConnectionTrustScores scan (1 user, batched)",
    route: "POST /api/stories (background job)",
    purpose: "Trust score refresh after story publish",
    rowCount: refresh.value,
    ms: refresh.ms,
    pass: refresh.ms <= TARGET_MS,
  });

  const recommendations = await timed(() =>
    prisma.userConnection.findMany({
      where: { sourceUserId: user.id, degree: { lte: 2 } },
      orderBy: [{ sharedIntroducerCount: "desc" }, { trustScore: "desc" }],
      take: 12,
      select: { targetUserId: true, trustScore: true },
    })
  );
  rows.push({
    label: "trust-recommendations",
    route: "GET /api/trust/recommendations",
    purpose: "Top trust-ranked connections",
    rowCount: recommendations.value.length,
    ms: recommendations.ms,
    pass: recommendations.ms <= TARGET_MS,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    user: user.email,
    totalConnections,
    targetMs: TARGET_MS,
    allPass: rows.every((r) => r.pass),
    queries: rows,
  };

  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  writeFileSync(
    resolve(process.cwd(), "docs/.user-connection-benchmark.json"),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
  if (!report.allPass) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
