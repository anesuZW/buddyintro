import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getPerfRecords, getPerfSummary } from "@/lib/perf/store";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) return auth;

  const limit = 100;
  return NextResponse.json({
    summary: getPerfSummary(),
    records: getPerfRecords(limit),
  });
}
