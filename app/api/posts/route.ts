import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createPost } from "@/services/feed";
import { getAdminSettings } from "@/services/admin";

const Schema = z.object({
  content: z.string().max(2000).nullable().optional(),
  media: z.string().url().nullable().optional(),
});

export async function POST(request: Request) {
  const me = await requireUser();
  const data = Schema.parse(await request.json());
  const settings = await getAdminSettings();
  const post = await createPost({
    userId: me.id,
    content: data.content ?? null,
    media: data.media ?? null,
    expiresInHours: settings.postExpiryHours,
  });
  return NextResponse.json({ post });
}
