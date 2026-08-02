import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import {
  addDiscoveriesComment,
  getDiscoveriesComments,
} from "@/services/discoveries";
import { apiJson, withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  try {
    const comments = await getDiscoveriesComments(params.id, userAuth.id);
    return NextResponse.json({ comments });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Forbidden") {
      return apiJson(403, { error: "Forbidden", code: "permission_denied" });
    }
    throw err;
  }
});

const Schema = z.object({ content: z.string().min(1).max(500) });

export const POST = withApiHandler(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiJson(422, {
      error: "Invalid comment",
      code: "validation_error",
      reason: "Comment text is required (max 500 characters).",
    });
  }
  try {
    const comment = await addDiscoveriesComment({
      postId: params.id,
      userId: userAuth.id,
      content: parsed.data.content,
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Forbidden") {
      return apiJson(403, { error: "Forbidden", code: "permission_denied" });
    }
    throw err;
  }
});
