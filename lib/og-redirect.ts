import { appUrl } from "@/lib/utils";

function allowedRedirectHosts(): Set<string> {
  const hosts = new Set<string>();

  const addUrlHost = (raw: string | undefined | null) => {
    if (!raw) return;
    try {
      hosts.add(new URL(raw).hostname.toLowerCase());
    } catch {
      /* ignore invalid env */
    }
  };

  addUrlHost(process.env.NEXT_PUBLIC_APP_URL);
  addUrlHost(process.env.CDN_URL);
  addUrlHost(process.env.MEDIA_S3_PUBLIC_BASE_URL);
  addUrlHost(process.env.MEDIA_B2_PUBLIC_BASE_URL);
  addUrlHost(process.env.MEDIA_R2_PUBLIC_BASE_URL);
  addUrlHost(process.env.NEXT_PUBLIC_SUPABASE_URL);

  return hosts;
}

function isTrustedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (allowedRedirectHosts().has(host)) return true;
  // Supabase project storage / signed URL hosts
  if (host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) return true;
  return false;
}

/**
 * Returns a safe absolute URL for OG image redirects, or null when the
 * candidate must not be used (open-redirect / untrusted host).
 */
export function safeOgImageRedirectUrl(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const trimmed = candidate.trim();

  // Same-app relative asset / media paths
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    if (
      trimmed.startsWith("/icons/") ||
      trimmed.startsWith("/uploads/") ||
      trimmed.startsWith("/api/media")
    ) {
      return appUrl(trimmed);
    }
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!isTrustedMediaHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function brandOgFallbackUrl() {
  return appUrl("/icons/icon-512.png");
}
