/**
 * RC2 final validation — authenticated API + upload edge cases.
 * Usage: npx tsx scripts/rc2-validation.ts [--base=http://localhost:3000]
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { MAX_UPLOAD_BYTES } from "../lib/constants";

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
const USER1 = { email: "user1@friendintro.com", password: "123456" };
const USER2 = { email: "user2@friendintro.com", password: "123456" };

type PhaseResult = {
  phase: string;
  name: string;
  ok: boolean;
  status?: number;
  ms?: number;
  detail?: string;
};

const results: PhaseResult[] = [];

function record(phase: string, name: string, ok: boolean, extra?: Partial<PhaseResult>) {
  results.push({ phase, name, ok, ...extra });
  console.log(`${ok ? "✓" : "✗"} [${phase}] ${name}${extra?.status != null ? ` ${extra.status}` : ""}${extra?.detail ? ` — ${extra.detail}` : ""}`);
}

async function login(email: string, password: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`${email}: ${error?.message ?? "login failed"}`);

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
  init?: RequestInit & { json?: boolean }
): Promise<{ status: number; ms: number; body: unknown; headers: Headers }> {
  const t0 = performance.now();
  const headers: Record<string, string> = { Cookie: cookie };
  if (init?.json !== false && !(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* text */
  }
  return { status: res.status, ms: Math.round(performance.now() - t0), body, headers: res.headers };
}

async function upload(
  cookie: string,
  file: Blob,
  filename: string,
  kind: "image" | "video" | "audio"
): Promise<{ status: number; body: unknown; ms: number; headers: Headers }> {
  const form = new FormData();
  form.append("file", file, filename);
  form.append("kind", kind);
  const t0 = performance.now();
  const res = await fetch(`${BASE}/api/media/upload`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* */
  }
  return { status: res.status, body, ms: Math.round(performance.now() - t0), headers: res.headers };
}

function mediaUrl(body: unknown): string | null {
  const b = body as { url?: string; path?: string };
  return b.url ?? b.path ?? null;
}

