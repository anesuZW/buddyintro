/**
 * Runtime PWA validation checks against a live production server.
 */
const fs = require("fs");
const path = require("path");
const { ROOT } = require("./paths");

function assertCheck(name, fn) {
  return { name, run: fn };
}

async function fetchOk(url, opts = {}) {
  const res = await fetch(url, {
    redirect: opts.followRedirect === false ? "manual" : "follow",
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15000),
    headers: opts.headers,
  });
  return res;
}

function readBuiltSw() {
  const swPath = path.join(ROOT, "public", "sw.js");
  if (!fs.existsSync(swPath)) throw new Error("public/sw.js missing — run npm run build");
  return fs.readFileSync(swPath, "utf8");
}

function buildArtifactChecks() {
  const required = [
    "public/sw.js",
    "public/workbox/workbox-sw.js",
    "public/workbox/workbox-background-sync.prod.js",
    "public/workbox/workbox-precaching.prod.js",
    "public/offline.html",
    "public/icons/icon-192.png",
    "public/icons/icon-512.png",
    "public/icons/maskable-icon-512.png",
    "public/icons/apple-touch-icon.png",
    "public/favicon.ico",
    "public/browserconfig.xml",
    ".next/BUILD_ID",
  ];

  return required.map((rel) =>
    assertCheck(`artifact: ${rel}`, () => {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) throw new Error(`Missing ${rel}`);
    })
  );
}

function buildSwSourceChecks() {
  const tokens = [
    "skipWaiting",
    "clients.claim",
    "navigationPreload",
    "setCatchHandler",
    "BackgroundSyncPlugin",
    "notificationclick",
    "notificationclose",
    "SKIP_WAITING",
    "buddyintro-offline-queue",
    "cleanupOutdatedCaches",
  ];

  return [
    assertCheck("built sw.js contains Workbox precache", () => {
      const sw = readBuiltSw();
      if (!/precache|workbox/i.test(sw)) throw new Error("sw.js missing Workbox precache");
    }),
    ...tokens.map((token) =>
      assertCheck(`built sw.js: ${token}`, () => {
        const sw = readBuiltSw();
        if (!sw.includes(token)) throw new Error(`sw.js missing "${token}"`);
      })
    ),
  ];
}

function buildHttpChecks(base) {
  const publicPaths = [
    "/sw.js",
    "/manifest.webmanifest",
    "/offline.html",
    "/workbox/workbox-sw.js",
    "/workbox/workbox-background-sync.prod.js",
    "/workbox/workbox-precaching.prod.js",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
    "/icons/maskable-icon-512.png",
    "/icons/apple-touch-icon.png",
    "/favicon.ico",
    "/browserconfig.xml",
  ];

  const checks = [];

  for (const p of publicPaths) {
    checks.push(
      assertCheck(`HTTP 200 ${p}`, async () => {
        const res = await fetchOk(`${base}${p}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      })
    );

    checks.push(
      assertCheck(`no auth redirect ${p}`, async () => {
        const res = await fetchOk(`${base}${p}`, { followRedirect: false });
        if (res.status === 301 || res.status === 302) {
          const loc = res.headers.get("location") || "";
          if (/login|signup|auth/i.test(loc)) {
            throw new Error(`Redirected to auth: ${loc}`);
          }
        }
      })
    );
  }

  checks.push(
    assertCheck("sw.js Cache-Control: no-cache", async () => {
      const res = await fetchOk(`${base}/sw.js`);
      const cc = (res.headers.get("cache-control") || "").toLowerCase();
      if (!cc.includes("no-cache") && !cc.includes("no-store")) {
        throw new Error(`Unexpected Cache-Control: ${cc || "(none)"}`);
      }
    }),

    assertCheck("sw.js Content-Type is JavaScript", async () => {
      const res = await fetchOk(`${base}/sw.js`);
      const ct = res.headers.get("content-type") || "";
      if (!/javascript|ecmascript/i.test(ct)) {
        throw new Error(`Unexpected Content-Type: ${ct}`);
      }
    }),

    assertCheck("manifest.webmanifest valid JSON", async () => {
      const res = await fetchOk(`${base}/manifest.webmanifest`);
      const json = await res.json();
      if (!json.name || !json.short_name) throw new Error("manifest missing name/short_name");
      if (!json.start_url) throw new Error("manifest missing start_url");
      if (json.display !== "standalone") throw new Error(`display=${json.display}`);
      if (!Array.isArray(json.icons) || json.icons.length < 4) {
        throw new Error("manifest needs multiple icons");
      }
    }),

    assertCheck("manifest: maskable icon", async () => {
      const json = await (await fetchOk(`${base}/manifest.webmanifest`)).json();
      const maskable = json.icons.filter((i) => i.purpose?.includes("maskable"));
      if (!maskable.length) throw new Error("no maskable icon in manifest");
    }),

    assertCheck("manifest: shortcuts (3+)", async () => {
      const json = await (await fetchOk(`${base}/manifest.webmanifest`)).json();
      if (!Array.isArray(json.shortcuts) || json.shortcuts.length < 3) {
        throw new Error(`shortcuts=${json.shortcuts?.length ?? 0}`);
      }
    }),

    assertCheck("manifest: screenshots", async () => {
      const json = await (await fetchOk(`${base}/manifest.webmanifest`)).json();
      if (!Array.isArray(json.screenshots) || !json.screenshots.length) {
        throw new Error("manifest missing screenshots");
      }
    }),

    assertCheck("manifest: share_target", async () => {
      const json = await (await fetchOk(`${base}/manifest.webmanifest`)).json();
      if (!json.share_target?.action) throw new Error("manifest missing share_target");
    }),

    assertCheck("manifest: protocol_handlers", async () => {
      const json = await (await fetchOk(`${base}/manifest.webmanifest`)).json();
      if (!Array.isArray(json.protocol_handlers) || !json.protocol_handlers.length) {
        throw new Error("manifest missing protocol_handlers");
      }
    }),

    assertCheck("manifest: launch_handler", async () => {
      const json = await (await fetchOk(`${base}/manifest.webmanifest`)).json();
      if (!json.launch_handler?.client_mode) throw new Error("manifest missing launch_handler");
    }),

    assertCheck("manifest: theme_color", async () => {
      const json = await (await fetchOk(`${base}/manifest.webmanifest`)).json();
      if (!json.theme_color) throw new Error("manifest missing theme_color");
    }),

    assertCheck("offline.html served", async () => {
      const res = await fetchOk(`${base}/offline.html`);
      const html = await res.text();
      if (!/offline|BuddyIntro|buddyintro/i.test(html)) {
        throw new Error("offline.html content unexpected");
      }
    }),

    assertCheck("login page links manifest", async () => {
      const res = await fetchOk(`${base}/login`);
      const html = await res.text();
      if (!html.includes("manifest")) throw new Error("login HTML missing manifest reference");
    }),

    assertCheck("share target API reachable", async () => {
      const res = await fetchOk(`${base}/api/share/target`, { followRedirect: false });
      if (res.status === 404) throw new Error("share target route missing");
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    }),

    assertCheck("push subscribe API exists", async () => {
      const res = await fetch(`${base}/api/push/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(10000),
      });
      if (res.status === 404) throw new Error("push subscribe route missing");
      if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
    })
  );

  return checks;
}

