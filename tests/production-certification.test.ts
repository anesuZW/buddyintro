/**
 * Production certification static audit — run via `npm run certify:production`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  AUTH_PUBLIC_PATH_PREFIXES,
  MIDDLEWARE_MATCHER,
  MIDDLEWARE_MATCHER_EXCLUDES,
  buildMiddlewareMatcher,
  isAuthPublicPath,
} from "../lib/middleware-public-paths";

const ROOT = path.resolve(import.meta.dirname, "..");

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function exists(rel: string) {
  return fs.existsSync(path.join(ROOT, rel));
}

describe("production certification — middleware public paths", () => {
  it("matcher literal covers all excludes", () => {
    for (const segment of MIDDLEWARE_MATCHER_EXCLUDES) {
      assert.match(MIDDLEWARE_MATCHER, new RegExp(segment.replace(".", "\\.")));
    }
  });

  it("excludes PWA and static assets from middleware matcher", () => {
    const required = ["sw.js", "manifest.webmanifest", "workbox/", "icons/", "uploads/", "_next/static"];
    for (const segment of required) {
      assert.ok(
        MIDDLEWARE_MATCHER_EXCLUDES.some((e) => e === segment || e.startsWith(segment)),
        `missing exclude: ${segment}`
      );
    }
    assert.match(buildMiddlewareMatcher(), /sw\.js/);
  });

  it("treats critical paths as auth-public", () => {
    const publicPaths = [
      "/sw.js",
      "/manifest.webmanifest",
      "/offline.html",
      "/icons/icon-192.png",
      "/uploads/avatar.jpg",
      "/workbox/workbox-sw.js",
    ];
    for (const p of publicPaths) {
      assert.equal(isAuthPublicPath(p), true, `expected public: ${p}`);
    }
    assert.equal(isAuthPublicPath("/home"), false);
  });

  it("middleware.ts inlines static matcher literal", () => {
    const mw = read("middleware.ts");
    assert.match(mw, /matcher:\s*\[\s*\n?\s*"\/\(\(\?!/);
    assert.doesNotMatch(mw, /MIDDLEWARE_MATCHER/);
  });

  it("supabase middleware uses isAuthPublicPath", () => {
    const sm = read("lib/supabase/middleware.ts");
    assert.match(sm, /isAuthPublicPath/);
    assert.doesNotMatch(sm, /pathname\.startsWith\("\/sw\.js"\)/);
  });
});

describe("production certification — PWA manifest & assets", () => {
  it("manifest defines installability features", () => {
    const manifest = read("app/manifest.ts");
    for (const token of [
      "shortcuts",
      "screenshots",
      "share_target",
      "protocol_handlers",
      "launch_handler",
      "maskable",
      "apple-touch-icon",
    ]) {
      assert.match(manifest, new RegExp(token.replace("-", "\\-")));
    }
  });

  it("root layout wires manifest, icons, and browserconfig", () => {
    const layout = read("app/layout.tsx");
    assert.match(layout, /manifest\.webmanifest/);
    assert.match(layout, /apple-touch-icon/);
    assert.match(layout, /browserconfig\.xml/);
    assert.match(layout, /viewportFit:\s*"cover"/);
  });

  const requiredAssets = [
    "public/favicon.ico",
    "public/browserconfig.xml",
    "public/offline.html",
    "public/icons/icon-192.png",
    "public/icons/icon-512.png",
    "public/icons/maskable-icon-512.png",
    "public/icons/apple-touch-icon.png",
    "public/workbox/workbox-background-sync.prod.js",
    "public/workbox/workbox-precaching.prod.js",
  ];

  for (const asset of requiredAssets) {
    it(`has ${asset}`, () => {
      assert.ok(exists(asset), `missing ${asset}`);
    });
  }
});

describe("production certification — service worker", () => {
  const sw = () => read("scripts/pwa/sw-source.js");

  it("implements update lifecycle and offline support", () => {
    const source = sw();
    for (const token of [
      "skipWaiting",
      "clients.claim",
      "navigationPreload",
      "setCatchHandler",
      "BackgroundSyncPlugin",
      "SKIP_WAITING",
      "notificationclick",
      "notificationclose",
    ]) {
      assert.match(source, new RegExp(token));
    }
  });

  it("build script outputs public/sw.js", () => {
    assert.ok(exists("scripts/build-sw.js"));
    if (exists("public/sw.js")) {
      const built = read("public/sw.js");
      assert.match(built, /workbox|precache/i);
    }
  });

  it("ServiceWorkerProvider registers only in production", () => {
    const provider = read("components/pwa/ServiceWorkerProvider.tsx");
    assert.match(provider, /NODE_ENV !== "production"/);
    assert.match(provider, /NOTIFICATION_CLICK/);
    assert.match(provider, /resolveNotificationUrl/);
  });
});

describe("production certification — push pipeline", () => {
  const pushRoutes = [
    "app/api/push/subscribe/route.ts",
    "app/api/push/unsubscribe/route.ts",
    "app/api/push/preferences/route.ts",
    "app/api/push/send/route.ts",
  ];

  for (const route of pushRoutes) {
    it(`has ${route}`, () => assert.ok(exists(route)));
  }

  it("push worker script exists for BullMQ delivery", () => {
    assert.ok(exists("scripts/push-worker.ts"));
    const eco = read("ecosystem.config.js");
    assert.match(eco, /push-worker/);
  });

  it("VAPID keys referenced in push service", () => {
    const svc = read("services/notifications/push-service.ts");
    assert.match(svc, /VAPID/);
  });
});

describe("production certification — frontend & security", () => {
  it("imports globals.css from root layout", () => {
    assert.match(read("app/layout.tsx"), /@\/styles\/globals\.css/);
  });

  it("locale layout applies font and PWA providers", () => {
    const layout = read("app/[locale]/layout.tsx");
    assert.match(layout, /appFont|PwaProviders/);
  });

  it("main layout reserves safe area for bottom nav", () => {
    const layout = read("app/[locale]/(main)/layout.tsx");
    assert.match(layout, /pb-nav/);
    assert.match(read("components/layout/BottomNav.tsx"), /safe-area-pb/);
  });

  it("next.config sets SW cache headers", () => {
    const cfg = read("next.config.js");
    assert.match(cfg, /\/sw\.js/);
    assert.match(cfg, /no-cache/);
    assert.match(cfg, /notifications=\(self\)/);
  });

  it("security headers include CSP and frame denial", () => {
    const sec = read("lib/security.ts");
    assert.match(sec, /Content-Security-Policy/);
    assert.match(sec, /frame-ancestors 'none'/);
    assert.match(sec, /X-Frame-Options/);
  });

  it("SEO routes exist", () => {
    assert.ok(exists("app/robots.ts"));
    assert.ok(exists("app/sitemap.ts"));
  });

  it("NotificationBell syncs app badge", () => {
    assert.match(read("components/notifications/NotificationBell.tsx"), /updateAppBadge/);
  });
});

describe("production certification — deployment", () => {
  it("uses standalone Next.js output", () => {
    assert.match(read("next.config.js"), /output:\s*"standalone"/);
  });

  it("ecosystem.config defines app and workers", () => {
    const eco = read("ecosystem.config.js");
    for (const name of ["buddyintro", "buddyintro-job-worker", "buddyintro-media-worker", "buddyintro-push-worker"]) {
      assert.match(eco, new RegExp(name));
    }
  });

  it("build pipeline includes PWA steps", () => {
    const pkg = JSON.parse(read("package.json"));
    assert.match(pkg.scripts.build, /generate-pwa-icons/);
    assert.match(pkg.scripts.build, /build-sw/);
    assert.match(pkg.scripts.build, /write-build-version/);
  });
});
