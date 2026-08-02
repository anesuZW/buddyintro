/**
 * RC1 authenticated API smoke tests.
 * Usage: npx tsx scripts/rc1-api-smoke.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key]) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  }
}
loadEnv();

const BASE = process.argv.find((a) => a.startsWith("--base="))?.split("=")[1] ?? "http://localhost:3000";
const EMAIL = "user1@friendintro.com";
const PASSWORD = "123456";

type Result = { name: string; status: number; ms: number; ok: boolean; detail?: string };

async function login(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error || !data.session) throw new Error(error?.message ?? "login failed");

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

async function req(
  cookie: string,
  path: string,
  init?: RequestInit
): Promise<{ status: number; ms: number; body: unknown }> {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Cookie: cookie,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* text */
  }
  return { status: res.status, ms: Math.round(performance.now() - t0), body };
}

async function main() {
  console.log(`RC1 API smoke — ${BASE} as ${EMAIL}\n`);
  const cookie = await login();
  console.log("Login OK\n");

  const results: Result[] = [];

  async function check(name: string, path: string, init?: RequestInit, expect = 200) {
    const r = await req(cookie, path, init);
    const ok = r.status === expect || (expect === 200 && r.status === 201);
    results.push({ name, status: r.status, ms: r.ms, ok, detail: ok ? undefined : JSON.stringify(r.body).slice(0, 200) });
    console.log(`${ok ? "✓" : "✗"} ${name} ${r.status} ${r.ms}ms`);
    return r;
  }

  await check("GET /api/health", "/api/health");
  await check("GET /api/feed", "/api/feed");
  await check("GET /api/discoveries", "/api/discoveries");
  await check("GET /api/notifications?limit=5", "/api/notifications?limit=5");
  await check("GET /api/introductions?group=recent", "/api/introductions?group=recent");

  const msgList = await check("GET /api/messages (list)", "/api/messages");
  const conversations =
    (msgList.body as { items?: { otherUser: { id: string; name: string }; unreadCount: number }[] })?.items ??
    [];
  const jordanConvo = conversations.find((c) => c.otherUser.name.includes("Jordan"));
  if (jordanConvo) {
    console.log(`  → Jordan thread: /messages/${jordanConvo.otherUser.id} (unread: ${jordanConvo.unreadCount})`);
    await check(
      "GET /api/messages/[userId]/context",
      `/api/messages/${jordanConvo.otherUser.id}/context`
    );
    await check("POST /api/messages", "/api/messages", {
      method: "POST",
      body: JSON.stringify({
        receiverId: jordanConvo.otherUser.id,
        message: `RC1 smoke ${Date.now()}`,
      }),
    });
  }

  // Security: unauthenticated reads should fail closed
  const unauthFeed = await fetch(`${BASE}/api/feed`);
  const unauthOk = unauthFeed.status === 401;
  results.push({
    name: "GET /api/feed unauthenticated → 401",
    status: unauthFeed.status,
    ms: 0,
    ok: unauthOk,
  });
  console.log(`${unauthOk ? "✓" : "✗"} GET /api/feed unauthenticated → ${unauthFeed.status}`);

  const unauthDisc = await fetch(`${BASE}/api/discoveries`);
  const unauthDiscOk = unauthDisc.status === 401;
  results.push({
    name: "GET /api/discoveries unauthenticated → 401",
    status: unauthDisc.status,
    ms: 0,
    ok: unauthDiscOk,
  });
  console.log(`${unauthDiscOk ? "✓" : "✗"} GET /api/discoveries unauthenticated → ${unauthDisc.status}`);

  const healthPublic = await fetch(`${BASE}/api/health`);
  const healthOk = healthPublic.status === 200;
  results.push({ name: "GET /api/health public", status: healthPublic.status, ms: 0, ok: healthOk });
  console.log(`${healthOk ? "✓" : "✗"} GET /api/health public → ${healthPublic.status}`);

  const disc = await check("GET /api/discoveries (posts)", "/api/discoveries");
  const posts = (disc.body as { posts?: { id: string; content?: string }[] })?.posts ?? [];
  const jordan = posts.find((p) => p.content?.includes("disc-jordan-brunch"));
  const qaPost = posts.find((p) => p.content?.includes("QA audit discovery"));

  if (jordan) {
    await check("POST like", `/api/discoveries/${jordan.id}/like`, { method: "POST" });
    await check("POST like again (toggle)", `/api/discoveries/${jordan.id}/like`, { method: "DELETE" });
    await check("POST bookmark", `/api/discoveries/${jordan.id}/bookmark`, { method: "POST" });
    await check("POST share", `/api/discoveries/${jordan.id}/share`, { method: "POST" });
    if (qaPost) {
      await check("POST comment", `/api/discoveries/${qaPost.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: "RC1 smoke comment" }),
      }, 201);
    }
  } else {
    console.log("⚠ No jordan discovery post for interaction tests");
  }

  const png = readFileSync(resolve(process.cwd(), "public/qa/test-upload.png"));
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "rc1-test.png");
  form.append("kind", "image");
  const uploadT0 = performance.now();
  const uploadRes = await fetch(`${BASE}/api/media/upload`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const uploadMs = Math.round(performance.now() - uploadT0);
  const uploadOk = uploadRes.status === 200;
  results.push({ name: "POST /api/media/upload", status: uploadRes.status, ms: uploadMs, ok: uploadOk });
  console.log(`${uploadOk ? "✓" : "✗"} POST /api/media/upload ${uploadRes.status} ${uploadMs}ms`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  ${f.name}: ${f.status} ${f.detail ?? ""}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
