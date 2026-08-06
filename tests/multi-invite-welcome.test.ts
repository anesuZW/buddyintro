import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWelcomeCardDisplay } from "../lib/multi-invite-welcome";

function inv(
  id: string,
  name: string,
  opts: { activatedAt?: Date | null; acceptedAt?: Date | null } = {}
) {
  return {
    invitationId: id,
    name,
    activatedAt: opts.activatedAt ?? null,
    acceptedAt: opts.acceptedAt ?? null,
  };
}

describe("buildWelcomeCardDisplay", () => {
  it("returns null for a single invitation", () => {
    assert.equal(
      buildWelcomeCardDisplay([
        inv("1", "Ane", { activatedAt: new Date("2026-01-01") }),
      ]),
      null
    );
  });

  it("returns null when activation attribution is missing", () => {
    assert.equal(
      buildWelcomeCardDisplay([
        inv("1", "Ane", { acceptedAt: new Date("2026-01-01") }),
        inv("2", "Gerald", { acceptedAt: new Date("2026-01-02") }),
      ]),
      null
    );
  });

  it("puts activation inviter first and lists all others when 2–4", () => {
    const display = buildWelcomeCardDisplay([
      inv("b", "Gerald", { acceptedAt: new Date("2026-01-01T10:00:00Z") }),
      inv("a", "Ane", {
        activatedAt: new Date("2026-01-01T12:00:00Z"),
        acceptedAt: new Date("2026-01-01T12:00:00Z"),
      }),
      inv("c", "Tariro", { acceptedAt: new Date("2026-01-01T11:00:00Z") }),
      inv("d", "Mike", { acceptedAt: new Date("2026-01-01T13:00:00Z") }),
    ]);

    assert.deepEqual(display, {
      totalCount: 4,
      activationInviterName: "Ane",
      otherInviterNames: ["Gerald", "Tariro", "Mike"],
      moreCount: 0,
      listedNames: ["Ane", "Gerald", "Tariro", "Mike"],
    });
  });

  it("truncates to activation + 3 others + moreCount when 5+", () => {
    const display = buildWelcomeCardDisplay([
      inv("act", "Ane", {
        activatedAt: new Date("2026-01-01T12:00:00Z"),
        acceptedAt: new Date("2026-01-01T12:00:00Z"),
      }),
      inv("1", "Gerald", { acceptedAt: new Date("2026-01-01T01:00:00Z") }),
      inv("2", "Mike", { acceptedAt: new Date("2026-01-01T02:00:00Z") }),
      inv("3", "Tariro", { acceptedAt: new Date("2026-01-01T03:00:00Z") }),
      inv("4", "Sam", { acceptedAt: new Date("2026-01-01T04:00:00Z") }),
      inv("5", "Lee", { acceptedAt: new Date("2026-01-01T05:00:00Z") }),
      inv("6", "Pat", { acceptedAt: new Date("2026-01-01T06:00:00Z") }),
      inv("7", "Kim", { acceptedAt: new Date("2026-01-01T07:00:00Z") }),
      inv("8", "Jo", { acceptedAt: new Date("2026-01-01T08:00:00Z") }),
      inv("9", "Alex", { acceptedAt: new Date("2026-01-01T09:00:00Z") }),
    ]);

    assert.deepEqual(display, {
      totalCount: 10,
      activationInviterName: "Ane",
      otherInviterNames: ["Gerald", "Mike", "Tariro"],
      moreCount: 6,
      listedNames: ["Ane", "Gerald", "Mike", "Tariro"],
    });
  });

  it("never infers activation from acceptance order", () => {
    const display = buildWelcomeCardDisplay([
      inv("first", "Gerald", {
        acceptedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      inv("opened", "Ane", {
        activatedAt: new Date("2026-01-02T00:00:00Z"),
        acceptedAt: new Date("2026-01-02T00:00:00Z"),
      }),
    ]);
    assert.equal(display?.activationInviterName, "Ane");
  });
});
