import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPushPayload,
  isValidPushEndpoint,
  sanitizePushPayload,
} from "../lib/pwa/push-payload";
import { NOTIFICATION_TYPES } from "../lib/notification-types";
import { PushSubscribeSchema } from "../lib/pwa/push-schemas";

describe("push payload", () => {
  it("builds message notification with reply action", () => {
    const payload = buildPushPayload({
      type: NOTIFICATION_TYPES.MESSAGE_RECEIVED,
      title: "New message",
      message: "Hello",
      entityType: "message",
      entityId: "00000000-0000-4000-8000-000000000001",
      actorId: "00000000-0000-4000-8000-000000000002",
    });
    assert.equal(payload.title, "New message");
    assert.ok(payload.actions?.some((a) => a.action === "view"));
  });

  it("sanitizes oversized payloads", () => {
    const huge = sanitizePushPayload({
      title: "T",
      body: "x".repeat(5000),
      url: "/notifications",
      data: { extra: "y".repeat(5000) },
    });
    assert.ok(JSON.stringify(huge).length < 4000);
  });
});

describe("push endpoint validation", () => {
  it("accepts https endpoints", () => {
    assert.equal(isValidPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), true);
  });

  it("rejects invalid endpoints", () => {
    assert.equal(isValidPushEndpoint("http://evil.test/x"), false);
    assert.equal(isValidPushEndpoint("not-a-url"), false);
  });
});

describe("push subscribe schema", () => {
  it("parses valid subscription", () => {
    const parsed = PushSubscribeSchema.parse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: { p256dh: "key", auth: "auth" },
      deviceType: "mobile",
    });
    assert.equal(parsed.deviceType, "mobile");
  });
});
