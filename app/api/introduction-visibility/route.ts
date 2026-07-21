import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getAdminSettings } from "@/services/admin";
import { serializeStoryVisibilityConfig } from "@/lib/story-visibility";

export async function GET() {
  const authResult = await requireUserApi();

  if (authResult instanceof NextResponse) return authResult;
  const settings = await getAdminSettings();
  return NextResponse.json(serializeStoryVisibilityConfig(settings));
}
