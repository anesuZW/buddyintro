import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { toggleDiscoveriesLike } from "@/services/discoveries";

async function handleLike(postId: string, userId: string) {
  try {
    return NextResponse.json(await toggleDiscoveriesLike(postId, userId));
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  return handleLike(params.id, user.id);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  return handleLike(params.id, user.id);
}
