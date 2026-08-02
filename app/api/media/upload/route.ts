import { NextResponse } from "next/server";

import { z } from "zod";

import { requireUserApi } from "@/lib/auth";

import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/constants";

import { appLogger } from "@/lib/logger";

import {

  getStorageProvider,

  inferUploadExtension,

  type UploadKind,

} from "@/lib/storage/index";

import { uploadRejectResponse, type UploadRejectBody } from "@/lib/upload-reject";



const KindSchema = z.enum(["image", "video", "audio"]);



function logUploadFailure(

  message: string,

  fields: {

    userId?: string;

    kind?: string;

    mimeType?: string;

    fileSize?: number;

    contentLength?: number;

    rejectSource: string;

    rejectCode: string;

    reason?: string;

  }

) {

  appLogger.warn(message, {

    route: "media/upload",

    ...fields,

  });

}



function reject413(

  body: UploadRejectBody & { limitMb: number },

  logFields: Record<string, unknown>

) {

  logUploadFailure("upload rejected with 413", {

    userId: typeof logFields.userId === "string" ? logFields.userId : undefined,

    kind: typeof logFields.kind === "string" ? logFields.kind : undefined,

    fileSize: typeof logFields.bytes === "number" ? logFields.bytes : undefined,

    contentLength: typeof logFields.contentLength === "number" ? logFields.contentLength : undefined,

    rejectSource: body.rejectSource,

    rejectCode: body.code,

    reason: body.reason,

  });

  return uploadRejectResponse(413, body);

}



