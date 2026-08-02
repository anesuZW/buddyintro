import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getIntroductionsUnreadCount } from "@/services/introductions";
import { withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async () => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const count = await getIntroductionsUnreadCount(userAuth.id);
  return NextResponse.json({ count });
});
