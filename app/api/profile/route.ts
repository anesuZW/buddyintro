import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { optionalStoredMediaUrlSchema } from "@/lib/storage/validation";

const Schema = z.object({
  name: z.string().min(1).max(80),
  profilePicture: optionalStoredMediaUrlSchema,
});

export async function PATCH(request: Request) {
  const user = await requireUser();
  const body = Schema.parse(await request.json());
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: body.name, profilePicture: body.profilePicture ?? null },
  });
  return NextResponse.json({ user: updated });
}
