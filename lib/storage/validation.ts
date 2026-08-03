import { z } from "zod";

function isTrustedAbsoluteMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) return true;

    const bases = [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.CDN_URL,
      process.env.MEDIA_S3_PUBLIC_BASE_URL,
      process.env.MEDIA_B2_PUBLIC_BASE_URL,
      process.env.MEDIA_R2_PUBLIC_BASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ];
    for (const base of bases) {
      if (!base) continue;
      try {
        if (new URL(base).hostname.toLowerCase() === host) return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  } catch {
    return false;
  }
}

/** Accept proxy paths, /uploads paths, trusted absolute media URLs, or raw storage paths. */
export const storedMediaUrlSchema = z.union([
  z.string().url().refine(isTrustedAbsoluteMediaUrl, {
    message: "Media URL host is not allowed",
  }),
  z.string().regex(/^\/api\/media\?path=/),
  z.string().regex(/^\/uploads\//),
  z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(image|video|audio)\/.+/i
  ),
  z.string().regex(/^thumbnails\/[0-9a-f-]{36}\/(image|video|audio)\/.+/i),
  z.string().regex(/^(images|videos|audio)\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/.+/i),
  z.string().regex(/^thumbnails\/\d{4}\/\d{2}\/[0-9a-f-]{36}\/.+/i),
]);

export const optionalStoredMediaUrlSchema = storedMediaUrlSchema.nullable().optional();
