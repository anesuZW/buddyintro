import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getIntroductionSuggestions } from "@/services/introduction-suggestions";
import { withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async () => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const suggestions = await getIntroductionSuggestions(userAuth.id, 5);
  return NextResponse.json({ suggestions });
});
