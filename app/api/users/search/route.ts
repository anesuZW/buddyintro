import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchUsersWithTrust } from "@/lib/search-users-trust";

export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const users = await searchUsersWithTrust(q, user.id);
  return NextResponse.json({ users });
}
