import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { searchUsersWithTrust } from "@/lib/search-users-trust";

export async function GET(request: Request) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const users = await searchUsersWithTrust(q, user.id);
  return NextResponse.json({ users });
}
