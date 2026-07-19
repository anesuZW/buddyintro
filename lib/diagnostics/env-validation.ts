import {
  isProductionEnv,
  validateProductionMediaRoot,
} from "@/lib/storage/media-root";

export type EnvValidationResult = {
  ok: boolean;
  missing: string[];
  warnings: string[];
};

const REQUIRED = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL",
  "MEDIA_PROVIDER",
] as const;

const REQUIRED_LOCAL_MEDIA = ["MEDIA_ROOT"] as const;

const OPTIONAL_WARN_IF_MISSING = [
  "REDIS_URL",
  "RESEND_API_KEY",
  "SMTP_HOST",
  "VAPID_PRIVATE_KEY",
] as const;

/** Validate critical environment variables. Throws in production when misconfigured. */
export function validateEnvironment(options?: { strict?: boolean }): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]?.trim()) missing.push(key);
  }

  const mediaProvider = (process.env.MEDIA_PROVIDER || "local").toLowerCase();
  if (mediaProvider === "local") {
    for (const key of REQUIRED_LOCAL_MEDIA) {
      if (!process.env[key]?.trim()) missing.push(key);
    }

    if (isProductionEnv()) {
      try {
        validateProductionMediaRoot();
      } catch (err) {
        missing.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  for (const key of OPTIONAL_WARN_IF_MISSING) {
    if (!process.env[key]?.trim()) warnings.push(`${key} not set`);
  }

  const strict = options?.strict ?? process.env.NODE_ENV === "production";
  if (strict && missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return { ok: missing.length === 0, missing, warnings };
}
