import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getAdminSettings } from "@/services/admin";
import { serializeStoryVisibilityConfig } from "@/lib/story-visibility";

export async function GET() {
  await requireUser();
  const settings = await getAdminSettings();
  return NextResponse.json(serializeStoryVisibilityConfig(settings));
}
