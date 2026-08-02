import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { createStoryWithTags, getVisibleStories } from "@/services/stories";
import { checkVerificationGate } from "@/lib/verification-gates";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { clampLimit } from "@/lib/pagination";
import { STORY_VISIBILITY_MODES } from "@/lib/story-visibility";
import { withProxiedMedia } from "@/lib/storage-url";
import { storedMediaUrlSchema, optionalStoredMediaUrlSchema } from "@/lib/storage/validation";
import {
  apiJson,
  mapUnknownErrorToResponse,
  withApiHandler,
} from "@/lib/api-error";
import { isPrismaConnectivityError } from "@/lib/prisma-errors";

export const GET = withApiHandler(async () => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;
  const stories = await getVisibleStories(user.id);
  return NextResponse.json({
    stories: stories.slice(0, clampLimit()).map(withProxiedMedia),
  });
});

const TagSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), userId: z.string().uuid() }),
  z.object({ kind: z.literal("external"), email: z.string().email() }),
  z.object({ kind: z.literal("phone"), phone: z.string().min(8) }),
]);

const PostSchema = z.object({
  mediaUrl: storedMediaUrlSchema,
  mediaType: z.enum(["image", "video"]),
  voiceNoteUrl: optionalStoredMediaUrlSchema,
  text: z.string().max(280).nullable().optional(),
  tags: z.array(TagSchema).min(1, "Tag at least one person"),
  expiresInHours: z.number().int().positive().max(72).optional(),
  introductionCategoryId: z.string().uuid().nullable().optional(),
  visibilityMode: z
    .enum([
      STORY_VISIBILITY_MODES.SPECIFIC_PEOPLE_ONLY,
      STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK,
      STORY_VISIBILITY_MODES.EVERYONE_I_HAVE_INTRODUCED,
    ])
    .optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;

  const limited = await enforceRateLimit(user.id, "stories:post");
  if (limited) return limited;

  const gate = await checkVerificationGate(user, "create_introduction");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.message, code: gate.code },
      { status: gate.status }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiJson(422, { error: "Invalid JSON body", code: "invalid_json" });
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return apiJson(422, {
      error: parsed.error.issues[0]?.message || "Invalid input",
      code: "validation_error",
    });
  }

  try {
    const { story, phoneInvites, emailDelivery } = await createStoryWithTags({
      authorId: user.id,
      ...parsed.data,
    });
    return NextResponse.json({ story, phoneInvites, emailDelivery }, { status: 201 });
  } catch (err: unknown) {
    if (isPrismaConnectivityError(err)) return mapUnknownErrorToResponse(err);
    const message = err instanceof Error ? err.message : "Could not create story";
    return apiJson(400, { error: message, code: "create_failed" });
  }
});