async function runBrowserPwaAudit(base) {
  let chromeLauncher;
  let puppeteer;
  try {
    chromeLauncher = require("chrome-launcher");
    puppeteer = require("puppeteer-core");
  } catch {
    throw new Error("Install devDependencies: npm install (chrome-launcher, puppeteer-core, @lhci/cli)");
  }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox"],
    userDataDir: false,
  });

  try {
    const browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${chrome.port}`,
      protocolTimeout: 180_000,
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(180_000);
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log(`  [browser error] ${msg.text()}`);
    });

    await page.goto(`${base}/offline.html`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) throw new Error("no serviceWorker");
      await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    });

    await page.waitForFunction(
      async () => {
        const reg = await navigator.serviceWorker.getRegistration("/");
        return !!reg?.active;
      },
      { timeout: 120_000, polling: 1000 }
    );

    const regValue = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      return {
        scope: reg?.scope,
        active: !!reg?.active,
        scriptURL: reg?.active?.scriptURL,
      };
    });
    if (!regValue?.active) throw new Error("SW not active after registration");

    const cacheNames = await page.evaluate(async () => {
      if (!("caches" in window)) return [];
      return caches.keys();
    });
    if (!cacheNames.length) {
      throw new Error("Cache Storage empty after SW registration");
    }

    const manifestHref = await page.evaluate(async () => {
      const res = await fetch("/manifest.webmanifest");
      return res.ok ? "/manifest.webmanifest" : null;
    });
    if (!manifestHref) throw new Error("Manifest not reachable");

    const badgeApi = await page.evaluate(() => "setAppBadge" in navigator);
    if (!badgeApi) {
      console.warn("  ⚠ Badging API not available in headless Chrome (optional)");
    }

    const skipWaitingOk = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const worker = reg.active || reg.waiting || reg.installing;
      if (!worker) return false;
      worker.postMessage({ type: "SKIP_WAITING" });
      return true;
    });
    if (!skipWaitingOk) throw new Error("SKIP_WAITING postMessage failed");

    await browser.close();
    return {
      registration: regValue,
      cacheNames,
      manifestHref,
      badgeApi,
    };
  } finally {
    await chrome.kill();
  }
}

async function runChecks(checks, label) {
  const results = [];
  console.log(`\n=== ${label} ===\n`);

  for (const check of checks) {
    try {
      await check.run();
      results.push({ name: check.name, ok: true });
      console.log(`  ✓ ${check.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ name: check.name, ok: false, error: msg });
      console.log(`  ✗ ${check.name}: ${msg}`);
    }
  }

  return results;
}

module.exports = {
  buildArtifactChecks,
  buildHttpChecks,
  buildSwSourceChecks,
  runBrowserPwaAudit,
  runChecks,
};
