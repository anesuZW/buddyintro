import { NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/storage/index";
import { extractStoragePath } from "@/lib/storage-url";
import { isSafeStoragePath } from "@/lib/storage/paths";

type RouteParams = { params: Promise<{ path: string[] }> };

/** Serve local media files from MEDIA_ROOT at /uploads/{path}. */
export async function GET(request: Request, { params }: RouteParams) {
  const segments = (await params).path;
  if (!segments?.length) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const storagePath = segments.map(decodeURIComponent).join("/");
  if (!isSafeStoragePath(storagePath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const provider = getStorageProvider();
  if (provider.name !== "local") {
    const resolved = extractStoragePath(storagePath) ?? storagePath;
    return NextResponse.redirect(`/api/media?path=${encodeURIComponent(resolved)}`);
  }

  const file = await provider.readFile(storagePath);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && file.etag && ifNoneMatch === file.etag) {
    return new NextResponse(null, { status: 304 });
  }

  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (file.etag) headers.ETag = file.etag;
  if (file.lastModified) headers["Last-Modified"] = file.lastModified.toUTCString();

  return new NextResponse(new Uint8Array(file.data), { headers });
}
