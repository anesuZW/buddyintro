import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getIntroductionSuggestions } from "@/services/introduction-suggestions";

export async function GET() {
  const user = await requireUser();
  const suggestions = await getIntroductionSuggestions(user.id, 5);
  return NextResponse.json({ suggestions });
}
