import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAppLocale, LOCALE_COOKIE } from "@/i18n/routing";

const Schema = z.object({
  preferredLanguage: z.string().refine((value) => isAppLocale(value), "Invalid locale"),
});

export async function PATCH(request: Request) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;
  const body = Schema.parse(await request.json());

  await prisma.user.update({
    where: { id: user.id },
    data: { preferredLanguage: body.preferredLanguage },
  });

  const response = NextResponse.json({ ok: true, preferredLanguage: body.preferredLanguage });
  response.cookies.set(LOCALE_COOKIE, body.preferredLanguage, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}
