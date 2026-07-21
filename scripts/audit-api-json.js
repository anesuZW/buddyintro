#!/usr/bin/env node
/**
 * Smoke test: API routes must return JSON (never HTML login redirect).
 */
const { ensureProductionServer, stopServer } = require("./lib/audit-server");

const API_PATHS = [
  "/api/discoveries",
  "/api/posts",
  "/api/stories",
  "/api/messages",
  "/api/profile",
  "/api/analytics/track",
  "/api/introductions",
  "/api/feed",
  "/api/notifications",
];

async function checkApi(base, path) {
  const res = await fetch(`${base}${path}`, {
    headers: { Accept: "application/json" },
    redirect: "manual",
  });
  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const isRedirect = res.status >= 300 && res.status < 400;
  const location = res.headers.get("location") || "";
  const bodyPreview = isJson ? await res.json().catch(() => null) : (await res.text()).slice(0, 80);

  return {
    path,
    status: res.status,
    isJson,
    isRedirect,
    location,
    ok: isJson && !isRedirect && (res.status === 401 || res.status === 200 || res.status === 405),
    bodyPreview,
  };
}

async function main() {
  console.log("\n=== API JSON smoke test ===\n");
  const urlArg = process.argv.find((a) => a.startsWith("--url="));
  const base = urlArg?.split("=")[1]?.replace(/\/$/, "") || "";

  let boot;
  if (base) {
    boot = { base, child: null, started: false };
    console.log(`Using server at ${base}\n`);
  } else {
    boot = await ensureProductionServer();
  }
  let failed = 0;

  try {
    for (const path of API_PATHS) {
      const r = await checkApi(boot.base, path);
      const mark = r.ok ? "✓" : "✗";
      console.log(`${mark} ${path} → ${r.status} ${r.isJson ? "JSON" : "NOT JSON"}${r.isRedirect ? ` redirect→${r.location}` : ""}`);
      if (!r.ok) {
        failed++;
        console.log(`    preview: ${JSON.stringify(r.bodyPreview)}`);
      }
    }

    // /en/api/* is invalid — must 404 or redirect away from locale-prefixed API paths
    const localeProbe = await fetch(`${boot.base}/en/api/discoveries`, { redirect: "manual" });
    const loc = localeProbe.headers.get("location") || "";
    const localeOk =
      localeProbe.status === 404 ||
      (localeProbe.status >= 300 &&
        localeProbe.status < 400 &&
        !loc.includes("/login") &&
        (loc.includes("/api/discoveries") || loc === "/api/discoveries"));
    console.log(`${localeOk ? "✓" : "✗"} /en/api/discoveries → ${localeProbe.status}${loc ? ` → ${loc}` : ""}`);
    if (!localeOk) failed++;

    console.log(failed ? `\nFAILED — ${failed} issue(s)\n` : "\nPASSED — all API routes return JSON\n");
    process.exit(failed ? 1 : 0);
  } finally {
    if (boot.started) await stopServer(boot.child);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
