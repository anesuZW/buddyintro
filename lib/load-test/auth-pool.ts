import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { SIM_EMAIL_DOMAIN, SIM_PASSWORD } from "@/lib/simulation/constants";
import type { AuthSession } from "@/lib/load-test/types";

const POOL_CACHE = resolve(process.cwd(), "docs/.load-test-auth-pool.json");

function simEmail(index: number): string {
  return `sim-${index}${SIM_EMAIL_DOMAIN}`;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function buildCookieForEmail(email: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password: SIM_PASSWORD,
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("rate limit") && attempt < 8) {
        await sleep(1500 * attempt);
        continue;
      }
      throw new Error(`Sign-in failed for ${email}: ${error.message}`);
    }
    if (!data.session) throw new Error(`Sign-in failed for ${email}: no session`);

    const cookieJar: Record<string, string> = {};
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        get: (name: string) => cookieJar[name],
        set: (name: string, value: string) => {
          cookieJar[name] = value;
        },
        remove: (name: string) => {
          delete cookieJar[name];
        },
      },
    });
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    return Object.entries(cookieJar)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  throw new Error(`Sign-in failed for ${email}: exhausted retries`);
}

function saveCachedPool(sessions: AuthSession[]) {
  mkdirSync(resolve(process.cwd(), "docs"), { recursive: true });
  writeFileSync(
    POOL_CACHE,
    JSON.stringify({ generatedAt: new Date().toISOString(), sessions }, null, 2)
  );
}

function loadCachedPool(): AuthSession[] | null {
  if (!existsSync(POOL_CACHE)) return null;
  try {
    const data = JSON.parse(readFileSync(POOL_CACHE, "utf8")) as {
      generatedAt: string;
      sessions: AuthSession[];
    };
    const ageMs = Date.now() - new Date(data.generatedAt).getTime();
    if (ageMs > 3 * 60 * 60 * 1000) return null;
    return data.sessions.length ? data.sessions : null;
  } catch {
    return null;
  }
}

export async function buildAuthPool(size: number): Promise<AuthSession[]> {
  const cached = loadCachedPool();
  const startIndex = cached?.length ?? 0;
  if (startIndex >= size) {
    console.log(`  auth pool ${size} loaded from cache`);
    return cached!.slice(0, size);
  }
  if (startIndex > 0) {
    console.log(`  resuming auth pool from ${startIndex}/${size}`);
  }

  const prisma = new PrismaClient();
  const pool: AuthSession[] = cached ? [...cached] : [];

  try {
    for (let i = startIndex; i < size; i += 1) {
      const email = simEmail(i);
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) {
        console.warn(`  skip ${email} — not in DB`);
        continue;
      }

      const msg = await prisma.message.findFirst({
        where: { OR: [{ senderId: user.id }, { receiverId: user.id }] },
        select: { senderId: true, receiverId: true },
      });
      const otherUserId = msg
        ? msg.senderId === user.id
          ? msg.receiverId
          : msg.senderId
        : (
            await prisma.user.findFirst({
              where: { NOT: { id: user.id }, email: { endsWith: SIM_EMAIL_DOMAIN } },
              select: { id: true },
            })
          )?.id ?? null;

      const cookie = await buildCookieForEmail(email);
      pool.push({
        email,
        cookie,
        userId: user.id,
        messageContextPath: otherUserId ? `/api/messages/${otherUserId}/context` : null,
      });

      if ((i + 1) % 5 === 0) {
        process.stdout.write(`  auth pool ${pool.length}/${size}\r`);
        saveCachedPool(pool);
      }
      await sleep(350);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(`  auth pool ${pool.length}/${size} ready`);
  if (!pool.length) throw new Error("No simulation auth sessions — run seed:simulation first");
  saveCachedPool(pool);
  return pool;
}
