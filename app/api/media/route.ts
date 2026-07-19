import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { canAccessStoragePath } from "@/lib/access-control";
import { getStorageProvider } from "@/lib/storage/index";
import { isLocalMediaProvider } from "@/lib/storage/config";
import { signStoragePathDetailed } from "@/lib/storage-signed";
import { Phase2Profiler, runWithPhase2Profile } from "@/lib/profile/phase2-profiler";

const QuerySchema = z.object({
  path: z.string().min(3),
});

const PROFILE_HEADERS = process.env.PROFILE_PHASE2 === "1" || process.env.PROFILE_API === "1";

async function handleGet(request: Request) {
  return runWithPhase2Profile("/api/media", async () => {
    const p = new Phase2Profiler("/api/media");
    const user = await p.timeRouteAuth(() => requireUser());

    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.safeParse({ path: searchParams.get("path") ?? "" });
    if (!parsed.success) {
      p.log({ response: 0 });
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const path = decodeURIComponent(parsed.data.path);
    if (path.includes("..")) {
      p.log({ response: 0 });
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const allowed = await p.time("accessControl", () => canAccessStoragePath(user.id, path));
    if (!allowed) {
      p.log({ response: 0 });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const provider = getStorageProvider();

    if (isLocalMediaProvider()) {
      const file = await p.time("readFile", () => provider.readFile(path));
      if (!file) {
        p.log({ response: 0 });
        return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
      }

      p.log({ response: 1, cacheHit: 1, cacheLookup: 0, createSignedUrl: 0, external: 0 });
      return new NextResponse(new Uint8Array(file.data), {
        headers: {
          "Content-Type": file.contentType,
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    const signed = await p.time("signUrl", () => signStoragePathDetailed(path));
    if (!signed) {
      p.log({ response: 0 });
      return NextResponse.json({ error: "Media unavailable" }, { status: 404 });
    }

    const responseStart = performance.now();
    const res = NextResponse.redirect(signed.signedUrl, {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
    const responseMs = Math.round(performance.now() - responseStart);

    if (PROFILE_HEADERS) {
      res.headers.set("x-media-cache", signed.cacheHit ? "hit" : "miss");
      res.headers.set("x-media-cache-lookup-ms", String(signed.cacheLookupMs));
      res.headers.set("x-media-create-signed-url-ms", String(signed.createSignedUrlMs));
    }

    p.log({
      response: responseMs,
      cacheLookup: signed.cacheLookupMs,
      createSignedUrl: signed.createSignedUrlMs,
      cacheHit: signed.cacheHit ? 1 : 0,
      external: signed.createSignedUrlMs,
    });

    return res;
  });
}

export const GET = handleGet;
