import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SIM_EMAIL_DOMAIN } from "@/lib/simulation/constants";

export function loadEnvFile() {
  for (const file of [".env.local", ".env"]) {
    const envPath = resolve(process.cwd(), file);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export const prisma = new PrismaClient();

export function createSupabaseAdmin(): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  return withRetry(async () => {
    let page = 1;
    while (page <= 50) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (match) return match.id;
      if (data.users.length < 200) break;
      page += 1;
    }
    return null;
  }, 3, 1000);
}

export async function deleteSimulationAuthUsers(supabase: SupabaseClient): Promise<number> {
  let removed = 0;
  for (let pass = 0; pass < 100; pass += 1) {
    const { data, error } = await withRetry(
      () => supabase.auth.admin.listUsers({ page: 1, perPage: 200 }),
      3,
      1000
    );
    if (error) throw error;
    const simUsers = data.users.filter((u) => u.email?.endsWith(SIM_EMAIL_DOMAIN));
    if (!simUsers.length) break;
    for (const user of simUsers) {
      try {
        await withRetry(() => supabase.auth.admin.deleteUser(user.id), 3, 500);
        removed += 1;
      } catch {
        // ignore
      }
    }
  }
  return removed;
}

export async function deleteSimulationUsers(supabase: SupabaseClient): Promise<number> {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SIM_EMAIL_DOMAIN } },
    select: { id: true, email: true },
  });

  const ids = users.map((u) => u.id);
  if (ids.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  for (const user of users) {
    try {
      await withRetry(() => supabase.auth.admin.deleteUser(user.id), 3, 500);
    } catch {
      // user may already be gone from auth
    }
  }

  const orphanAuthRemoved = await deleteSimulationAuthUsers(supabase);
  return users.length + orphanAuthRemoved;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry transient Supabase/network failures during bulk simulation seeding. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 5,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) {
        await sleep(baseDelayMs * 2 ** i);
      }
    }
  }
  throw lastError;
}
