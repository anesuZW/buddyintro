import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import {
  getIntroductionsForUser,
  markIntroductionsSeen,
} from "@/services/introductions";
import type { IntroductionGroup } from "@/types";
import { clampLimit } from "@/lib/pagination";
import { withPerfApi } from "@/lib/perf/with-perf";
import { RouteProfiler } from "@/lib/profile/route-profiler";
import { withApiHandler } from "@/lib/api-error";

const GROUPS: IntroductionGroup[] = ["recent", "past", "pending"];

async function handleGet(request: Request) {
  const p = new RouteProfiler("/api/introductions");

  const userAuth = await p.time("auth", () => requireUserApi());
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;

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
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  await markIntroductionsSeen(userAuth.id);
  return NextResponse.json({ ok: true });
}

export const GET = withApiHandler(withPerfApi("/api/introductions", handleGet));
export const POST = withApiHandler(withPerfApi("/api/introductions", handlePost));
