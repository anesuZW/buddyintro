import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUserApi } from "@/lib/auth";
import type { ShareDraftCookie } from "@/app/api/share/target/route";

/** Returns Web Share Target draft stored in httpOnly cookie. */
export async function GET() {
  const authResult = await requireUserApi();

  if (authResult instanceof NextResponse) return authResult;
  const raw = cookies().get("fi-share-draft")?.value;
  if (!raw) {
    return NextResponse.json({ draft: null });
  }
  try {
    const draft = JSON.parse(raw) as ShareDraftCookie;
    cookies().delete("fi-share-draft");
    return NextResponse.json({ draft });
  } catch {
    cookies().delete("fi-share-draft");
    return NextResponse.json({ draft: null });
  }
}