export async function POST(request: Request) {

  const started = Date.now();

  const contentLength = Number(request.headers.get("content-length") || 0);

  const userAgent = request.headers.get("user-agent")?.slice(0, 120);



  const userAuth = await requireUserApi();

  if (userAuth instanceof NextResponse) {

    let authBody: { code?: string; reason?: string; rejectSource?: string } = {};

    try {

      authBody = (await userAuth.clone().json()) as typeof authBody;

    } catch {

      /* ignore parse errors */

    }

    logUploadFailure("upload rejected — authentication", {

      userId: "anonymous",

      contentLength: contentLength || undefined,

      rejectSource: authBody.rejectSource || "auth",

      rejectCode: authBody.code || "permission_denied",

      reason: authBody.reason || authBody.code || "User not authenticated",

    });

    return userAuth;

  }

  const user = userAuth;



  appLogger.info("upload request received", {

    route: "media/upload",

    userId: user.id,

    contentLength: contentLength || undefined,

    userAgent,

  });



  // Content-Length includes multipart envelope; allow slack so near-limit files aren't false-413'd.
  // Authoritative check remains file.size after form parse.
  const { MULTIPART_UPLOAD_SLACK_BYTES } = await import("@/lib/constants");
  if (contentLength > MAX_UPLOAD_BYTES + MULTIPART_UPLOAD_SLACK_BYTES) {

    return reject413(

      {

        error: `File too large (max ${MAX_UPLOAD_MB} MB)`,

        reason: `File exceeds the ${MAX_UPLOAD_MB} MB upload limit`,

        limitMb: MAX_UPLOAD_MB,

        code: "app_body_limit",

        rejectSource: "app",

      },

      { userId: user.id, contentLength, maxBytes: MAX_UPLOAD_BYTES }

    );

  }



  let form: FormData;

  try {

    form = await request.formData();

  } catch (err) {

    appLogger.error("upload formData parse failed — body likely truncated by reverse proxy", {

      route: "media/upload",

      userId: user.id,

      err,

      contentLength,

      rejectSource: "proxy",

      proof:

        "Request reached Next.js but multipart body could not be parsed; nginx/apache default 1m limit is the usual cause",

    });

    return reject413(

      {

        error: "Could not read upload body — the reverse proxy may be rejecting large files",

        reason: "Upload body truncated by reverse proxy",

        limitMb: 1,

        code: "proxy_body_limit",

        rejectSource: "proxy",

      },

      { userId: user.id, contentLength }

    );

  }



  const file = form.get("file");

  const kindResult = KindSchema.safeParse(form.get("kind"));

  const extOverride = typeof form.get("ext") === "string" ? String(form.get("ext")) : undefined;



  if (!(file instanceof Blob) || file.size === 0) {

    logUploadFailure("upload rejected — missing file", {

      userId: user.id,

      kind: kindResult.success ? kindResult.data : undefined,

      contentLength: contentLength || undefined,

      rejectSource: "app",

      rejectCode: "missing_file",

      reason: "Missing file",

    });

    return uploadRejectResponse(400, {

      error: "Missing file",

      code: "missing_file",

      reason: "Missing file",

      rejectSource: "app",

    });

  }

  if (!kindResult.success) {

    logUploadFailure("upload rejected — invalid kind", {

      userId: user.id,

      mimeType: file.type || undefined,

      fileSize: file.size,

      contentLength: contentLength || undefined,

      rejectSource: "app",

      rejectCode: "invalid_kind",

      reason: "Invalid upload kind",

    });

    return uploadRejectResponse(400, {

      error: "Invalid kind",

      code: "invalid_kind",

      reason: "Invalid upload kind",

      rejectSource: "app",

    });

  }

  const mime = file.type || "";
  const mimeKind = kindResult.data;
  const mimeOk =
    !mime ||
    (mimeKind === "image" && mime.startsWith("image/")) ||
    (mimeKind === "video" && mime.startsWith("video/")) ||
    (mimeKind === "audio" && mime.startsWith("audio/"));
  if (!mimeOk) {
    logUploadFailure("upload rejected — mime mismatch", {
      userId: user.id,
      kind: mimeKind,
      mimeType: mime,
      fileSize: file.size,
      contentLength: contentLength || undefined,
      rejectSource: "app",
      rejectCode: "invalid_mime",
      reason: "File type does not match upload kind",
    });
    return uploadRejectResponse(400, {
      error: "Invalid file type",
      code: "invalid_mime",
      reason: `Expected a ${mimeKind} file.`,
      rejectSource: "app",
    });
  }

  if (file.size > MAX_UPLOAD_BYTES) {

    return reject413(

      {

        error: `File too large (max ${MAX_UPLOAD_MB} MB)`,

        reason: `File exceeds the ${MAX_UPLOAD_MB} MB upload limit`,

        limitMb: MAX_UPLOAD_MB,

        code: "app_body_limit",

        rejectSource: "app",

      },

      { userId: user.id, bytes: file.size, maxBytes: MAX_UPLOAD_BYTES, kind: kindResult.data }

    );

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



  appLogger.info("upload started", {

    route: "media/upload",

    userId: user.id,

    kind,

    ext,

    bytes: file.size,

    contentType: file.type || undefined,

    rejectSource: "none",

  });



  try {

    const buffer = Buffer.from(await file.arrayBuffer());

    const provider = getStorageProvider();

    const result = await provider.upload(buffer, {

      userId: user.id,

      kind,

      ext,

      contentType: file.type || undefined,

    });



    appLogger.info("upload complete", {

      route: "media/upload",

      userId: user.id,

      kind,

      path: result.path,

      provider: provider.name,

      bytes: file.size,

      durationMs: Date.now() - started,

      deduplicated: result.deduplicated ?? false,

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
    const { isPrismaConnectivityError } = await import("@/lib/prisma-errors");
    const { serviceUnavailableResponse } = await import("@/lib/api-error");

    if (isPrismaConnectivityError(err)) {
      logUploadFailure("upload failed — database unavailable", {
        userId: user.id,
        kind,
        mimeType: file.type || undefined,
        fileSize: file.size,
        contentLength: contentLength || undefined,
        rejectSource: "app",
        rejectCode: "service_unavailable",
        reason: message,
      });
      return serviceUnavailableResponse(
        "Database temporarily unavailable. Please retry shortly."
      );
    }

    logUploadFailure("upload failed — storage error", {

      userId: user.id,

      kind,

      mimeType: file.type || undefined,

      fileSize: file.size,

      contentLength: contentLength || undefined,

      rejectSource: "storage",

      rejectCode: "storage_error",

      reason: message,

    });

    appLogger.error("upload failed", {

      route: "media/upload",

      userId: user.id,

      kind,

      err,

      durationMs: Date.now() - started,

    });

    return uploadRejectResponse(500, {

      error: "Upload failed",

      code: "storage_error",

      reason: "We could not store that file. Please try again.",

      rejectSource: "storage",

    });

  }

}

