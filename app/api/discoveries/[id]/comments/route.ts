import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  addDiscoveriesComment,
  getDiscoveriesComments,
} from "@/services/discoveries";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  try {
    const comments = await getDiscoveriesComments(params.id, user.id);
    return NextResponse.json({ comments });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }
}

const Schema = z.object({ content: z.string().min(1).max(500) });

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }
  const comment = await addDiscoveriesComment({
    postId: params.id,
    userId: user.id,
    content: parsed.data.content,
  });
  return NextResponse.json({ comment }, { status: 201 });
}
