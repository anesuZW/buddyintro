import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getIntroductionSuggestions } from "@/services/introduction-suggestions";

export async function GET() {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  const suggestions = await getIntroductionSuggestions(user.id, 5);
  return NextResponse.json({ suggestions });
}
