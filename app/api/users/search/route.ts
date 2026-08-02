import { NextResponse } from "next/server";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { searchUsersWithTrust } from "@/lib/search-users-trust";
import { withApiHandler } from "@/lib/api-error";

export const GET = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const users = await searchUsersWithTrust(q, userAuth.id);
  return NextResponse.json({ users });
});
