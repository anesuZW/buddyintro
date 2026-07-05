/**
 * Profile /api/media signed-URL cache — first vs repeat request + image-heavy page.
 * Usage: PROFILE_PHASE2=1 npm run dev
 *        npm run profile:media [--base=http://localhost:3000]
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
const MEDIA_RUNS = Number(
  process.argv.find((a) => a.startsWith("--media-runs="))?.split("=")[1] ?? 5
);

type MediaSample = {
  wallMs: number;
  status: number;
  cache: string | null;
  cacheLookupMs: number;
  createSignedUrlMs: number;
};

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

async function sampleMedia(url: string, cookie: string): Promise<MediaSample> {
  const start = performance.now();
  const res = await fetch(url, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  await res.arrayBuffer();
  return {
    wallMs: Math.round(performance.now() - start),
    status: res.status,
    cache: res.headers.get("x-media-cache"),
    cacheLookupMs: Number(res.headers.get("x-media-cache-lookup-ms") ?? 0),
    createSignedUrlMs: Number(res.headers.get("x-media-create-signed-url-ms") ?? 0),
  };
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function main() {
  const prisma = new PrismaClient();
  const cookie = await buildSessionCookieHeader();
  const me = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!me) throw new Error(`No user for ${EMAIL}`);

  const story = await prisma.story.findFirst({ select: { mediaUrl: true } });
  let mediaPath = `${me.id}/image/avatar`;
  if (story?.mediaUrl) {
    if (story.mediaUrl.includes("path=")) {
      mediaPath = decodeURIComponent(story.mediaUrl.split("path=")[1] ?? mediaPath);
    } else {
      mediaPath = story.mediaUrl.replace(/^\/+/, "");
    }
  }

  const mediaUrl = `${BASE.replace(/\/$/, "")}/api/media?path=${encodeURIComponent(mediaPath)}`;

  console.log(`\n=== Media cache profiling ===`);
  console.log(`Base: ${BASE}`);
  console.log(`Path: ${mediaPath}`);
  console.log(`Runs: ${MEDIA_RUNS}\n`);

  const samples: MediaSample[] = [];
  for (let i = 0; i < MEDIA_RUNS; i += 1) {
    const s = await sampleMedia(mediaUrl, cookie);
    samples.push(s);
    console.log(
      `  run ${i + 1}: status=${s.status} wall=${s.wallMs}ms cache=${s.cache ?? "?"} lookup=${s.cacheLookupMs}ms sign=${s.createSignedUrlMs}ms`
    );
  }

  const hits = samples.filter((s) => s.cache === "hit").length;
  const misses = samples.filter((s) => s.cache === "miss").length;
  const first = samples[0];
  const repeats = samples.slice(1);
  const repeatHits = repeats.filter((s) => s.cache === "hit");

  console.log(`\n--- Same-path repeat (${MEDIA_RUNS - 1} after first) ---`);
  console.log(`  cache hits: ${hits}/${samples.length}`);
  console.log(`  cache misses: ${misses}/${samples.length}`);
  console.log(`  hit ratio: ${(hits / samples.length).toFixed(2)}`);

  console.log(`\n--- First request (cache miss expected) ---`);
  console.log(`  wall=${first.wallMs}ms createSignedUrl=${first.createSignedUrlMs}ms`);

  if (repeatHits.length) {
    console.log(`\n--- Repeated requests (cache hit) ---`);
    console.log(
      `  wall median=${median(repeatHits.map((s) => s.wallMs))}ms sign median=${median(repeatHits.map((s) => s.createSignedUrlMs))}ms lookup median=${median(repeatHits.map((s) => s.cacheLookupMs))}ms`
    );
  }

  console.log(`\n--- Image-heavy page: /home (wall clock, includes SSR media refs) ---`);
  const pageSamples: number[] = [];
  for (let i = 0; i < 3; i += 1) {
    const t0 = performance.now();
    const res = await fetch(`${BASE.replace(/\/$/, "")}/home`, {
      headers: { Cookie: cookie },
    });
    await res.text();
    const ms = Math.round(performance.now() - t0);
    pageSamples.push(ms);
    console.log(`  run ${i + 1}: status=${res.status} wall=${ms}ms`);
  }
  console.log(`  median wall=${median(pageSamples)}ms`);

  const report = {
    base: BASE,
    mediaPath,
    runs: MEDIA_RUNS,
    samples,
    summary: {
      hitRatio: hits / samples.length,
      firstRequest: {
        wallMs: first.wallMs,
        createSignedUrlMs: first.createSignedUrlMs,
        cacheLookupMs: first.cacheLookupMs,
      },
      repeatRequest: repeatHits.length
        ? {
            wallMsMedian: median(repeatHits.map((s) => s.wallMs)),
            createSignedUrlMsMedian: median(repeatHits.map((s) => s.createSignedUrlMs)),
            cacheLookupMsMedian: median(repeatHits.map((s) => s.cacheLookupMs)),
          }
        : null,
      homePageWallMsMedian: median(pageSamples),
    },
  };

  writeFileSync(
    resolve(process.cwd(), "docs/.phase2a-media-profile.json"),
    JSON.stringify(report, null, 2)
  );
  console.log(`\nResults written to docs/.phase2a-media-profile.json`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
