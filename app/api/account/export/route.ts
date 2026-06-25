import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { exportUserData } from "@/services/consent";

export async function GET() {
  const user = await requireUser();
  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="friendintro-export-${user.id}.json"`,
    },
  });
}
