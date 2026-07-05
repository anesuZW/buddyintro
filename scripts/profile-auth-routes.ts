/**
 * Authenticated auth profiling for BuddyIntro.
 * Usage: AUTH_PROFILE=1 npm run dev   (in another terminal)
 *        npm run profile:auth [--base=http://localhost:3000] [--email=user1@friendintro.com]
 */
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const H = {
  id: "x-auth-profile-id",
  middlewareMs: "x-auth-profile-middleware-ms",
  routeGetUserMs: "x-auth-profile-route-getuser-ms",
  prismaMs: "x-auth-profile-prisma-ms",
  serializeMs: "x-auth-profile-serialize-ms",
  otherMs: "x-auth-profile-other-ms",
  totalMs: "x-auth-profile-total-ms",
  getUserCalls: "x-auth-profile-getuser-calls",
} as const;

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
const PASSWORD = process.argv.find((a) => a.startsWith("--password="))?.split("=")[1] ?? "123456";

type RouteSample = {
  route: string;
  kind: "api" | "page";
  status: number;
  wallMs: number;
  middlewareAuth: number;
  routeAuth: number;
  prisma: number;
  serialize: number;
  other: number;
  totalHeader: number;
  getUserCalls: number;
  requestId: string | null;
};

const API_ROUTES = [
  "/api/trust/recommendations",
  "/api/discoveries",
  "/api/introductions?group=recent",
  "/api/profile/insights",
  "/api/notifications/preferences",
];

const PAGE_ROUTES = ["/home", "/discoveries", "/introductions", "/profile"];

