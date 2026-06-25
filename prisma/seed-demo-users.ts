/**
 * Idempotent demo data seed for FriendIntro.
 * Run: npm run seed:demo
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient, MediaType } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const DEMO_PASSWORD = "123456";
const SEED_PREFIX = "[demo-seed]";
const BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || "friendintro";

const DEMO_USERS = [
  { email: "user1@friendintro.com", name: "Alex Rivera" },
  { email: "user2@friendintro.com", name: "Jordan Kim" },
  { email: "user3@friendintro.com", name: "Sam Patel" },
  { email: "user4@friendintro.com", name: "Taylor Morgan" },
  { email: "user5@friendintro.com", name: "Casey Nguyen" },
  { email: "user6@friendintro.com", name: "Riley Brooks" },
  { email: "user7@friendintro.com", name: "Morgan Lee" },
  { email: "user8@friendintro.com", name: "Jamie Foster" },
  { email: "user9@friendintro.com", name: "Avery Chen" },
  { email: "user10@friendintro.com", name: "Quinn Sullivan" },
] as const;

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function avatarFallback(name: string) {
  const bg = "2563EB";
  const fg = "ffffff";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=${fg}&size=256`;
}

function storyImage(seed: string) {
  return `https://picsum.photos/seed/friendintro-${seed}/1080/1920`;
}

async function findAuthUserIdByEmail(
  supabase: ReturnType<typeof createClient<any>>,
  email: string
): Promise<string | null> {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) break;
    page += 1;
  }
  return null;
}

async function uploadAvatar(
  supabase: ReturnType<typeof createClient<any>>,
  userId: string,
  name: string
): Promise<string> {
  const fallback = avatarFallback(name);
  try {
    const res = await fetch(
      `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(name)}&size=256`
    );
    if (!res.ok) return fallback;
    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `${userId}/image/demo-avatar.png`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) return fallback;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return fallback;
  }
}

async function ensureAuthUser(
  supabase: ReturnType<typeof createClient<any>>,
  email: string,
  name: string
): Promise<string> {
  const existingId = await findAuthUserIdByEmail(supabase, email);
  if (existingId) return existingId;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    const retryId = await findAuthUserIdByEmail(supabase, email);
    if (retryId) return retryId;
    throw error;
  }
  return data.user.id;
}

async function ensureDbUser(
  supabase: ReturnType<typeof createClient<any>>,
  email: string,
  name: string
) {
  const id = await ensureAuthUser(supabase, email, name);
  const avatar = await uploadAvatar(supabase, id, name);
  await prisma.user.upsert({
    where: { id },
    create: {
      id,
      email,
      name,
      profilePicture: avatar,
      emailVerified: true,
      phoneVerified: email.includes("user1") || email.includes("user2") || email.includes("user3"),
      identityVerified: email.includes("user1") || email.includes("user4"),
    },
    update: {
      name,
      profilePicture: avatar,
      emailVerified: true,
    },
  });
  return id;
}

async function ensureIntroductionStory(
  authorId: string,
  taggedUserId: string,
  seedKey: string,
  caption: string,
  categoryId?: string | null
) {
  const marker = `${SEED_PREFIX}:${seedKey}`;
  const existing = await prisma.story.findFirst({
    where: { userId: authorId, text: { contains: marker } },
  });
  if (existing) return existing;

  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const story = await prisma.story.create({
    data: {
      userId: authorId,
      mediaUrl: storyImage(seedKey),
      mediaType: MediaType.image,
      text: `${caption} ${marker}`,
      status: "published",
      publishedAt: new Date(),
      expiresAt,
      introductionCategoryId: categoryId ?? null,
    },
  });
  await prisma.storyTag.create({
    data: { storyId: story.id, taggedUserId },
  });
  return story;
}

async function ensureMutualStory(
  authorId: string,
  taggedIds: string[],
  seedKey: string,
  caption: string,
  categoryId?: string | null
) {
  const marker = `${SEED_PREFIX}:${seedKey}`;
  const existing = await prisma.story.findFirst({
    where: { userId: authorId, text: { contains: marker } },
  });
  if (existing) return existing;

  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const story = await prisma.story.create({
    data: {
      userId: authorId,
      mediaUrl: storyImage(seedKey),
      mediaType: MediaType.image,
      text: `${caption} ${marker}`,
      status: "published",
      publishedAt: new Date(),
      expiresAt,
      introductionCategoryId: categoryId ?? null,
    },
  });
  for (const taggedUserId of taggedIds) {
    await prisma.storyTag.create({
      data: { storyId: story.id, taggedUserId },
    });
  }
  return story;
}

async function ensureDiscoveriesPost(
  userId: string,
  seedKey: string,
  content: string,
  likerIds: string[] = []
) {
  const marker = `${SEED_PREFIX}:disc-${seedKey}`;
  const existing = await prisma.discoveriesPost.findFirst({
    where: { userId, content: { contains: marker } },
  });
  if (existing) {
    for (const likerId of likerIds) {
      await prisma.discoveriesLike.upsert({
        where: { postId_userId: { postId: existing.id, userId: likerId } },
        create: { postId: existing.id, userId: likerId },
        update: {},
      });
    }
    return existing;
  }

  const post = await prisma.discoveriesPost.create({
    data: {
      userId,
      content: `${content} ${marker}`,
      mediaUrl: storyImage(`disc-${seedKey}`),
      mediaType: MediaType.image,
      visibility: "network",
    },
  });

  for (const likerId of likerIds) {
    await prisma.discoveriesLike.create({
      data: { postId: post.id, userId: likerId },
    });
  }

  const commentAuthor = likerIds[0];
  if (commentAuthor) {
    const commentMarker = `${marker}:comment`;
    const hasComment = await prisma.discoveriesComment.findFirst({
      where: { postId: post.id, content: { contains: commentMarker } },
    });
    if (!hasComment) {
      await prisma.discoveriesComment.create({
        data: {
          postId: post.id,
          userId: commentAuthor,
          content: `Love this connection! ${commentMarker}`,
        },
      });
    }
  }

  return post;
}

async function ensureMessage(
  senderId: string,
  receiverId: string,
  seedKey: string,
  message: string,
  opts?: {
    storyReference?: string;
    conversationOrigin?: "story" | "discoveries" | "direct";
    discoveriesPostReference?: string;
  }
) {
  const marker = `${SEED_PREFIX}:msg-${seedKey}`;
  const existing = await prisma.message.findFirst({
    where: { senderId, receiverId, message: { contains: marker } },
  });
  if (existing) return existing;

  const pair = senderId < receiverId ? [senderId, receiverId] : [receiverId, senderId];
  if (opts?.conversationOrigin && opts.conversationOrigin !== "direct") {
    await prisma.conversationContext.upsert({
      where: { userAId_userBId: { userAId: pair[0], userBId: pair[1] } },
      create: {
        userAId: pair[0],
        userBId: pair[1],
        origin: opts.conversationOrigin,
        storyReference: opts.storyReference ?? null,
        discoveriesPostReference: opts.discoveriesPostReference ?? null,
      },
      update: {},
    });
  }

  return prisma.message.create({
    data: {
      senderId,
      receiverId,
      message: `${message} ${marker}`,
      storyReference: opts?.storyReference ?? null,
      discoveriesPostReference: opts?.discoveriesPostReference ?? null,
      conversationOrigin: opts?.conversationOrigin ?? null,
    },
  });
}

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  console.log("Seeding demo users…");
  const ids: string[] = [];
  for (const u of DEMO_USERS) {
    const id = await ensureDbUser(supabase, u.email, u.name);
    ids.push(id);
    console.log(`  ✓ ${u.email} (${u.name})`);
  }

  console.log("Seeding introduction hub (user1 → user2,3,4)…");
  const intro12 = await ensureIntroductionStory(
    ids[0],
    ids[1],
    "intro-1-2",
    `${DEMO_USERS[0].name} wants you to meet ${DEMO_USERS[1].name}!`
  );
  await ensureIntroductionStory(
    ids[0],
    ids[2],
    "intro-1-3",
    `${DEMO_USERS[0].name} thinks you'd get along with ${DEMO_USERS[2].name}.`
  );
  await ensureIntroductionStory(
    ids[0],
    ids[3],
    "intro-1-4",
    `${DEMO_USERS[0].name} is connecting you with ${DEMO_USERS[3].name}.`
  );

  console.log("Seeding secondary introductions…");
  const intro25 = await ensureIntroductionStory(
    ids[1],
    ids[4],
    "intro-2-5",
    `${DEMO_USERS[1].name} introducing ${DEMO_USERS[4].name} to the circle.`
  );
  await ensureIntroductionStory(
    ids[2],
    ids[5],
    "intro-3-6",
    `${DEMO_USERS[2].name} wants you to meet ${DEMO_USERS[5].name}!`
  );

  console.log("Seeding extended chain for graph depth…");
  for (let i = 6; i < ids.length - 1; i++) {
    await ensureIntroductionStory(
      ids[i],
      ids[i + 1],
      `intro-chain-${i + 1}-${i + 2}`,
      `${DEMO_USERS[i].name} passing the intro to ${DEMO_USERS[i + 1].name}.`
    );
  }

  console.log("Seeding mutual-tag story…");
  await ensureMutualStory(
    ids[4],
    [ids[1], ids[2]],
    "mutual-5-2-3",
    "Casey thinks Jordan and Sam should connect over hiking."
  );

  console.log("Seeding shared introducer trust examples…");
  const categories = await prisma.introductionCategory.findMany();
  const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const pairIntroducers = async (
    userA: number,
    userB: number,
    introducerIndices: number[],
    label: string
  ) => {
    for (let i = 0; i < introducerIndices.length; i++) {
      const introIdx = introducerIndices[i];
      await ensureIntroductionStory(
        ids[introIdx],
        ids[userA],
        `shared-${userA}-${userB}-a-${introIdx}`,
        `${DEMO_USERS[introIdx].name} introduces ${DEMO_USERS[userA].name} (${label})`,
        cat("Friend")
      );
      await ensureIntroductionStory(
        ids[introIdx],
        ids[userB],
        `shared-${userA}-${userB}-b-${introIdx}`,
        `${DEMO_USERS[introIdx].name} introduces ${DEMO_USERS[userB].name} (${label})`,
        cat("Friend")
      );
    }
  };
  // user2 & user3: 5 shared introducers (indices 0,3,4,5,6 = Alex, Taylor, Casey, Riley, Morgan)
  await pairIntroducers(1, 2, [0, 3, 4, 5, 6], "Jordan × Sam");
  // user4 & user5: 8 shared introducers
  await pairIntroducers(3, 4, [0, 1, 2, 3, 5, 6, 7, 8], "Taylor × Casey");
  // user6 & user7: 8 shared introducers (max available in 10-user demo)
  await pairIntroducers(5, 6, [0, 1, 2, 3, 4, 7, 8, 9], "Riley × Morgan");

  console.log("Seeding category introductions…");
  await ensureIntroductionStory(
    ids[0],
    ids[8],
    "family-intro",
    "Alex introducing Avery as family.",
    cat("Family")
  );
  await ensureIntroductionStory(
    ids[1],
    ids[9],
    "church-intro",
    "Jordan introducing Quinn from church.",
    cat("Church")
  );
  await ensureIntroductionStory(
    ids[2],
    ids[7],
    "business-intro",
    "Sam introducing Jamie for business.",
    cat("Business")
  );
  await ensureIntroductionStory(
    ids[3],
    ids[6],
    "mentorship-intro",
    "Taylor introducing Morgan as a mentor.",
    cat("Mentorship")
  );

  console.log("Seeding discoveries (user2–6)…");
  const disc2 = await ensureDiscoveriesPost(
    ids[1],
    "jordan-brunch",
    "Brunch spot recs — who is free this weekend?",
    [ids[2], ids[3]]
  );
  const disc3 = await ensureDiscoveriesPost(
    ids[2],
    "sam-bookclub",
    "Starting a small book club — who is in?",
    [ids[1], ids[4], ids[5]]
  );
  await ensureDiscoveriesPost(
    ids[3],
    "taylor-design",
    "Sharing a design portfolio — feedback welcome.",
    [ids[1], ids[2]]
  );
  await ensureDiscoveriesPost(
    ids[4],
    "casey-run",
    "Morning run group starting Tuesday — join us!",
    [ids[1], ids[5]]
  );
  await ensureDiscoveriesPost(
    ids[5],
    "riley-music",
    "Open mic night this Friday — tag someone who sings!",
    [ids[2], ids[4]]
  );

  console.log("Seeding story-reply conversations…");
  await ensureMessage(
    ids[1],
    ids[2],
    "2-3-story",
    "Hey Sam! Alex introduced us both — loved your book club post.",
    { storyReference: intro12.id, conversationOrigin: "story" }
  );
  await ensureMessage(
    ids[2],
    ids[1],
    "3-2-story",
    "Jordan! Yes — let's pick a first book together.",
    { storyReference: intro12.id, conversationOrigin: "story" }
  );
  await ensureMessage(
    ids[3],
    ids[4],
    "4-5-story",
    "Casey — Taylor here. Alex connected us through BuddyIntro.",
    { storyReference: intro25.id, conversationOrigin: "story" }
  );
  await ensureMessage(
    ids[4],
    ids[3],
    "5-4-story",
    "Taylor! Happy to connect — saw your design post too.",
    { storyReference: intro25.id, conversationOrigin: "story" }
  );

  console.log("Seeding discoveries-origin chat…");
  await ensureMessage(
    ids[2],
    ids[1],
    "3-2-disc",
    "Jordan — your brunch post looked great. Want to go together?",
    {
      discoveriesPostReference: disc2.id,
      conversationOrigin: "discoveries",
    }
  );

  console.log("Seeding additional messages…");
  await ensureMessage(ids[0], ids[1], "1-2", "Hey Jordan! Glad Alex could connect us.");
  await ensureMessage(ids[6], ids[7], "7-8", "Jamie — Morgan here about the trip post.");

  console.log("Rebuilding trust graph…");
  const { rebuildUserConnections } = await import("../services/introduction-graph-builder");
  const graph = await rebuildUserConnections();
  console.log(`  ✓ ${graph.rows} connection rows for ${graph.users} users (trust graph refreshed)`);

  console.log("\nDemo seed complete.");
  console.log("Log in with user1@friendintro.com … user10@friendintro.com / password: 123456");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
