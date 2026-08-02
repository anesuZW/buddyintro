import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getAdminSettings } from "@/services/admin";
import { serializeStoryVisibilityConfig } from "@/lib/story-visibility";
import { withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async () => {
  const authResult = await requireUserApi();
  if (isApiAuthError(authResult)) return authResult;
  const settings = await getAdminSettings();
  return NextResponse.json(serializeStoryVisibilityConfig(settings));
});
