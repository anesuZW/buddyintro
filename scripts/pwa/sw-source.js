/**
 * Workbox service worker source — compiled to public/sw.js via scripts/build-sw.js
 * @see docs/PWA.md
 */

/* eslint-disable no-undef */
importScripts("/workbox/workbox-sw.js");

workbox.setConfig({ modulePathPrefix: "/workbox/" });

const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute, setCatchHandler, NavigationRoute } = workbox.routing;
const { StaleWhileRevalidate, CacheFirst, NetworkFirst, NetworkOnly } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { BackgroundSyncPlugin } = workbox.backgroundSync;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

const CACHE_VERSION = "buddyintro-pwa-v2";
const OFFLINE_URL = "/offline.html";

precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

// Navigation preload + offline fallback
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("buddyintro-") && k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
        )
      ),
      self.registration.navigationPreload?.enable?.(),
    ])
  );
});

const navigationHandler = new NetworkFirst({
  cacheName: `${CACHE_VERSION}-pages`,
  networkTimeoutSeconds: 4,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 48, maxAgeSeconds: 7 * 24 * 60 * 60 }),
  ],
});

registerRoute(new NavigationRoute(navigationHandler, { denylist: [/^\/api\//, /^\/uploads\//] }));

setCatchHandler(async ({ event }) => {
  if (event.request.destination === "document") {
    const cached = await caches.match(OFFLINE_URL);
    if (cached) return cached;
    return caches.match("/offline");
  }
  return Response.error();
});

// JS / CSS / fonts — stale-while-revalidate
registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font",
  new StaleWhileRevalidate({
    cacheName: `${CACHE_VERSION}-static`,
    plugins: [new ExpirationPlugin({ maxEntries: 96, maxAgeSeconds: 30 * 24 * 60 * 60 })],
  })
);

// Icons, images, avatars, thumbnails — cache first
registerRoute(
  ({ request, url }) =>
    request.destination === "image" ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/uploads/") ||
    url.pathname.includes("avatar"),
  new CacheFirst({
    cacheName: `${CACHE_VERSION}-images`,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// Fresh API data — network first (never cache auth)
registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith("/api/") &&
    request.method === "GET" &&
    !url.pathname.startsWith("/api/auth") &&
    !url.pathname.includes("/session"),
  new NetworkFirst({
    cacheName: `${CACHE_VERSION}-api`,
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 5 * 60 }),
    ],
  })
);

// Auth/session — network only
registerRoute(
  ({ url }) => url.pathname.startsWith("/api/auth") || url.pathname.includes("/session"),
  new NetworkOnly()
);

// Background sync for failed POST mutations
const postSyncPlugin = new BackgroundSyncPlugin("buddyintro-post-queue", {
  maxRetentionTime: 24 * 60,
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
      } catch {
        await queue.unshiftRequest(entry);
        throw new Error("Sync retry failed");
      }
    }
  },
});

registerRoute(
  ({ url, request }) =>
    request.method === "POST" &&
    url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/api/auth"),
  new NetworkOnly({ plugins: [postSyncPlugin] }),
  "POST"
);

// --- Web Push ---

const DEFAULT_PUSH = {
  title: "BuddyIntro",
  body: "You have a new notification",
  url: "/notifications",
  tag: "buddyintro",
};

function parsePushData(event) {
  const base = { ...DEFAULT_PUSH };
  if (!event.data) return base;
  try {
    const parsed = event.data.json();
    return {
      title: parsed.title || base.title,
      body: parsed.body || parsed.message || base.body,
      url: parsed.url || base.url,
      tag: parsed.tag || parsed.type || base.tag,
      actions: parsed.actions,
      badge: parsed.badge,
      icon: parsed.icon,
      data: parsed.data || {},
    };
  } catch {
    return { ...base, body: event.data.text() || base.body };
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushData(event);
  const actions = payload.actions || [
    { action: "view", title: "View" },
    { action: "dismiss", title: "Dismiss" },
  ];

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || "/icons/icon-192.png",
      badge: payload.badge || "/icons/icon-192.png",
      tag: payload.tag,
      data: { url: payload.url, ...(payload.data || {}) },
      actions: actions.slice(0, 2),
      vibrate: [100, 50, 100],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action;
  if (action === "dismiss") return;

  const data = event.notification.data || {};
  let url = data.url || "/notifications";

  if (action === "reply" && data.replyUrl) url = data.replyUrl;
  if (action === "accept" && data.acceptUrl) url = data.acceptUrl;
  if (action === "view-story" && data.storyUrl) url = data.storyUrl;
  if (action === "discoveries" && data.discoveriesUrl) url = data.discoveriesUrl;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.postMessage({ type: "NOTIFICATION_CLICK", url, action });
          if ("navigate" in client) return client.navigate(url).then(() => client.focus());
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("notificationclose", (event) => {
  const data = event.notification?.data || {};
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    clients.forEach((c) =>
      c.postMessage({ type: "NOTIFICATION_CLOSE", tag: event.notification?.tag, data })
    );
  });
});

// Periodic sync
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "buddyintro-refresh") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "PERIODIC_SYNC", tag: event.tag }));
      })
    );
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "buddyintro-offline-queue") {
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: "BACKGROUND_SYNC", tag: event.tag }));
      })
    );
  }
});
