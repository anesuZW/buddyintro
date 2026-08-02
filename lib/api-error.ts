import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isPrismaConnectivityError, isPrismaUniqueViolation } from "@/lib/prisma-errors";

export type ApiErrorBody = {
  error: string;
  code: string;
  reason?: string;
  details?: unknown;
};

export function apiJson(
  status: number,
  body: ApiErrorBody,
  headers?: Record<string, string>
) {
  return NextResponse.json(body, { status, headers });
}

export function serviceUnavailableResponse(
  reason = "A required backend dependency is unavailable. Please retry shortly."
) {
  return apiJson(503, {
    error: "Service temporarily unavailable",
    code: "service_unavailable",
    reason,
  });
}

/** Map thrown errors from route handlers into consistent JSON responses. */
export function mapUnknownErrorToResponse(error: unknown): NextResponse {
  if (error instanceof NextResponse) return error;

  // Handlers may throw `Response` / `NextResponse`-like objects for early exit.
  if (error instanceof Response) {
    return new NextResponse(error.body, {
      status: error.status,
      headers: error.headers,
    });
  }

  if (error instanceof ZodError) {
    return apiJson(422, {
      error: "Validation failed",
      code: "validation_error",
      reason: "One or more fields are invalid.",
      details: error.flatten(),
    });
  }

  if (error instanceof SyntaxError) {
    return apiJson(400, {
      error: "Invalid request body",
      code: "invalid_json",
      reason: "Request body must be valid JSON.",
    });
  }

  if (isPrismaConnectivityError(error)) {
    console.warn(
      "[api] database unavailable",
      error instanceof Error ? error.message : error
    );
    return serviceUnavailableResponse(
      "Database temporarily unavailable. Please retry shortly."
    );
  }

  if (isPrismaUniqueViolation(error)) {
    return apiJson(409, {
      error: "Conflict",
      code: "conflict",
      reason: "A conflicting resource already exists.",
    });
  }

  console.error("[api] unhandled", error);
  return apiJson(500, {
    error: "Internal server error",
    code: "internal_error",
    reason: "Something went wrong. Please try again.",
  });
}

/**
 * Wrap an App Router handler so uncaught DB/runtime errors become structured JSON
 * instead of empty HTTP 500 bodies.
 */
export function withApiHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response> | Response
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      return mapUnknownErrorToResponse(error);
    }
  };
}
