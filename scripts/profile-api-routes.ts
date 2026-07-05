/**
 * Profile API query patterns (Prisma layer only). Usage: npx tsx scripts/profile-api-routes.ts
 * For full route timing including auth, run dev with PROFILE_API=1 and hit endpoints.
 */
import fs from "fs";
import { PrismaClient } from "@prisma/client";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"\n]*)"?/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

loadEnv();

async function timed<T>(label: string, fn: () => Promise<T>): Promise<number> {
  const t0 = performance.now();
  await fn();
  const ms = Math.round(performance.now() - t0);
  console.log(`  ${label}=${ms}ms`);
  return ms;
}

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No users");
    process.exit(1);
  }
  const uid = user.id;
  console.log(`User: ${user.email}\n`);

  console.log("[BASELINE]");
  await timed("SELECT 1", () => prisma.$queryRaw`SELECT 1`);
  await timed("adminSettings", () => prisma.adminSettings.findUnique({ where: { id: 1 } }));

  console.log("\n[PROFILE] /api/trust/recommendations (Prisma only)");
  const trustSections: Record<string, number> = {};
  trustSections.queryConnections = await timed("queryConnections", () =>
    prisma.userConnection.findMany({
      where: { sourceUserId: uid, degree: { lte: 2 } },
      orderBy: [{ sharedIntroducerCount: "desc" }, { trustScore: "desc" }],
      take: 12,
      include: { targetUser: { select: { id: true, name: true } } },
    })
  );
  const top = await prisma.userConnection.findFirst({
    where: { sourceUserId: uid },
    orderBy: { sharedIntroducerCount: "desc" },
  });
  if (top) {
    const [a, b] = [uid, top.targetUserId].sort();
    trustSections.sharedIntroducersForPair = await timed("sharedIntroducersForPair", () =>
      prisma.sharedIntroducerRelationship.findMany({
        where: { userAId: a, userBId: b },
        include: {
          sharedIntroducer: { select: { id: true, name: true, profilePicture: true } },
          firstStory: { select: { id: true, category: { select: { id: true, name: true } } } },
          secondStory: { select: { id: true, category: { select: { id: true, name: true } } } },
        },
      })
    );
  }
  trustSections.total = Object.values(trustSections).reduce((a, b) => a + b, 0);
  console.log(`  total=${trustSections.total}ms`);

  console.log("\n[PROFILE] /api/discoveries (Prisma only)");
  const discSections: Record<string, number> = {};
  discSections.networkConnections = await timed("networkConnections", () =>
    prisma.userConnection.findMany({
      where: { sourceUserId: uid, degree: { lte: 2 } },
      select: { targetUserId: true },
    })
  );
  discSections.viewer = await timed("viewer", () =>
    prisma.user.findUnique({ where: { id: uid }, select: { id: true, verificationLevel: true } })
  );
  discSections.blocked = await timed("blocked", () =>
    prisma.userBlock.findMany({ where: { blockerId: uid }, select: { blockedId: true } })
  );
  const authorIds = [uid];
  discSections.queryPosts = await timed("queryPosts", () =>
    prisma.discoveriesPost.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        userId: { in: authorIds },
      },
      take: 21,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, profilePicture: true } },
        likes: { where: { userId: uid }, select: { id: true } },
        bookmarks: { where: { userId: uid }, select: { id: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    })
  );
  discSections.trustBulk = await timed("trustProfilesBulk", () =>
    prisma.userConnection.findMany({
      where: { sourceUserId: uid, targetUserId: { in: authorIds } },
      select: { targetUserId: true, sharedIntroducerCount: true, trustScore: true, degree: true },
    })
  );
  discSections.total = Object.values(discSections).reduce((a, b) => a + b, 0);
  console.log(`  total=${discSections.total}ms`);

  console.log("\n[PROFILE] /api/introductions (Prisma only)");
  const introSections: Record<string, number> = {};
  introSections.queryUser = await timed("queryUser", () =>
    prisma.user.findUnique({ where: { id: uid }, select: { lastIntroductionsSeenAt: true } })
  );
  introSections.queryStories = await timed("queryStories", () =>
    prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
        tags: { some: { taggedUserId: uid } },
        OR: [{ status: "published" }, { status: "draft" }, { status: "expired" }],
      },
      orderBy: { createdAt: "desc" },
      take: 21,
      include: {
        user: { select: { id: true, name: true, profilePicture: true } },
        category: { select: { id: true, name: true } },
        tags: { include: { taggedUser: { select: { id: true, name: true, profilePicture: true } } } },
      },
    })
  );
  introSections.blocked = await timed("blocked", () =>
    prisma.userBlock.findMany({ where: { blockerId: uid }, select: { blockedId: true } })
  );
  introSections.total = Object.values(introSections).reduce((a, b) => a + b, 0);
  console.log(`  total=${introSections.total}ms`);

  console.log("\n[PROFILE] /api/profile/insights (Prisma only — 14 parallel counts)");
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const insightsStart = performance.now();
  await Promise.all([
    prisma.storyTag.count({
      where: { story: { userId: uid, status: "published" }, taggedUserId: { not: null } },
    }),
    prisma.storyTag.count({ where: { taggedUserId: uid, story: { status: "published" } } }),
    prisma.userConnection.findFirst({
      where: { sourceUserId: uid },
      orderBy: { trustScore: "desc" },
      select: { trustScore: true, sharedIntroducerCount: true },
    }),
    prisma.message.count({ where: { senderId: uid, createdAt: { gte: monthAgo } } }),
    prisma.invitation.count({ where: { invitedById: uid, registered: true } }),
    prisma.discoveriesPost.count({ where: { userId: uid } }),
    prisma.story.groupBy({
      by: ["introductionCategoryId"],
      where: { userId: uid, introductionCategoryId: { not: null } },
      _count: { id: true },
    }),
    prisma.analyticsEvent.count({
      where: { userId: uid, eventType: "trust_score_increased", createdAt: { gte: monthAgo } },
    }),
    prisma.userConnection.count({ where: { sourceUserId: uid, degree: { gte: 1, lte: 4 } } }),
    prisma.userConnection.count({
      where: { sourceUserId: uid, createdAt: { gte: monthAgo } },
    }),
    prisma.story.count({ where: { userId: uid, status: "published" } }),
    prisma.analyticsEvent.count({
      where: { userId: uid, eventType: "introduction_viewed", createdAt: { gte: monthAgo } },
    }),
    prisma.analyticsEvent.count({
      where: { userId: uid, eventType: "introduction_accepted" },
    }),
    prisma.analyticsEvent.count({
      where: { userId: uid, eventType: "discovery_viewed", entityType: "discoveries_post" },
    }),
  ]);
  console.log(`  parallelQueries=${Math.round(performance.now() - insightsStart)}ms`);

  console.log("\n[PROFILE] /api/notifications/preferences (Prisma only)");
  await timed("findUnique", () =>
    prisma.notificationPreferences.findUnique({ where: { userId: uid } })
  );
  await timed("upsert (current impl)", () =>
    prisma.notificationPreferences.upsert({
      where: { userId: uid },
      create: { userId: uid },
      update: {},
    })
  );

  console.log("\n[NOTE] Auth overhead NOT included above.");
  console.log("Typical auth stack per API request:");
  console.log("  middleware supabase.auth.getUser()  ~200-800ms (network)");
  console.log("  route getCurrentUser()              ~200-800ms (duplicate getUser + prisma user)");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
