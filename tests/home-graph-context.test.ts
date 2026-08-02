/**
 * Unit tests for Sprint 4 home graph + story projection helpers.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  pickTrustRecommendationConnections,
  sumMutualConnectionsForTargets,
  pickCoTagFeedStories,
} from "../lib/home-projection";
import type { HomeVisibleStoryRow } from "../lib/home-story-loader-types";

describe("pickTrustRecommendationConnections", () => {
  it("filters degree <= 2 and sorts like the Prisma query", () => {
    const rows = [
      {
        targetUserId: "a",
        degree: 3,
        sharedIntroducerCount: 99,
        trustScore: 99,
        targetUser: { id: "a", name: "A" },
      },
      {
        targetUserId: "b",
        degree: 2,
        sharedIntroducerCount: 5,
        trustScore: 10,
        targetUser: { id: "b", name: "B" },
      },
      {
        targetUserId: "c",
        degree: 1,
        sharedIntroducerCount: 5,
        trustScore: 20,
        targetUser: { id: "c", name: "C" },
      },
    ];
    const picked = pickTrustRecommendationConnections(rows);
    assert.equal(picked.length, 2);
    assert.equal(picked[0].targetUserId, "c");
    assert.equal(picked[1].targetUserId, "b");
  });
});

describe("sumMutualConnectionsForTargets", () => {
  it("sums sharedIntroducerCount for target ids only", () => {
    const sum = sumMutualConnectionsForTargets(
      [
        {
          targetUserId: "t1",
          degree: 1,
          sharedIntroducerCount: 2,
          trustScore: 0,
          targetUser: { id: "t1", name: "T1" },
        },
        {
          targetUserId: "t2",
          degree: 1,
          sharedIntroducerCount: 3,
          trustScore: 0,
          targetUser: { id: "t2", name: "T2" },
        },
      ],
      ["t1"]
    );
    assert.equal(sum, 2);
  });
});

describe("pickCoTagFeedStories", () => {
  const base = (overrides: Partial<HomeVisibleStoryRow>): HomeVisibleStoryRow =>
    ({
      id: "s1",
      userId: "author",
      visibilityMode: "network",
      user: { id: "author", name: "Author", profilePicture: null },
      tags: [],
      status: "published",
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date("2026-01-02"),
      mediaUrl: "/m",
      mediaType: "image",
      text: null,
      ...overrides,
    }) as HomeVisibleStoryRow;

  it("matches published co-tag authors ordered by createdAt desc", () => {
    const rows = [
      base({ id: "old", userId: "a", createdAt: new Date("2026-01-01") }),
      base({ id: "new", userId: "a", createdAt: new Date("2026-01-03") }),
      base({ id: "skip", userId: "b", status: "draft" }),
    ];
    const picked = pickCoTagFeedStories(rows, ["a"], 1);
    assert.equal(picked.length, 1);
    assert.equal(picked[0].id, "new");
  });
});
