import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConnectionReason } from "@/lib/introduction-graph";
import { serializeConnectionReason } from "@/lib/connection-reason";
import { isUserBlocked } from "@/services/moderation";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const me = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, profilePicture: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (me.id !== user.id && (await isUserBlocked(me.id, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const connectionReason =
    me.id === user.id
      ? null
      : serializeConnectionReason(
          await getConnectionReason(me.id, user.id),
          me.id,
          user.id
        );

  return NextResponse.json({ user, connectionReason });
}
