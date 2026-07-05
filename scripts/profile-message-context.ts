/**
 * Profile /api/messages/[userId]/context handler segments.
 * Usage: PROFILE_PHASE2=1 npm run start (or dev)
 *        npm run profile:message-context [--base=http://localhost:3000] [--runs=5]
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { PrismaClient } from "@prisma/client";

function loadEnvFile() {
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

loadEnvFile();

const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ??
  "http://localhost:3000";
const EMAIL =
  process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ??
  "user1@friendintro.com";
const PASSWORD =
  process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ?? "123456";
const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 5);

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function buildSessionCookieHeader(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env");

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error || !data.session) throw new Error(`Sign-in failed: ${error?.message}`);

  const cookieJar: Record<string, string> = {};
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get: (name) => cookieJar[name],
      set: (name, value) => {
        cookieJar[name] = value;
      },
      remove: (name) => {
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

async function main() {
  const prisma = new PrismaClient();
  const cookie = await buildSessionCookieHeader();
  const me = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!me) throw new Error(`No user ${EMAIL}`);

  const msg = await prisma.message.findFirst({
    where: { OR: [{ senderId: me.id }, { receiverId: me.id }] },
    select: { senderId: true, receiverId: true },
  });
  const otherUserId = msg
    ? msg.senderId === me.id
      ? msg.receiverId
      : msg.senderId
    : (await prisma.user.findFirst({ where: { NOT: { id: me.id } }, select: { id: true } }))
        ?.id;
  if (!otherUserId) throw new Error("No conversation partner");

  const path = `/api/messages/${otherUserId}/context`;
  const url = `${BASE.replace(/\/$/, "")}${path}`;
  const wall: number[] = [];
  const benchTotal: number[] = [];
  const benchPrisma: number[] = [];

  console.log(`\n=== Message context profile ===`);
  console.log(`URL: ${url}`);
  console.log(`Runs: ${RUNS}`);
  console.log(`Read server [PROFILE] logs for prisma query breakdown.\n`);

  for (let i = 0; i < RUNS; i += 1) {
    const start = performance.now();
    const res = await fetch(url, { headers: { Cookie: cookie } });
    await res.arrayBuffer();
    wall.push(Math.round(performance.now() - start));
    benchTotal.push(Number(res.headers.get("x-bench-total-ms") ?? 0));
    benchPrisma.push(Number(res.headers.get("x-bench-prisma-ms") ?? 0));
    console.log(
      `  run ${i + 1} status=${res.status} wall=${wall[wall.length - 1]}ms ` +
        `handler=${benchTotal[benchTotal.length - 1]}ms prisma=${benchPrisma[benchPrisma.length - 1]}ms`
    );
  }

  const summary = {
    base: BASE,
    path,
    runs: RUNS,
    wallMs: median(wall),
    handlerMs: median(benchTotal),
    prismaMs: median(benchPrisma),
  };
  const out = resolve(process.cwd(), "docs/.message-context-profile.json");
  writeFileSync(out, JSON.stringify(summary, null, 2));
  console.log(`\nMedian wall=${summary.wallMs}ms handler=${summary.handlerMs}ms prisma=${summary.prismaMs}ms`);
  console.log(`Written to docs/.message-context-profile.json\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
