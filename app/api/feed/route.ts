import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getMutualTagFeed } from "@/services/feed";

export async function GET(request: Request) {
  const me = await requireUser();
  const limit = Math.min(
    100,
    Number(new URL(request.url).searchParams.get("limit")) || 50
  );
  const items = await getMutualTagFeed(me.id, limit);
  return NextResponse.json({ items });
}
