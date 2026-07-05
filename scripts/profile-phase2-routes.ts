/**
 * Phase 2 route profiling — hits slow endpoints and reminds you to read server [PROFILE] logs.
 * Usage: PROFILE_PHASE2=1 npm run dev
 *        npm run profile:phase2 [--base=http://localhost:3000]
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
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";
const EMAIL =
  process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ??
  "user1@friendintro.com";
const PASSWORD =
  process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ?? "123456";
const RUNS = Number(process.argv.find((a) => a.startsWith("--runs="))?.split("=")[1] ?? 3);

async function buildSessionCookieHeader(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await authClient.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(`Sign-in failed: ${error?.message ?? "no session"}`);
  }

  const cookieJar: Record<string, string> = {};
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieJar[name];
      },
      set(name: string, value: string) {
        cookieJar[name] = value;
      },
      remove(name: string) {
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

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function timeFetch(url: string, cookie: string, redirect: RequestRedirect = "follow") {
  const start = performance.now();
  const res = await fetch(url, { headers: { Cookie: cookie }, redirect });
  await res.arrayBuffer();
  return { status: res.status, ms: Math.round(performance.now() - start) };
}

async function main() {
  const prisma = new PrismaClient();
  const cookie = await buildSessionCookieHeader();

  const me = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!me) throw new Error(`No user for ${EMAIL}`);

  const msg = await prisma.message.findFirst({
    where: { OR: [{ senderId: me.id }, { receiverId: me.id }] },
    select: { senderId: true, receiverId: true },
  });
  const otherUserId = msg
    ? msg.senderId === me.id
      ? msg.receiverId
      : msg.senderId
    : (await prisma.user.findFirst({ where: { NOT: { id: me.id } }, select: { id: true } }))?.id;

  const story = await prisma.story.findFirst({
    select: { mediaUrl: true },
  });
  let mediaPath = `${me.id}/image/avatar`;
  if (story?.mediaUrl) {
    if (story.mediaUrl.includes("path=")) {
      mediaPath = decodeURIComponent(story.mediaUrl.split("path=")[1] ?? mediaPath);
    } else {
      mediaPath = story.mediaUrl.replace(/^\/+/, "");
    }
  } else if (me.profilePicture?.includes("path=")) {
    mediaPath = decodeURIComponent(me.profilePicture.split("path=")[1] ?? mediaPath);
  }

  const routes: Array<{ label: string; path: string }> = [
    {
      label: "/api/messages/[userId]/context",
      path: otherUserId ? `/api/messages/${otherUserId}/context` : "",
    },
    { label: "/api/notifications/preferences", path: "/api/notifications/preferences" },
    { label: "/api/introduction-categories", path: "/api/introduction-categories" },
    {
      label: "/api/media",
      path: `/api/media?path=${encodeURIComponent(mediaPath)}`,
    },
  ];

  console.log(`\n=== Phase 2 profiling (wall clock) ===`);
  console.log(`Base: ${BASE}`);
  console.log(`Runs per route: ${RUNS}`);
  console.log(`Read [PROFILE] blocks in the dev server terminal.\n`);

  const wallResults: Array<{ route: string; status: number; wallMs: number }> = [];

  for (const route of routes) {
    if (!route.path) {
      console.log(`SKIP ${route.label} — no conversation partner found`);
      continue;
    }
    const samples: number[] = [];
    let status = 0;
    for (let i = 0; i < RUNS; i += 1) {
      const r = await timeFetch(`${BASE.replace(/\/$/, "")}${route.path}`, cookie);
      samples.push(r.ms);
      status = r.status;
    }
    const wallMs = median(samples);
    wallResults.push({ route: route.label, status, wallMs });
    console.log(`  ${route.label} status=${status} wall=${wallMs}ms (median of ${RUNS})`);
  }

  const summaryPath = resolve(process.cwd(), "docs/.phase2-wall-results.json");
  writeFileSync(summaryPath, JSON.stringify({ base: BASE, runs: RUNS, wallResults }, null, 2));
  console.log(`\nWall-clock summary written to docs/.phase2-wall-results.json`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
