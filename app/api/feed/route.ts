import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getMutualTagFeed } from "@/services/feed";
import { withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async (request: Request) => {
  const meAuth = await requireUserApi();
  if (isApiAuthError(meAuth)) return meAuth;
  const me = meAuth;
  const limit = Math.min(
    100,
    Number(new URL(request.url).searchParams.get("limit")) || 50
  );
  const items = await getMutualTagFeed(me.id, limit);
  return NextResponse.json({ items });
});