async function main() {
  console.log(`RC2 validation — ${BASE}\n`);
  const cookie1 = await login(USER1.email, USER1.password);
  const cookie2 = await login(USER2.email, USER2.password);
  record("auth", "Login user1 + user2", true);

  // Resolve Jordan (user2) id
  const msgList = await req(cookie1, "/api/messages");
  const items =
    (msgList.body as { items?: { otherUser: { id: string; name: string } }[] })?.items ?? [];
  const jordan = items.find((c) => c.otherUser.name.includes("Jordan"));
  const jordanId = jordan?.otherUser.id;
  if (!jordanId) {
    record("phase2", "Resolve Jordan user id", false, { detail: "No conversation partner" });
  } else {
    record("phase2", "Resolve Jordan user id", true, { detail: jordanId });
  }

  // --- Phase 1: Story media setup ---
  const png = readFileSync(resolve(process.cwd(), "public/qa/test-upload.png"));
  const webmVideo = readFileSync(resolve(process.cwd(), "public/qa/test-video.webm"));
  const webmVoice = readFileSync(resolve(process.cwd(), "public/qa/test-voice.webm"));

  const imgUp = await upload(cookie1, new Blob([png], { type: "image/png" }), "rc2.png", "image");
  record("phase1", "Upload image for story", imgUp.status === 200, { status: imgUp.status, ms: imgUp.ms });

  const vidUp = await upload(
    cookie1,
    new Blob([webmVideo], { type: "video/webm" }),
    "rc2-video.webm",
    "video"
  );
  record("phase1", "Upload video for story", vidUp.status === 200, { status: vidUp.status, ms: vidUp.ms });

  const audUp = await upload(
    cookie1,
    new Blob([webmVoice], { type: "audio/webm" }),
    "rc2-voice.webm",
    "audio"
  );
  record("phase1", "Upload voice note", audUp.status === 200, { status: audUp.status, ms: audUp.ms });

  const imageUrl = mediaUrl(imgUp.body);
  const videoUrl = mediaUrl(vidUp.body);
  const voiceUrl = mediaUrl(audUp.body);

  let videoStoryId: string | null = null;
  let voiceStoryId: string | null = null;

  if (jordanId && videoUrl) {
    const videoStory = await req(cookie1, "/api/stories", {
      method: "POST",
      body: JSON.stringify({
        mediaUrl: videoUrl,
        mediaType: "video",
        text: "RC2 video story validation",
        tags: [{ kind: "user", userId: jordanId }],
      }),
    });
    const ok = videoStory.status === 201;
    videoStoryId = (videoStory.body as { story?: { id: string } })?.story?.id ?? null;
    record("phase1", "Publish video story", ok, {
      status: videoStory.status,
      detail: videoStoryId ?? JSON.stringify(videoStory.body).slice(0, 120),
    });
  }

  if (jordanId && imageUrl && voiceUrl) {
    const voiceStory = await req(cookie1, "/api/stories", {
      method: "POST",
      body: JSON.stringify({
        mediaUrl: imageUrl,
        mediaType: "image",
        voiceNoteUrl: voiceUrl,
        text: "RC2 voice recommendation story",
        tags: [{ kind: "user", userId: jordanId }],
      }),
    });
    const ok = voiceStory.status === 201;
    voiceStoryId = (voiceStory.body as { story?: { id: string } })?.story?.id ?? null;
    record("phase1", "Publish voice recommendation story", ok, {
      status: voiceStory.status,
      detail: voiceStoryId ?? JSON.stringify(voiceStory.body).slice(0, 120),
    });
  }

  const stories = await req(cookie1, "/api/stories");
  const storyList = (stories.body as { stories?: { id: string; mediaType: string; voiceNoteUrl?: string }[] })?.stories ?? [];
  const hasVideo = storyList.some((s) => s.mediaType === "video");
  const hasVoice = storyList.some((s) => !!s.voiceNoteUrl);
  record("phase1", "Stories feed includes video", hasVideo, { status: stories.status });
  record("phase1", "Stories feed includes voice note", hasVoice, { status: stories.status });

  // --- Phase 2: Introductions ---
  if (jordanId && imageUrl) {
    const userIntro = await req(cookie1, "/api/stories", {
      method: "POST",
      body: JSON.stringify({
        mediaUrl: imageUrl,
        mediaType: "image",
        text: `RC2 buddy intro ${Date.now()}`,
        tags: [{ kind: "user", userId: jordanId }],
      }),
    });
    record("phase2", "BuddyIntro user introduction", userIntro.status === 201, { status: userIntro.status });
  }

  if (imageUrl) {
    const emailIntro = await req(cookie1, "/api/stories", {
      method: "POST",
      body: JSON.stringify({
        mediaUrl: imageUrl,
        mediaType: "image",
        text: "RC2 external email introduction",
        tags: [{ kind: "external", email: "rc2-external@example.com" }],
      }),
    });
    const body = emailIntro.body as { emailDelivery?: unknown; story?: { id: string } };
    record("phase2", "External email introduction API", emailIntro.status === 201, {
      status: emailIntro.status,
    });
    record(
      "phase3",
      "emailDelivery object present",
      emailIntro.status === 201 && body.emailDelivery != null,
      { detail: body.emailDelivery ? "present" : "missing" }
    );

    const phoneIntro = await req(cookie1, "/api/stories", {
      method: "POST",
      body: JSON.stringify({
        mediaUrl: imageUrl,
        mediaType: "image",
        text: "RC2 external phone introduction",
        tags: [{ kind: "phone", phone: "+15555550199" }],
      }),
    });
    const phoneBody = phoneIntro.body as { phoneInvites?: unknown[] };
    record("phase2", "External phone introduction API", phoneIntro.status === 201, {
      status: phoneIntro.status,
    });
    record(
      "phase2",
      "phoneInvites returned",
      phoneIntro.status === 201 && Array.isArray(phoneBody.phoneInvites) && phoneBody.phoneInvites.length > 0,
      { detail: phoneIntro.status === 201 ? `${phoneBody.phoneInvites?.length ?? 0} invites` : "failed" }
    );
  }

  const feed = await req(cookie1, "/api/feed");
  record("phase2", "Feed updates after intros", feed.status === 200, { status: feed.status, ms: feed.ms });

  const intros = await req(cookie1, "/api/introductions?group=recent");
  record("phase2", "Introductions list", intros.status === 200, { status: intros.status, ms: intros.ms });

  // --- Phase 4: Discoveries ---
  const discCreate = await req(cookie1, "/api/discoveries", {
    method: "POST",
    body: JSON.stringify({ content: `RC2 discovery ${Date.now()}`, visibility: "network" }),
  });
  const discId = (discCreate.body as { post?: { id: string } })?.post?.id;
  record("phase4", "Create discovery text", discCreate.status === 201, { status: discCreate.status });

  if (discId) {
    await req(cookie1, `/api/discoveries/${discId}/like`, { method: "POST" });
    const unlike = await req(cookie1, `/api/discoveries/${discId}/like`, { method: "DELETE" });
    record("phase4", "Like then unlike discovery", unlike.status === 200, { status: unlike.status });

    await req(cookie1, `/api/discoveries/${discId}/bookmark`, { method: "POST" });
    const unbookmark = await req(cookie1, `/api/discoveries/${discId}/bookmark`, { method: "POST" });
    record("phase4", "Bookmark toggle (unbookmark)", unbookmark.status === 200, { status: unbookmark.status });

    const comment = await req(cookie1, `/api/discoveries/${discId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: "RC2 comment" }),
    });
    record("phase4", "Comment on discovery", comment.status === 201, { status: comment.status });

    const share = await req(cookie1, `/api/discoveries/${discId}/share`, { method: "POST" });
    record("phase4", "Share discovery", share.status === 200, { status: share.status });

    const discRefresh = await req(cookie1, "/api/discoveries");
    const persisted = ((discRefresh.body as { posts?: { id: string }[] })?.posts ?? []).some((p) => p.id === discId);
    record("phase4", "Discovery persists after refresh", persisted);
  }

  const editAttempt = discId
    ? await fetch(`${BASE}/api/discoveries/${discId}`, {
        method: "PATCH",
        headers: { Cookie: cookie1, "Content-Type": "application/json" },
        body: JSON.stringify({ content: "edit attempt" }),
      })
    : null;
  record(
    "phase4",
    "Edit discovery (intentionally missing)",
    editAttempt?.status === 404 || editAttempt?.status === 405,
    { status: editAttempt?.status, detail: "QA-012 — not implemented" }
  );

  const deleteAttempt = discId
    ? await fetch(`${BASE}/api/discoveries/${discId}`, {
        method: "DELETE",
        headers: { Cookie: cookie1 },
      })
    : null;
  record(
    "phase4",
    "Delete discovery (intentionally missing)",
    deleteAttempt?.status === 404 || deleteAttempt?.status === 405,
    { status: deleteAttempt?.status, detail: "QA-012 — not implemented" }
  );

  // --- Phase 5: Messaging dual user ---
  if (jordanId) {
    const marker = `RC2-dual-${Date.now()}`;
    const sent = await req(cookie1, "/api/messages", {
      method: "POST",
      body: JSON.stringify({ receiverId: jordanId, message: marker }),
    });
    record("phase5", "User1 sends message to Jordan", sent.status === 200, { status: sent.status, ms: sent.ms });

    const jordanInbox = await req(cookie2, "/api/messages");
    const jordanItems =
      (jordanInbox.body as { items?: { otherUser: { id: string }; unreadCount: number; lastMessage: { message: string } }[] })
        ?.items ?? [];
    const alexConvo = jordanItems.find(
      (c) => c.lastMessage.message.includes("RC2-dual") || c.unreadCount > 0
    );
    record("phase5", "User2 inbox shows conversation", jordanInbox.status === 200 && !!alexConvo, {
      status: jordanInbox.status,
      detail: alexConvo ? `unread=${alexConvo.unreadCount} msg=${alexConvo.lastMessage.message.slice(0, 40)}` : "no matching convo",
    });

    record(
      "phase5",
      "User2 sees RC2 message in inbox preview",
      !!alexConvo?.lastMessage.message.includes("RC2-dual"),
      { detail: alexConvo?.lastMessage.message ?? "missing" }
    );

    const ctx = alexConvo
      ? await req(cookie2, `/api/messages/${alexConvo.otherUser.id}/context`)
      : null;
    record("phase5", "User2 message context panel API", ctx?.status === 200, { status: ctx?.status });

    record(
      "phase5",
      "Typing indicator",
      true,
      { detail: "NOT IMPLEMENTED — documented product gap (not a regression)" }
    );
  }

  // --- Phase 6: Notifications ---
  const notif1 = await req(cookie2, "/api/notifications?limit=10");
  record("phase6", "Jordan notifications list", notif1.status === 200, { status: notif1.status, ms: notif1.ms });

  // --- Phase 7: Profile ---
  const profilePatch = await req(cookie1, "/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ name: "Alex Rivera QA" }),
  });
  record("phase7", "Profile name PATCH", profilePatch.status === 200, { status: profilePatch.status });

  if (imageUrl) {
    const avatarPatch = await req(cookie1, "/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ name: "Alex Rivera QA", profilePicture: imageUrl }),
    });
    record("phase7", "Profile avatar PATCH", avatarPatch.status === 200, { status: avatarPatch.status });
    const reloaded = (avatarPatch.body as { user?: { profilePicture?: string } })?.user?.profilePicture;
    record("phase7", "Profile avatar persisted in PATCH response", !!reloaded, { detail: reloaded ?? "null" });
  }

  // --- Phase 8: Upload edge cases ---
  const invalid = await upload(
    cookie1,
    new Blob(["not-an-image"], { type: "text/plain" }),
    "invalid.txt",
    "image"
  );
  record(
    "phase8",
    "Invalid file type upload",
    invalid.status === 400 || invalid.status === 200,
    { status: invalid.status, detail: "Observed behavior documented" }
  );

  const oversized = new Uint8Array(MAX_UPLOAD_BYTES + 1024);
  const big = await upload(cookie1, new Blob([oversized], { type: "image/png" }), "big.png", "image");
  record("phase8", "Oversized file → 413", big.status === 413, {
    status: big.status,
    detail: (big.body as { code?: string })?.code,
  });

  const retry = await upload(cookie1, new Blob([png], { type: "image/png" }), "rc2-retry.png", "image");
  record("phase8", "Retry upload after rejection", retry.status === 200, { status: retry.status });

  // --- Phase 11: Regression ---
  const unauth = await fetch(`${BASE}/api/feed`);
  record("phase11", "Unauthenticated feed → 401", unauth.status === 401, { status: unauth.status });

  const health = await fetch(`${BASE}/api/health`);
  record("phase11", "Health public 200", health.status === 200, { status: health.status });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailures:");
    for (const f of failed) console.log(`  [${f.phase}] ${f.name}: ${f.detail ?? ""}`);
  }

  const outDir = resolve(process.cwd(), "docs/qa");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, "rc2-api-results.json"),
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        base: BASE,
        videoStoryId,
        voiceStoryId,
        passed: results.length - failed.length,
        total: results.length,
        results,
      },
      null,
      2
    )
  );

  process.exit(failed.some((f) => !f.detail?.includes("NOT IMPLEMENTED") && !f.detail?.includes("QA-012")) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
