import type { PrismaClient } from "@prisma/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SIM_MARKER, SIM_PASSWORD, resolveTargets, type SimulationTargets } from "@/lib/simulation/constants";
import { buildSimulationPlan, type SimPersona } from "@/lib/simulation/personas";
import {
  avatarUrl,
  mediaTypeImage,
  planSimulationContent,
  storyImage,
  type UserIdMap,
} from "@/lib/simulation/content-plan";
import { chunk, findAuthUserIdByEmail, prisma as defaultPrisma, sleep, withRetry } from "@/lib/simulation/env";

export type SeedProgress = {
  users: number;
  stories: number;
  discoveries: number;
  messages: number;
  notifications: number;
  connections: number;
};

async function ensureAuthUser(
  supabase: SupabaseClient,
  db: PrismaClient,
  email: string,
  name: string
): Promise<string> {
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return existing.id;

  return withRetry(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: SIM_PASSWORD,
      email_confirm: true,
      user_metadata: { name, simulation: true },
    });
    if (error) {
      const code = (error as { code?: string }).code;
      const msg = error.message?.toLowerCase() ?? "";
      if (code === "email_exists" || msg.includes("already") || msg.includes("registered")) {
        const authId = await withRetry(() => findAuthUserIdByEmail(supabase, email), 3, 1000);
        if (authId) return authId;
      }
      throw error;
    }
    return data.user.id;
  });
}

async function seedUsers(
  supabase: SupabaseClient,
  personas: SimPersona[],
  db: PrismaClient
): Promise<UserIdMap> {
  const idMap: UserIdMap = new Map();
  const batches = chunk(personas, 5);

  for (const batch of batches) {
    await Promise.all(
      batch.map(async (persona) => {
        const id = await ensureAuthUser(supabase, db, persona.email, persona.name);
        idMap.set(persona.index, id);
        await db.user.upsert({
          where: { id },
          create: {
            id,
            email: persona.email,
            name: persona.name,
            profilePicture: avatarUrl(persona.name),
            emailVerified: true,
            phoneVerified: persona.index % 3 === 0,
            identityVerified: persona.index % 7 === 0,
            trustedUser: persona.isBridge || persona.index % 11 === 0,
          },
          update: {
            name: persona.name,
            profilePicture: avatarUrl(persona.name),
            emailVerified: true,
          },
        });
      })
    );
    process.stdout.write(`  users ${idMap.size}/${personas.length}\r`);
    await sleep(150);
  }
  console.log(`  users ${idMap.size}/${personas.length} ✓`);
  return idMap;
}

export async function runSimulationSeed(options: {
  supabase: SupabaseClient;
  db?: PrismaClient;
  skipIfPresent?: boolean;
  targets?: SimulationTargets;
}): Promise<SeedProgress> {
  const db = options.db ?? defaultPrisma;
  const targets = options.targets ?? resolveTargets();
  const existing = await db.user.count({
    where: { email: { endsWith: "@simulation.buddyintro.test" } },
  });

  if (existing >= targets.users && options.skipIfPresent) {
    console.log(`Simulation users already present (${existing}). Skipping insert, rebuilding graph…`);
    const { rebuildSimulationGraph } = await import("@/lib/simulation/graph-rebuild");
    const graph = await rebuildSimulationGraph(db);
    return {
      users: existing,
      stories: await db.story.count({ where: { text: { contains: SIM_MARKER } } }),
      discoveries: await db.discoveriesPost.count({ where: { content: { contains: SIM_MARKER } } }),
      messages: await db.message.count({ where: { message: { contains: SIM_MARKER } } }),
      notifications: await db.notification.count({ where: { message: { contains: SIM_MARKER } } }),
      connections: graph.rows,
    };
  }

  const { personas, communities } = buildSimulationPlan(targets.users);
  const content = planSimulationContent(personas, communities, targets);

  console.log(
    `Planning ${personas.length} personas across ${communities.length} communities + ${personas.filter((p) => p.isBridge).length} bridge users…`
  );

  const categories = await db.introductionCategory.findMany({ select: { id: true, name: true } });
  const categoryByName = new Map(categories.map((c) => [c.name, c.id]));
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const discExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const now = new Date();

  console.log("Creating simulation users (Supabase auth + Prisma)…");
  const idMap = await seedUsers(options.supabase, personas, db);

  console.log("Inserting tagged stories…");
  for (const batch of chunk(content.stories, 400)) {
    await db.story.createMany({
      data: batch.map((s) => ({
        id: s.id,
        userId: idMap.get(s.authorIndex)!,
        mediaUrl: storyImage(`${s.authorIndex}-${s.taggedIndex}`),
        mediaType: mediaTypeImage(),
        text: s.caption,
        status: s.status,
        publishedAt: s.status === "published" ? now : null,
        expiresAt,
        introductionCategoryId: categoryByName.get(s.categoryName) ?? null,
      })),
      skipDuplicates: true,
    });
    await db.storyTag.createMany({
      data: batch.map((s) => ({
        storyId: s.id,
        taggedUserId: idMap.get(s.taggedIndex)!,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`  stories ${content.stories.length} ✓`);

  console.log("Inserting discovery posts…");
  for (const batch of chunk(content.discoveries, 500)) {
    await db.discoveriesPost.createMany({
      data: batch.map((d) => ({
        id: d.id,
        userId: idMap.get(d.authorIndex)!,
        content: d.content,
        mediaUrl: storyImage(`disc-${d.authorIndex}`),
        mediaType: mediaTypeImage(),
        visibility: "network" as const,
        expiresAt: discExpiresAt,
        introductionCategoryId: categoryByName.get(d.categoryName) ?? null,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`  discoveries ${content.discoveries.length} ✓`);

  console.log("Inserting messages…");
  for (const batch of chunk(content.messages, 500)) {
    await db.message.createMany({
      data: batch.map((m) => ({
        id: m.id,
        senderId: idMap.get(m.senderIndex)!,
        receiverId: idMap.get(m.receiverIndex)!,
        message: m.body,
        conversationOrigin: m.origin,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`  messages ${content.messages.length} ✓`);

  console.log("Inserting notifications…");
  for (const batch of chunk(content.notifications, 500)) {
    await db.notification.createMany({
      data: batch.map((n) => ({
        id: n.id,
        userId: idMap.get(n.userIndex)!,
        actorId: n.actorIndex == null ? null : idMap.get(n.actorIndex)!,
        type: n.type,
        title: n.title,
        message: n.message,
        entityType: "simulation",
        isRead: false,
      })),
      skipDuplicates: true,
    });
  }
  console.log(`  notifications ${content.notifications.length} ✓`);

  console.log("Rebuilding trust graph…");
  const { rebuildSimulationGraph } = await import("@/lib/simulation/graph-rebuild");
  const graph = await rebuildSimulationGraph(db);
  console.log(`  connections ${graph.rows} ✓`);

  return {
    users: personas.length,
    stories: content.stories.length,
    discoveries: content.discoveries.length,
    messages: content.messages.length,
    notifications: content.notifications.length,
    connections: graph.rows,
  };
}
