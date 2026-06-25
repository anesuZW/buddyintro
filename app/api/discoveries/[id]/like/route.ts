import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
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
  const user = await requireUser();
  return handleLike(params.id, user.id);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
  return handleLike(params.id, user.id);
}
