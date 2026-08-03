/**
 * Allow only same-app relative paths for post-auth redirects.
 * Rejects absolute URLs, protocol-relative `//…`, and backslash tricks.
 */
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback = "/home"
): string {
  if (!candidate) return fallback;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  // Block control characters / whitespace injection in the path.
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return fallback;
  return trimmed;
}