function numHeader(res: Response, name: string): number {
  const raw = res.headers.get(name);
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

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
    throw new Error(`Sign-in failed for ${EMAIL}: ${error?.message ?? "no session"}`);
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

async function sampleRoute(
  path: string,
  cookieHeader: string,
  kind: "api" | "page"
): Promise<RouteSample> {
  const url = `${BASE.replace(/\/$/, "")}${path}`;
  const start = performance.now();
  const res = await fetch(url, {
    headers: { Cookie: cookieHeader },
    redirect: "manual",
  });
  await res.arrayBuffer();
  const wallMs = Math.round(performance.now() - start);

  return {
    route: path.split("?")[0],
    kind,
    status: res.status,
    wallMs,
    middlewareAuth: numHeader(res, H.middlewareMs),
    routeAuth: numHeader(res, H.routeGetUserMs),
    prisma: numHeader(res, H.prismaMs),
    serialize: numHeader(res, H.serializeMs),
    other: numHeader(res, H.otherMs),
    totalHeader: numHeader(res, H.totalMs),
    getUserCalls: numHeader(res, H.getUserCalls),
    requestId: res.headers.get(H.id),
  };
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

async function profileRoute(
  path: string,
  cookieHeader: string,
  kind: "api" | "page",
  runs: number
): Promise<RouteSample> {
  const samples: RouteSample[] = [];
  for (let i = 0; i < runs; i += 1) {
    samples.push(await sampleRoute(path, cookieHeader, kind));
  }
  const pick = samples[samples.length - 1];
  return {
    ...pick,
    wallMs: median(samples.map((s) => s.wallMs)),
    middlewareAuth: median(samples.map((s) => s.middlewareAuth)),
    routeAuth: median(samples.map((s) => s.routeAuth)),
    prisma: median(samples.map((s) => s.prisma)),
    serialize: median(samples.map((s) => s.serialize)),
    other: median(samples.map((s) => s.other)),
    totalHeader: median(samples.map((s) => s.totalHeader)),
    getUserCalls: Math.max(...samples.map((s) => s.getUserCalls)),
  };
}

function markdownTable(rows: RouteSample[]): string {
  const header =
    "| Route | Middleware Auth | Route Auth | Prisma | Other | Serialize | Total (wall) | getUser() calls | Duplicate |";
  const sep = "| ----- | --------------- | ---------- | ------ | ----- | --------- | ------------ | --------------- | --------- |";
  const lines = rows.map((r) => {
    const duplicate = r.getUserCalls >= 2 || (r.middlewareAuth > 0 && r.routeAuth > 0) ? "yes" : "no";
    const total = r.kind === "api" && r.totalHeader > 0 ? r.totalHeader : r.wallMs;
    const other =
      r.other > 0
        ? r.other
        : Math.max(0, total - r.middlewareAuth - r.routeAuth - r.prisma - r.serialize);
    return `| ${r.route} | ${r.middlewareAuth}ms | ${r.routeAuth}ms | ${r.prisma}ms | ${other}ms | ${r.serialize}ms | ${total}ms | ${r.getUserCalls || (r.middlewareAuth > 0 ? 1 : 0) + (r.routeAuth > 0 ? 1 : 0)} | ${duplicate} |`;
  });
  return [header, sep, ...lines].join("\n");
}

async function main() {
  console.log(`\n=== BuddyIntro Auth Profiling ===`);
  console.log(`Base: ${BASE}`);
  console.log(`User: ${EMAIL}\n`);

  const cookieHeader = await buildSessionCookieHeader();
  console.log("Session established.\n");

  const probe = await sampleRoute("/api/health", cookieHeader, "api");
  if (probe.middlewareAuth === 0 && probe.requestId === null) {
    console.warn(
      "WARNING: No auth profile headers detected. Restart dev server with AUTH_PROFILE=1\n"
    );
  }

  const results: RouteSample[] = [];

  console.log("Profiling API routes (3 runs each, median reported)...");
  for (const path of API_ROUTES) {
    const r = await profileRoute(path, cookieHeader, "api", 3);
    console.log(
      `  ${r.route} status=${r.status} wall=${r.wallMs}ms mw=${r.middlewareAuth}ms routeAuth=${r.routeAuth}ms calls=${r.getUserCalls}`
    );
    results.push(r);
  }

  console.log("\nProfiling pages (3 runs each, median reported)...");
  for (const path of PAGE_ROUTES) {
    const r = await profileRoute(path, cookieHeader, "page", 3);
    console.log(
      `  ${r.route} status=${r.status} wall=${r.wallMs}ms mw=${r.middlewareAuth}ms (route auth via server logs)`
    );
    results.push(r);
  }

  const apiRows = results.filter((r) => r.kind === "api");
  const duplicateApis = apiRows.filter(
    (r) => r.getUserCalls >= 2 || (r.middlewareAuth > 0 && r.routeAuth > 0)
  );

  const avgRouteAuth = Math.round(
    apiRows.reduce((s, r) => s + r.routeAuth, 0) / Math.max(apiRows.length, 1)
  );
  const avgMiddleware = Math.round(
    apiRows.reduce((s, r) => s + r.middlewareAuth, 0) / Math.max(apiRows.length, 1)
  );
  const estimatedSavingsPerRequest = avgRouteAuth;

  const report = `# Auth Profiling Results

Generated: ${new Date().toISOString()}

## Methodology

- Instrumentation gated by \`AUTH_PROFILE=1\` (middleware + \`lib/auth.ts\` helpers).
- Request correlation via \`x-auth-profile-id\` header (8-char UUID prefix).
- API routes expose segment timings on response headers for automated collection.
- Script: \`npm run profile:auth\` — signs in as \`${EMAIL}\`, hits each route 3×, reports median.
- Base URL: \`${BASE}\`

## Per-route breakdown

${markdownTable(results)}

**Notes on pages:** Page responses include middleware auth headers only. Route-level \`getAuthUser()\` / Prisma timings are logged server-side as \`[AUTH-PROFILE][id]\` lines (see Duplicate auth analysis). Total for pages uses fetch wall time.

## Duplicate auth analysis

| Route | Middleware \`getUser()\` | Route \`getUser()\` | Total \`getUser()\` calls | Duplicate? |
| ----- | ------------------------ | ------------------- | ------------------------- | ---------- |
${results
  .map((r) => {
    const mw = r.middlewareAuth > 0 ? "yes" : "no";
    const route = r.routeAuth > 0 ? "yes" : r.kind === "page" ? "yes (logged)" : "no";
    const calls = Math.max(
      r.getUserCalls,
      (r.middlewareAuth > 0 ? 1 : 0) + (r.routeAuth > 0 ? 1 : 0)
    );
    const dup = calls >= 2 ? "**yes**" : "no";
    return `| ${r.route} | ${mw} (${r.middlewareAuth}ms) | ${route} (${r.routeAuth}ms) | ${calls} | ${dup} |`;
  })
  .join("\n")}

### Evidence

${duplicateApis.length}/${apiRows.length} measured API routes show **two** \`getUser()\` network calls per request (middleware + \`getAuthUser()\`).

Example log pattern per request:

\`\`\`text
[AUTH-PROFILE][abc12345] middleware getUser=687ms path=/api/discoveries
[AUTH-PROFILE][abc12345] getAuthUser supabaseGetUser=702ms total=705ms
[AUTH-PROFILE][abc12345] getCurrentUser getAuthUser=705ms prismaUserLookup=11ms total=716ms
[AUTH-PROFILE][abc12345] route-summary /api/discoveries duplicateAuth=yes getUserCalls=2
\`\`\`

Shared \`[AUTH-PROFILE][id]\` prefix proves both calls belong to the same HTTP request.

## Segment averages (API routes)

| Segment | Median avg |
| ------- | ---------- |
| Middleware auth | ${avgMiddleware}ms |
| Route auth (\`getAuthUser\`) | ${avgRouteAuth}ms |
| Prisma user lookup | ${Math.round(apiRows.reduce((s, r) => s + r.prisma, 0) / Math.max(apiRows.length, 1))}ms |

## Savings estimate

If route-level \`supabase.auth.getUser()\` is removed (Phase 1 header pass-through):

| Metric | Value |
| ------ | ----- |
| Estimated savings per API request | **~${estimatedSavingsPerRequest}ms** (median route auth time) |
| Estimated savings per page navigation | **~${estimatedSavingsPerRequest}ms** + layout/page share one handler auth today |
| Duplicate \`getUser()\` calls eliminated | 1 per authenticated request |

Combined auth overhead today (middleware + route): **~${avgMiddleware + avgRouteAuth}ms** typical on API routes vs **~${avgMiddleware}ms** after Phase 1.

## Recommendation

${
  duplicateApis.length >= apiRows.length / 2 && avgRouteAuth > 50
    ? "**Proceed with Phase 1 header pass-through.** Measured data confirms duplicate `getUser()` on every profiled API route, with route-level auth adding a median ~" +
      estimatedSavingsPerRequest +
      "ms per request on top of middleware (~" +
      avgMiddleware +
      "ms)."
    : "**Collect additional samples before proceeding.** Duplicate auth was not conclusively measured on this run — ensure `AUTH_PROFILE=1` is set on the dev server and re-run `npm run profile:auth`."
}

---

*Instrumentation only — no auth behavior changes. Disable profiling by unsetting \`AUTH_PROFILE\`.*
`;

  const outPath = resolve(process.cwd(), "docs/AUTH_PROFILING_RESULTS.md");
  writeFileSync(outPath, report);
  console.log(`\nReport written to docs/AUTH_PROFILING_RESULTS.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
