import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { optionalStoredMediaUrlSchema } from "@/lib/storage/validation";
import { apiJson, withApiHandler } from "@/lib/api-error";

const Schema = z.object({
  name: z.string().min(1).max(80),
  profilePicture: optionalStoredMediaUrlSchema,
});

export const PATCH = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiJson(422, { error: "Invalid JSON body", code: "invalid_json" });
  }

  const parsed = Schema.safeParse(json);
  if (!parsed.success) {
    return apiJson(422, {
      error: parsed.error.issues[0]?.message || "Invalid input",
      code: "validation_error",
    });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: parsed.data.name,
      profilePicture: parsed.data.profilePicture ?? null,
    },
  });
  return NextResponse.json({ user: updated });
});
