import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getIntroductionsForUser,
  markIntroductionsSeen,
} from "@/services/introductions";
import type { IntroductionGroup } from "@/types";
import { clampLimit } from "@/lib/pagination";
import { withPerfApi } from "@/lib/perf/with-perf";
import { RouteProfiler } from "@/lib/profile/route-profiler";

const GROUPS: IntroductionGroup[] = ["recent", "past", "pending"];

async function handleGet(request: Request) {
  const p = new RouteProfiler("/api/introductions");

  const user = await p.time("auth", async () => {
    const u = await getCurrentUser();
    if (!u) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    return u;
  });

  const { searchParams } = new URL(request.url);
  const groupParam = searchParams.get("group");
  const group = GROUPS.includes(groupParam as IntroductionGroup)
    ? (groupParam as IntroductionGroup)
    : "recent";
  const cursor = searchParams.get("cursor") ?? undefined;
  const limit = clampLimit(Number(searchParams.get("limit") ?? undefined));

  const data = await p.time("queryIntroductions", () =>
    getIntroductionsForUser(user.id, { group, cursor, limit })
  );

  await p.time("serialize", async () => JSON.stringify(data));
  p.finish();
  return p.finishResponse(NextResponse.json(data));
}

async function handlePost() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await markIntroductionsSeen(user.id);
  return NextResponse.json({ ok: true });
}

export const GET = withPerfApi("/api/introductions", handleGet);
export const POST = withPerfApi("/api/introductions", handlePost);
