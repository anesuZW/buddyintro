import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";

/** Returns Web Share Target draft stored in httpOnly cookie. */
export async function GET() {
  await requireUser();
  const raw = cookies().get("fi-share-draft")?.value;
  if (!raw) {
    return NextResponse.json({ draft: null });
  }
  try {
    const draft = JSON.parse(raw) as { content: string; at: number };
    cookies().delete("fi-share-draft");
    return NextResponse.json({ draft });
  } catch {
    cookies().delete("fi-share-draft");
    return NextResponse.json({ draft: null });
  }
}
