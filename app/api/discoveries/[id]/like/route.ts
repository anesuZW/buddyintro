import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { toggleDiscoveriesLike } from "@/services/discoveries";
import { apiJson, withApiHandler } from "@/lib/api-error";

async function handleLike(postId: string, userId: string) {
  try {
    return NextResponse.json(await toggleDiscoveriesLike(postId, userId));
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Forbidden") {
      return apiJson(403, { error: "Forbidden", code: "permission_denied" });
    }
    throw err;
  }
}

export const POST = withApiHandler(async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  return handleLike(params.id, userAuth.id);
});

export const DELETE = withApiHandler(async (
  _request: Request,
  { params }: { params: { id: string } }
) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  return handleLike(params.id, userAuth.id);
});
