import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import {
  createIntroductionCategory,
  deleteIntroductionCategory,
  listIntroductionCategories,
  updateIntroductionCategory,
} from "@/services/introduction-categories";
import { logAdminAction } from "@/services/audit-log";

export async function GET() {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const categories = await listIntroductionCategories(false);
  return NextResponse.json({ categories });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(200).optional(),
  icon: z.string().max(40).optional(),
  color: z.string().max(20).optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const data = CreateSchema.parse(await request.json());
  const category = await createIntroductionCategory({ ...data, isSystem: false });
  await logAdminAction({
    adminId: admin.id,
    action: "category.create",
    targetType: "introduction_category",
    targetId: category.id,
    metadata: { name: category.name },
  });
  return NextResponse.json({ category }, { status: 201 });
}

const PatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(200).nullable().optional(),
  icon: z.string().max(40).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const { id, ...data } = PatchSchema.parse(await request.json());
  const category = await updateIntroductionCategory(id, data);
  await logAdminAction({
    adminId: admin.id,
    action: "category.update",
    targetType: "introduction_category",
    targetId: id,
    metadata: data,
  });
  return NextResponse.json({ category });
}

export async function DELETE(request: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteIntroductionCategory(id);
  await logAdminAction({
    adminId: admin.id,
    action: "category.delete",
    targetType: "introduction_category",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
