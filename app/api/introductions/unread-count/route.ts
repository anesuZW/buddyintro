import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { getIntroductionsUnreadCount } from "@/services/introductions";

export async function GET() {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  const count = await getIntroductionsUnreadCount(user.id);
  return NextResponse.json({ count });
}
