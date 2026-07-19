import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectBrowserLocale, resolveLocale } from "../lib/i18n/resolve-locale";
import {
  formatMessage,
  getMessageValue,
  loadMessages,
  translateMessage,
} from "../lib/i18n/messages";
import { isRtlLocale, locales } from "../i18n/routing";

describe("locale detection", () => {
  it("prefers user profile language over browser and cookie", () => {
    assert.equal(
      resolveLocale({
        userPreferredLanguage: "fr",
        cookieLocale: "es",
        acceptLanguage: "de-DE,de;q=0.9",
        requestLocale: "pt",
      }),
      "fr"
    );
  });

  it("uses explicit cookie before browser fallback", () => {
    assert.equal(
      resolveLocale({
        cookieLocale: "ja",
        acceptLanguage: "ko-KR,ko;q=0.9",
      }),
      "ja"
    );
  });

  it("falls back to browser language", () => {
    assert.equal(detectBrowserLocale("es-ES,es;q=0.9,en;q=0.8"), "es");
  });

  it("falls back to English when nothing matches", () => {
    assert.equal(resolveLocale({ acceptLanguage: "xx-YY" }), "en");
  });
});

describe("message bundles", () => {
  it("loads translation bundles lazily per locale", async () => {
    const es = await loadMessages("es");
    const ja = await loadMessages("ja");
    assert.equal(getMessageValue(es, "nav.home"), "Inicio");
    assert.equal(getMessageValue(ja, "nav.home"), "ホーム");
  });

  it("formats interpolated notification messages", async () => {
    const message = await translateMessage("en", "notifications.introductionReceivedMessage", {
      authorName: "Alex",
      appName: "BuddyIntro",
    });
    assert.match(message, /Alex introduced you/);
  });

  it("uses fallback path for missing keys in production mode", () => {
    const messages = { common: { ok: "OK" } };
    assert.equal(getMessageValue(messages, "missing.key"), "missing.key");
  });

  it("builds localized notification copy", async () => {
    const title = await translateMessage("es", "notifications.introductionReceivedTitle");
    const message = await translateMessage("es", "notifications.introductionReceivedMessage", {
      authorName: "María",
      appName: "BuddyIntro",
    });
    assert.equal(title, "Nueva presentación");
    assert.match(message, /María/);
  });
});

describe("RTL support", () => {
  it("marks Arabic as RTL", () => {
    assert.equal(isRtlLocale("ar"), true);
    assert.equal(isRtlLocale("en"), false);
  });

  it("supports all configured locales", () => {
    assert.equal(locales.length, 10);
  });
});

describe("message formatting", () => {
  it("replaces template tokens", () => {
    assert.equal(formatMessage("Hello {name}", { name: "Sam" }), "Hello Sam");
  });
});
