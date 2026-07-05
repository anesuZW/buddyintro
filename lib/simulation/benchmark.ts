import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/simulation/env";
import { SIM_EMAIL_DOMAIN } from "@/lib/simulation/constants";

export type RouteBenchmark = {
  route: string;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
};

export type ScaleBenchmark = {
  userCount: number;
  sampledUsers: number;
  routes: RouteBenchmark[];
  totalMs: number;
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function benchmarkHome(db: PrismaClient, userId: string): Promise<number> {
  const start = performance.now();
  const myTags = await db.storyTag.findMany({
    where: { story: { userId }, taggedUserId: { not: null } },
    select: { taggedUserId: true },
  });
  const myTaggedUserIds = [...new Set(myTags.map((t) => t.taggedUserId!).filter(Boolean))];
  await Promise.all([
    db.storyTag.count({ where: { story: { userId, status: "published" } } }),
    db.storyTag.count({ where: { taggedUserId: userId, story: { status: "published" } } }),
    myTaggedUserIds.length
      ? db.story.findMany({
          where: {
            userId: { not: userId },
            status: "published",
            tags: { some: { taggedUserId: { in: myTaggedUserIds } } },
          },
          take: 15,
        })
      : Promise.resolve([]),
    db.userConnection.findMany({
      where: { sourceUserId: userId, degree: { lte: 2 } },
      orderBy: { trustScore: "desc" },
      take: 12,
    }),
  ]);
  return Math.round(performance.now() - start);
}

async function benchmarkDiscoveries(db: PrismaClient, userId: string): Promise<number> {
  const start = performance.now();
  const network = await db.userConnection.findMany({
    where: { sourceUserId: userId, degree: { lte: 2 } },
    select: { targetUserId: true },
    take: 250,
  });
  const authorIds = [...new Set(network.map((n) => n.targetUserId))];
  if (authorIds.length) {
    await db.discoveriesPost.findMany({
      where: { userId: { in: authorIds } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  }
  return Math.round(performance.now() - start);
}

async function benchmarkIntroductions(db: PrismaClient, userId: string): Promise<number> {
  const start = performance.now();
  await db.story.findMany({
    where: { tags: { some: { taggedUserId: userId } }, status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 25,
    include: { user: { select: { id: true, name: true } }, tags: true },
  });
  return Math.round(performance.now() - start);
}

async function benchmarkProfile(db: PrismaClient, userId: string): Promise<number> {
  const start = performance.now();
  await Promise.all([
    db.storyTag.count({ where: { story: { userId, status: "published" } } }),
    db.storyTag.count({ where: { taggedUserId: userId, story: { status: "published" } } }),
    db.userConnection.count({ where: { sourceUserId: userId } }),
    db.discoveriesPost.count({ where: { userId } }),
    db.message.count({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
  ]);
  return Math.round(performance.now() - start);
}

async function benchmarkMessageContext(db: PrismaClient, userId: string, otherUserId: string): Promise<number> {
  const start = performance.now();
  const pair = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];
  await Promise.all([
    db.conversationContext.findUnique({
      where: { userAId_userBId: { userAId: pair[0], userBId: pair[1] } },
    }),
    db.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.userConnection.findFirst({
      where: {
        sourceUserId: userId,
        targetUserId: otherUserId,
      },
    }),
    db.sharedIntroducerRelationship.findMany({
      where: {
        OR: [
          { userAId: pair[0], userBId: pair[1] },
          { userAId: pair[1], userBId: pair[0] },
        ],
      },
      take: 10,
    }),
  ]);
  return Math.round(performance.now() - start);
}

async function runRouteSamples(
  db: PrismaClient,
  userIds: string[],
  route: "home" | "discoveries" | "introductions" | "profile" | "messageContext"
): Promise<number[]> {
  const samples: number[] = [];
  for (const userId of userIds) {
    if (route === "home") samples.push(await benchmarkHome(db, userId));
    else if (route === "discoveries") samples.push(await benchmarkDiscoveries(db, userId));
    else if (route === "introductions") samples.push(await benchmarkIntroductions(db, userId));
    else if (route === "profile") samples.push(await benchmarkProfile(db, userId));
    else {
      const others = userIds.filter((id) => id !== userId);
      const other = others[Math.floor(Math.random() * others.length)] ?? userId;
      samples.push(await benchmarkMessageContext(db, userId, other));
    }
  }
  return samples;
}

function summarize(route: string, samples: number[]): RouteBenchmark {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    route,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
}

export async function runScaleBenchmarks(options?: {
  db?: PrismaClient;
  scales?: number[];
  samplesPerScale?: number;
}): Promise<ScaleBenchmark[]> {
  const db = options?.db ?? defaultPrisma;
  const scales = options?.scales ?? [100, 500, 1000];
  const samplesPerScale = options?.samplesPerScale ?? 20;

  const allUsers = await db.user.findMany({
    where: { email: { endsWith: SIM_EMAIL_DOMAIN } },
    select: { id: true },
    orderBy: { email: "asc" },
  });

  const results: ScaleBenchmark[] = [];
  for (const scale of scales) {
    const pool = allUsers.slice(0, Math.min(scale, allUsers.length)).map((u) => u.id);
    const sampleIds = pool.slice(0, Math.min(samplesPerScale, pool.length));
    const routeNames = ["home", "discoveries", "introductions", "profile", "messageContext"] as const;
    const routes: RouteBenchmark[] = [];
    let totalMs = 0;

    for (const route of routeNames) {
      const samples = await runRouteSamples(db, sampleIds, route);
      totalMs += samples.reduce((s, v) => s + v, 0);
      routes.push(summarize(route, samples));
    }

    results.push({
      userCount: scale,
      sampledUsers: sampleIds.length,
      routes,
      totalMs,
    });
  }

  return results;
}

export async function findSlowQueries(db: PrismaClient = defaultPrisma): Promise<Array<{ label: string; ms: number }>> {
  const user = await db.user.findFirst({
    where: { email: { endsWith: SIM_EMAIL_DOMAIN } },
    select: { id: true },
  });
  if (!user) return [];

  const checks: Array<{ label: string; fn: () => Promise<unknown> }> = [
    { label: "userConnection.findMany (degree<=2)", fn: () => db.userConnection.findMany({ where: { sourceUserId: user.id, degree: { lte: 2 } }, take: 500 }) },
    { label: "discoveriesPost.findMany (network)", fn: async () => {
      const ids = (await db.userConnection.findMany({ where: { sourceUserId: user.id, degree: { lte: 2 } }, select: { targetUserId: true }, take: 250 })).map((r) => r.targetUserId);
      return db.discoveriesPost.findMany({ where: { userId: { in: ids } }, take: 50 });
    }},
    { label: "sharedIntroducerRelationship.findMany", fn: () => db.sharedIntroducerRelationship.findMany({ where: { OR: [{ userAId: user.id }, { userBId: user.id }] }, take: 100 }) },
    { label: "story introductions inbox", fn: () => db.story.findMany({ where: { tags: { some: { taggedUserId: user.id } } }, take: 30, include: { tags: true } }) },
  ];

  const out: Array<{ label: string; ms: number }> = [];
  for (const check of checks) {
    const start = performance.now();
    await check.fn();
    out.push({ label: check.label, ms: Math.round(performance.now() - start) });
  }
  return out.sort((a, b) => b.ms - a.ms);
}
