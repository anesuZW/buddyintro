import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Singleton service-role Supabase client. NEVER import from client code.
 * Bypasses RLS — use only in trusted server contexts after app-level authorization.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (!adminClient) {
    adminClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return adminClient;
}

/** @deprecated Prefer getSupabaseAdminClient() — retained for existing call sites. */
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  return getSupabaseAdminClient();
}
