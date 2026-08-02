import { NextResponse } from "next/server";

export type UploadRejectSource = "auth" | "csrf" | "app" | "proxy" | "nginx" | "storage";

export type UploadRejectBody = {
  error: string;
  code: string;
  reason: string;
  rejectSource: UploadRejectSource;
  limitMb?: number;
  requestId?: string;
};

export function uploadRejectResponse(
  status: number,
  body: UploadRejectBody,
  extraHeaders?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Upload-Reject-Source": body.rejectSource,
      "X-Upload-Reject-Code": body.code,
      ...extraHeaders,
    },
  });
}

export function authUploadRejectResponse(status: 401 | 403, reason: string, error: string) {
  return uploadRejectResponse(status, {
    error,
    code: "permission_denied",
    reason,
    rejectSource: "auth",
  });
}
