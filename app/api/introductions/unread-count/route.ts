import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getIntroductionsUnreadCount } from "@/services/introductions";

export async function GET() {
  const user = await requireUser();
  const count = await getIntroductionsUnreadCount(user.id);
  return NextResponse.json({ count });
}
