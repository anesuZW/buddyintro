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

precacheAndRoute([{"revision":"65850a373e258f1c897a2b3d75eb74de","url":"/_next/static/media/e4af272ccee01ff0-s.p.woff2"},{"revision":"d54db44de5ccb18886ece2fda72bdfe0","url":"/_next/static/media/df0a9ae256c0569c-s.woff2"},{"revision":"027a89e9ab733a145db70f09b8a18b42","url":"/_next/static/media/c5fe6dc8356a8c31-s.woff2"},{"revision":"9e494903d6b0ffec1a1e14d34427d44d","url":"/_next/static/media/ba9851c3c22cd980-s.woff2"},{"revision":"01ba6c2a184b8cba08b0d57167664d75","url":"/_next/static/media/8e9860b6e62d6359-s.woff2"},{"revision":"4e2553027f1d60eff32898367dd4d541","url":"/_next/static/media/21350d82a1f187e9-s.woff2"},{"revision":"9dda5cfc9a46f256d0e131bb535e46f8","url":"/_next/static/media/19cfc7226ec3afaa-s.woff2"},{"revision":"b404e23d62d95bafd03ad7747cc0e88b","url":"/_next/static/kWS945l503nANrMS3l3BU/_ssgManifest.js"},{"revision":"0ea7e7088aabf697ba3d8aa8c7b54a89","url":"/_next/static/kWS945l503nANrMS3l3BU/_buildManifest.js"},{"revision":"b52ffa41cae20876a9c5cd5aafd0ef10","url":"/_next/static/css/80cf67a7af72320f.css"},{"revision":"301a60207949167ac1c650da444fa4be","url":"/_next/static/css/00a5b1e5ce393a8b.css"},{"revision":"a5d2bf1eedd74ce902bce64d97531922","url":"/_next/static/chunks/webpack-032ddbc34c0671fd.js"},{"revision":"846118c33b2c0e922d7b3a7676f81f6f","url":"/_next/static/chunks/polyfills-42372ed130431b0a.js"},{"revision":"184b201dc1d563e9f940a9c7dfd39d54","url":"/_next/static/chunks/main-app-59f91b9442addfd8.js"},{"revision":"e5eb5a850bd0f475720e93ccef26b996","url":"/_next/static/chunks/main-5a3fe32f3169ed85.js"},{"revision":"2ed92eafa0e9bf63026671d301f4736d","url":"/_next/static/chunks/framework-a63c59c368572696.js"},{"revision":"d8fc5211bd219c6626f5dff87e023148","url":"/_next/static/chunks/fd9d1056-f3c5f4be60681c42.js"},{"revision":"765d42d0d2be2af17dca76bcb681d1a4","url":"/_next/static/chunks/9064-e4b4d231a638e362.js"},{"revision":"943dadcaeb80da755e1365841fc8f74a","url":"/_next/static/chunks/7292-dcd6adf0a633b9e9.js"},{"revision":"97b45e183de40fc246b4cecc64f9931b","url":"/_next/static/chunks/7218-8825ff43f52a40a5.js"},{"revision":"63c1e446993128056a70fcb79c8164c1","url":"/_next/static/chunks/6575-61820d853a35d84a.js"},{"revision":"832bd3c4fb5796b1c25b57feae042329","url":"/_next/static/chunks/5955.4ef1a619943288b3.js"},{"revision":"a86dc952802ef5e6bb7523d81b8ea0e6","url":"/_next/static/chunks/521-e31f993340b46815.js"},{"revision":"fde8c00ae53c8bf8d75bac0dc164c03f","url":"/_next/static/chunks/44530001-c49f2e08a548d7b4.js"},{"revision":"5fa62d9844d141026b45b419fb59ef1d","url":"/_next/static/chunks/4157-cb59d98d10bffcf8.js"},{"revision":"788ed32a84de09e6af3f1418f46ccd71","url":"/_next/static/chunks/4036-4488b6fc83984954.js"},{"revision":"a721eac6466bde0f28d481250a5cdfb4","url":"/_next/static/chunks/3906-44894da9280374f8.js"},{"revision":"5d42cb6c11a7b69b9bf54c403835e6a0","url":"/_next/static/chunks/3819-76f21b4093d3474a.js"},{"revision":"21a5732078a35d54d4c3dee1efe0a039","url":"/_next/static/chunks/2972-2d408d622acd8d79.js"},{"revision":"3469707762b9b884b8c3c2c5608f98eb","url":"/_next/static/chunks/2692-2b18467ec51f4b16.js"},{"revision":"e01a165b1ce79eeb575ad5d83125be36","url":"/_next/static/chunks/2473-b63de7820426ad83.js"},{"revision":"0893c8c05d3c53fc5ec18af0da0a22ff","url":"/_next/static/chunks/2117-533c5d06721ef2f2.js"},{"revision":"470642ed129e4a26b75f50dc0b3e84e8","url":"/_next/static/chunks/1604.5dede0d2ba838ccf.js"},{"revision":"8f5c315ac86f4f6bb98f88f3992a51bc","url":"/_next/static/chunks/1181-36a2b23d078b05ef.js"},{"revision":"363a6fafc5978e5f149cd6c36b4104f6","url":"/_next/static/chunks/pages/_error-7ce03bcf1df914ce.js"},{"revision":"73c10cb4d01ae14e0b72c721b7e486f5","url":"/_next/static/chunks/pages/_app-78ddf957b9a9b996.js"},{"revision":"b626a06a68ff8646792b595b629f0ec6","url":"/_next/static/chunks/app/layout-fa10e2950134d2bb.js"},{"revision":"b4633cc528052209bdfa74b6c78b77e0","url":"/_next/static/chunks/app/_not-found/page-3a2c6ee0cd864a12.js"},{"revision":"a0c7e6b38008628d10ac839fd7306daf","url":"/_next/static/chunks/app/[locale]/page-10f1011f9a67591d.js"},{"revision":"e568255ed41e9fc70aae891768617bad","url":"/_next/static/chunks/app/[locale]/layout-605e53a924d13768.js"},{"revision":"8ec525f98e3b0a57749208d1ef6f487d","url":"/_next/static/chunks/app/[locale]/terms/page-bb0e975140058600.js"},{"revision":"9ce2f762f0da109b9039c6375114b59a","url":"/_next/static/chunks/app/[locale]/privacy/page-ae10aa551515542a.js"},{"revision":"4c1769450dbfdac4c7de9dd300b08a25","url":"/_next/static/chunks/app/[locale]/offline/page-238d661dedd7ec1e.js"},{"revision":"708e4ef6a12cc5a2db8e13c4a8a17032","url":"/_next/static/chunks/app/[locale]/invite-preview/[token]/page-fd864c077a5a9783.js"},{"revision":"9b7ec5ed11debcd3c72c4099c6285df7","url":"/_next/static/chunks/app/[locale]/invite/[token]/page-64bdde58fa25a960.js"},{"revision":"7a521ace4ffbbec7b409431334b6a09b","url":"/_next/static/chunks/app/[locale]/cookies/page-ff7e573b5833a10b.js"},{"revision":"c08425c9e919e62fc59f35d1336ad84e","url":"/_next/static/chunks/app/[locale]/(main)/layout-c2d609803b91794b.js"},{"revision":"edde4529dd704b387de5b734ccc8aa88","url":"/_next/static/chunks/app/[locale]/(main)/error-095200c810806237.js"},{"revision":"bf103bbd4c8753475ce3c386cf10110a","url":"/_next/static/chunks/app/[locale]/(main)/stories/page-cbf8854b15c39ad6.js"},{"revision":"9e6d84f8bf33769c9bdd187fa53f2c86","url":"/_next/static/chunks/app/[locale]/(main)/stories/[userId]/page-10c038724b6d0e57.js"},{"revision":"7c62c4893a237faade5cbf42f6ffbd1f","url":"/_next/static/chunks/app/[locale]/(main)/stories/view/[storyId]/page-61cc879774ee3e03.js"},{"revision":"54dbeab56cb77e35d6f1fe7f352e5e4f","url":"/_next/static/chunks/app/[locale]/(main)/share/page-f9ac9454ad72516c.js"},{"revision":"24a0a4083874a41d22638a35b4df34a8","url":"/_next/static/chunks/app/[locale]/(main)/profile/page-88150d51201b39d9.js"},{"revision":"a35886389d9c8dfad5eb157f53da8aae","url":"/_next/static/chunks/app/[locale]/(main)/profile/[id]/page-57a1d71a3ab0296b.js"},{"revision":"8837393ed1cc99e1e27de62fef5517ba","url":"/_next/static/chunks/app/[locale]/(main)/notifications/page-a4b418bbbdd80f81.js"},{"revision":"7139a8e01e5af73ea3fe5a5c4790834f","url":"/_next/static/chunks/app/[locale]/(main)/messages/page-e9117746ebeca52a.js"},{"revision":"d05d4efd92ab4e31f6671284e21312f0","url":"/_next/static/chunks/app/[locale]/(main)/messages/[userId]/page-f9953b4e36e972d0.js"},{"revision":"0e8c791a8643dfb805d7995ac18eda6c","url":"/_next/static/chunks/app/[locale]/(main)/maindash/page-aad502a8e094c6f8.js"},{"revision":"c7b48f01c86db798e6e95a058ced15e2","url":"/_next/static/chunks/app/[locale]/(main)/maindash/layout-906aff3456babfe2.js"},{"revision":"79ec82458b647f92d891133fd657f155","url":"/_next/static/chunks/app/[locale]/(main)/maindash/trust-risk/page-56dcf81cc911fad5.js"},{"revision":"ecbef163c867b0020812782fd826aadd","url":"/_next/static/chunks/app/[locale]/(main)/maindash/system-health/page-a10f43c821697710.js"},{"revision":"c2e63ff1e25e1a3b53b6c00e24b494b3","url":"/_next/static/chunks/app/[locale]/(main)/maindash/system/page-a2212761f4e6b4ae.js"},{"revision":"0463f79ebf5521b9f67d7163a5e93445","url":"/_next/static/chunks/app/[locale]/(main)/maindash/storage/page-abbc800b39c05972.js"},{"revision":"f3ec04b1032def80d6d2684e320343b0","url":"/_next/static/chunks/app/[locale]/(main)/maindash/security/page-6812f0b07675458f.js"},{"revision":"e0ed8f63b991e6194bbcd665bcf4668a","url":"/_next/static/chunks/app/[locale]/(main)/maindash/performance/page-4923673912e74268.js"},{"revision":"946d9cd928323fabfe25df7e3d1d41db","url":"/_next/static/chunks/app/[locale]/(main)/maindash/jobs/page-68acc455ce3eac4d.js"},{"revision":"ca0870f149b3bc546de7f8314e8bd35f","url":"/_next/static/chunks/app/[locale]/(main)/maindash/audit/page-c8f46c3bcf5be769.js"},{"revision":"dcba9c082f87b61523581e15dc87cced","url":"/_next/static/chunks/app/[locale]/(main)/maindash/admin-users/page-f9670ff847d45e93.js"},{"revision":"56c7499df19dad789fe722b1a85251b5","url":"/_next/static/chunks/app/[locale]/(main)/introductions/page-7c5f935e2a8b50eb.js"},{"revision":"d64ce968d8a834b88d8b0818373f10a4","url":"/_next/static/chunks/app/[locale]/(main)/introductions/[id]/page-b03d7d6572e2f636.js"},{"revision":"52ff18b0710fd57f22ae7c00e9099cca","url":"/_next/static/chunks/app/[locale]/(main)/introductions/sent/page-7cef6ceac79fcdd1.js"},{"revision":"c40aa480c2721b3c9e7f254844967c27","url":"/_next/static/chunks/app/[locale]/(main)/introductions/network/page-df9e77a0c17082df.js"},{"revision":"6f8bdc88efcbf5076918385f8cbb5a74","url":"/_next/static/chunks/app/[locale]/(main)/introductions/mutual/page-26e81a6213c37229.js"},{"revision":"aa67f8b3c78390bb2be78ef4452c7a10","url":"/_next/static/chunks/app/[locale]/(main)/home/page-f5f42d16c2f713ce.js"},{"revision":"9ddac17fe387282e540a64b32347151d","url":"/_next/static/chunks/app/[locale]/(main)/discoveries/page-7b0941b630719346.js"},{"revision":"e294a91bbed55af8369ecc43c209738c","url":"/_next/static/chunks/app/[locale]/(main)/create-story/page-1f3f86205ce9825e.js"},{"revision":"e7b0d2194402d48e923d948e644fbb22","url":"/_next/static/chunks/app/[locale]/(main)/admin/page-d53b52c84d98d088.js"},{"revision":"4e899232bafd50aa3656b5ae75fb548a","url":"/_next/static/chunks/app/[locale]/(main)/admin/layout-1f4140ddb717520b.js"},{"revision":"a251abc2e8d989fef23276e8e7763d9f","url":"/_next/static/chunks/app/[locale]/(auth)/layout-a0821bc8808f0640.js"},{"revision":"64dd4969ab1ecb419c8b9797751b9e62","url":"/_next/static/chunks/app/[locale]/(auth)/signup/page-16f674c37492a99d.js"},{"revision":"1d47a9ec84e187428c477bf65740bcac","url":"/_next/static/chunks/app/[locale]/(auth)/login/page-70d3a4ef673952fd.js"},{"revision":"dev","url":"/offline.html"},{"revision":"dev","url":"/icons/icon-192.png"},{"revision":"dev","url":"/icons/icon-512.png"},{"revision":"dev","url":"/icons/icon-512.svg"},{"revision":"dev","url":"/icons/apple-touch-icon.png"},{"revision":"dev","url":"/favicon.ico"}] || []);
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
