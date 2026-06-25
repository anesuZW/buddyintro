import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  getCategoryPrefField,
  notificationHref,
} from "../lib/notification-types";

describe("notification generation metadata", () => {
  it("prioritizes introduction received over discovery likes", () => {
    assert.ok(
      NOTIFICATION_PRIORITY[NOTIFICATION_TYPES.INTRODUCTION_RECEIVED] <
        NOTIFICATION_PRIORITY[NOTIFICATION_TYPES.DISCOVERY_LIKED]
    );
  });

  it("maps types to preference fields", () => {
    assert.equal(getCategoryPrefField(NOTIFICATION_TYPES.MESSAGE_RECEIVED), "enableMessageNotifications");
    assert.equal(
      getCategoryPrefField(NOTIFICATION_TYPES.TRUST_SCORE_INCREASED),
      "enableTrustNotifications"
    );
  });

  it("builds deep links for entities", () => {
    assert.match(notificationHref("story", "abc", null), /abc/);
    assert.match(notificationHref("user", null, "user-1"), /user-1/);
    assert.match(notificationHref("discoveries_post", "post-1", null), /post-1/);
  });
});
