import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDiscoveryTrustContext,
  formatDiscoveryExpiry,
} from "@/lib/discovery-ux";

describe("discovery UX helpers", () => {
  it("formats expired state", () => {
    const result = formatDiscoveryExpiry(new Date(Date.now() - 1000));
    assert.equal(result?.label, "Expired");
    assert.equal(result?.variant, "expired");
  });

  it("formats hours remaining", () => {
    const now = new Date("2026-06-17T12:00:00.000Z");
    const result = formatDiscoveryExpiry(new Date("2026-06-17T17:00:00.000Z"), now);
    assert.match(result?.label ?? "", /Expires in 5 hours/);
  });

  it("builds mutual introduction trust line", () => {
    const line = buildDiscoveryTrustContext({
      connectionReason: {
        connectionDepth: 2,
      } as any,
    });
    assert.equal(line, "Visible through 2 mutual introductions");
  });

  it("builds trusted path line", () => {
    const line = buildDiscoveryTrustContext({
      connectionReason: {
        introducers: [
          { id: "1", name: "Alice Smith", profilePicture: null },
          { id: "2", name: "Bob Jones", profilePicture: null },
        ],
      } as any,
    });
    assert.equal(line, "Trusted path: Alice → Bob → You");
  });
});
