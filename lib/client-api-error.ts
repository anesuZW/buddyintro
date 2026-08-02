/**
 * Map API JSON / fetch failures to user-safe toast copy.
 * Never prefer raw Error.message from unknown failures when a structured body exists.
 */

export type ClientApiErrorBody = {
  error?: string;
  code?: string;
  reason?: string;
};

const FRIENDLY_BY_CODE: Record<string, string> = {
  service_unavailable: "Service temporarily unavailable. Please retry shortly.",
  internal_error: "Something went wrong. Please try again.",
  validation_error: "Some of the information you entered is invalid.",
  invalid_json: "That request could not be understood. Please try again.",
  conflict: "That action conflicts with an existing item.",
  permission_denied: "You do not have permission to do that.",
  csrf_rejected: "Security check failed. Refresh the page and try again.",
};

export function friendlyApiMessage(
  body: ClientApiErrorBody | null | undefined,
  fallback = "Something went wrong. Please try again."
): string {
  if (!body) return fallback;
  if (body.code && FRIENDLY_BY_CODE[body.code]) return FRIENDLY_BY_CODE[body.code];
  if (body.reason && !looksInternal(body.reason)) return body.reason;
  if (body.error && !looksInternal(body.error)) return body.error;
  return fallback;
}

function looksInternal(text: string): boolean {
  return /prisma|postgres|ECONN|P100|stack|at\s+\S+\s|$|\/[a-z]+\/|SQL/i.test(text);
}

export async function readApiErrorBody(res: Response): Promise<ClientApiErrorBody> {
  try {
    return (await res.json()) as ClientApiErrorBody;
  } catch {
    return {};
  }
}
