import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/simulation/env";
import { SIM_EMAIL_DOMAIN } from "@/lib/simulation/constants";

export type ValidationResult = {
  userId: string;
  email: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  timingsMs: Record<string, number>;
};

export type ValidationSummary = {
  total: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
  globalErrors: string[];
};

async function timed<T>(label: string, fn: () => Promise<T>, timings: Record<string, number>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  timings[label] = Math.round(performance.now() - start);
  return result;
}

async function validateUser(db: PrismaClient, userId: string, email: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const timingsMs: Record<string, number> = {};

  try {
    const feed = await timed(
      "homeFeed",
      async () => {
        const myTags = await db.storyTag.findMany({
          where: { story: { userId }, taggedUserId: { not: null } },
          select: { taggedUserId: true },
        });
        const myTaggedUserIds = [...new Set(myTags.map((t) => t.taggedUserId!).filter(Boolean))];
        if (!myTaggedUserIds.length) return { items: 0, tagged: 0 };

        const authors = await db.story.findMany({
          where: {
            userId: { not: userId },
            status: "published",
            tags: { some: { taggedUserId: { in: myTaggedUserIds } } },
          },
          select: { id: true },
          take: 20,
        });
        return { items: authors.length, tagged: myTaggedUserIds.length };
      },
      timingsMs
    );

    if (feed.tagged > 0 && feed.items === 0) {
      errors.push("home feed is empty despite outgoing introductions");
    } else if (feed.tagged === 0 && feed.items === 0) {
      warnings.push("home feed empty (no outgoing introductions)");
    }

    await timed(
      "discoveries",
      async () => {
        const connections = await db.userConnection.findMany({
          where: { sourceUserId: userId, degree: { lte: 2 } },
          select: { targetUserId: true },
          take: 200,
        });
        const authorIds = [...new Set(connections.map((c) => c.targetUserId))];
        const posts = authorIds.length
          ? await db.discoveriesPost.count({
              where: { userId: { in: authorIds } },
            })
          : 0;
        if (posts === 0 && authorIds.length > 0) {
          warnings.push("discovery network has connections but no posts from network authors");
        }
        return posts;
      },
      timingsMs
    );

    await timed(
      "introductionSuggestions",
      async () => {
        const introducedByViewer = await db.storyTag.findMany({
          where: { story: { userId, status: "published" }, taggedUserId: { not: null } },
          select: { taggedUserId: true },
          take: 20,
        });
        if (introducedByViewer.length < 2) {
          warnings.push("insufficient introduction history for pair suggestions");
        }
        return introducedByViewer.length;
      },
      timingsMs
    );

    await timed(
      "trustDashboard",
      async () => {
        const [outgoing, incoming, connections] = await Promise.all([
          db.storyTag.count({ where: { story: { userId, status: "published" } } }),
          db.storyTag.count({ where: { taggedUserId: userId, story: { status: "published" } } }),
          db.userConnection.count({ where: { sourceUserId: userId } }),
        ]);
        if (connections === 0 && outgoing + incoming === 0) {
          errors.push("trust dashboard has no graph data");
        }
        return { outgoing, incoming, connections };
      },
      timingsMs
    );

    await timed(
      "profileInsights",
      async () => {
        const [introduced, received, topConnection] = await Promise.all([
          db.storyTag.count({
            where: { story: { userId, status: "published" }, taggedUserId: { not: null } },
          }),
          db.storyTag.count({ where: { taggedUserId: userId, story: { status: "published" } } }),
          db.userConnection.findFirst({
            where: { sourceUserId: userId },
            orderBy: { trustScore: "desc" },
            select: { trustScore: true },
          }),
        ]);
        if (topConnection && topConnection.trustScore == null) {
          errors.push("trust score cannot be computed (null on connection)");
        }
        return { introduced, received, trustScore: topConnection?.trustScore ?? 0 };
      },
      timingsMs
    );
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  return {
    userId,
    email,
    ok: errors.length === 0,
    errors,
    warnings,
    timingsMs,
  };
}

export async function validateSimulationUsers(options?: {
  db?: PrismaClient;
  sampleSize?: number;
  validateAll?: boolean;
}): Promise<ValidationSummary> {
  const db = options?.db ?? defaultPrisma;
  const globalErrors: string[] = [];

  const selfLinkRows = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM user_connections WHERE source_user_id = target_user_id
  `;
  const selfLinkCount = Number(selfLinkRows[0]?.count ?? 0);
  if (selfLinkCount > 0) {
    globalErrors.push(`introduction graph contains ${selfLinkCount} self-links`);
  }

  const users = await db.user.findMany({
    where: { email: { endsWith: SIM_EMAIL_DOMAIN } },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });

  if (!users.length) {
    globalErrors.push("no simulation users found");
    return { total: 0, passed: 0, failed: 0, results: [], globalErrors };
  }

  const targetUsers = options?.validateAll
    ? users
    : users.slice(0, options?.sampleSize ?? Math.min(100, users.length));

  const results: ValidationResult[] = [];
  for (const user of targetUsers) {
    results.push(await validateUser(db, user.id, user.email));
  }

  const failed = results.filter((r) => !r.ok).length + (globalErrors.length ? 1 : 0);
  const passed = results.filter((r) => r.ok).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
    globalErrors,
  };
}

export async function assertRecommendationEngine(db: PrismaClient = defaultPrisma): Promise<string[]> {
  const errors: string[] = [];
  const sample = await db.user.findFirst({
    where: { email: { endsWith: SIM_EMAIL_DOMAIN }, trustedUser: true },
    select: { id: true },
  });
  if (!sample) return ["no simulation user for recommendation smoke test"];

  try {
    const connections = await db.userConnection.findMany({
      where: { sourceUserId: sample.id, degree: { lte: 2 } },
      orderBy: [{ sharedIntroducerCount: "desc" }, { trustScore: "desc" }],
      take: 12,
      include: { targetUser: { select: { name: true } } },
    });
    if (connections.some((c) => c.trustScore == null)) {
      errors.push("recommendation engine input has null trust scores");
    }
  } catch (e) {
    errors.push(`recommendation engine crashed: ${e instanceof Error ? e.message : e}`);
  }

  return errors;
}
