import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createStoryWithTags, getVisibleStories } from "@/services/stories";
import { checkVerificationGate } from "@/lib/verification-gates";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { clampLimit } from "@/lib/pagination";
import { STORY_VISIBILITY_MODES } from "@/lib/story-visibility";
import { withProxiedMedia } from "@/lib/storage-url";

export async function GET() {
  const user = await requireUser();
  const stories = await getVisibleStories(user.id);
  return NextResponse.json({
    stories: stories.slice(0, clampLimit()).map(withProxiedMedia),
  });
}

const TagSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), userId: z.string().uuid() }),
  z.object({ kind: z.literal("external"), email: z.string().email() }),
  z.object({ kind: z.literal("phone"), phone: z.string().min(8) }),
]);

const mediaUrlSchema = z.union([
  z.string().url(),
  z.string().regex(/^\/api\/media\?path=/),
]);

const PostSchema = z.object({
  mediaUrl: mediaUrlSchema,
  mediaType: z.enum(["image", "video"]),
  voiceNoteUrl: z.string().url().optional(),
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

export async function POST(request: Request) {
  const user = await requireUser();

  const limited = enforceRateLimit(user.id, "stories:post");
  if (limited) return limited;

  const gate = await checkVerificationGate(user, "create_introduction");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message, code: gate.code }, { status: gate.status });
  }
  const body = await request.json();
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }
  try {
    const { story, phoneInvites } = await createStoryWithTags({
      authorId: user.id,
      ...parsed.data,
    });
    return NextResponse.json({ story, phoneInvites }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not create story";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
