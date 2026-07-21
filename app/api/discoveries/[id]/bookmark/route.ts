import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { toggleDiscoveriesBookmark } from "@/services/discoveries";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  try {
    const result = await toggleDiscoveriesBookmark(params.id, user.id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }
}
