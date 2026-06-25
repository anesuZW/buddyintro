import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { toggleDiscoveriesBookmark } from "@/services/discoveries";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const user = await requireUser();
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
