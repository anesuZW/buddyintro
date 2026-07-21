import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import {
  getStorageProvider,
  inferUploadExtension,
  type UploadKind,
} from "@/lib/storage/index";

const KindSchema = z.enum(["image", "video", "audio"]);

export async function POST(request: Request) {
  const userAuth = await requireUserApi();
  if (userAuth instanceof NextResponse) return userAuth;
  const user = userAuth;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  const kindResult = KindSchema.safeParse(form.get("kind"));
  const extOverride = typeof form.get("ext") === "string" ? String(form.get("ext")) : undefined;

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!kindResult.success) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const kind = kindResult.data as UploadKind;
  const ext =
    extOverride ||
    inferUploadExtension(
      {
        name: file instanceof File ? file.name : undefined,
        type: file.type,
      },
      kind
    );

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const provider = getStorageProvider();
    const result = await provider.upload(buffer, {
      userId: user.id,
      kind,
      ext,
      contentType: file.type || undefined,
    });

    return NextResponse.json({
      url: result.publicUrl,
      path: result.path,
      variants: result.variants ?? { original: result.publicUrl },
      contentType: result.contentType,
      processingStatus: result.processingStatus ?? "ready",
      deduplicated: result.deduplicated ?? false,
      mediaObjectId: result.mediaObjectId,
      capabilities: provider.capabilities,
      provider: provider.name,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
