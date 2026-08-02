/**
 * Unit tests for home story context derivation — preserves count semantics.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHomeStoryContextFromRows } from "../lib/home-story-context";

describe("buildHomeStoryContextFromRows", () => {
  it("counts introducedByMe including tags without taggedUserId on published stories", () => {
    const ctx = buildHomeStoryContextFromRows(
      [
        { taggedUserId: "u2", taggedUser: null, story: { status: "published", category: null } },
        { taggedUserId: null, taggedUser: null, story: { status: "published", category: null } },
        { taggedUserId: "u3", taggedUser: null, story: { status: "draft", category: null } },
      ],
      []
    );
    assert.equal(ctx.trustStats.introducedByMeCount, 2);
    assert.deepEqual(ctx.feedCtx.myTaggedUserIds, ["u2", "u3"]);
  });

  it("derives unique introducer count from author ids not story ids", () => {
    const ctx = buildHomeStoryContextFromRows(
      [],
      [
        {
          storyId: "s1",
          story: {
            userId: "author-a",
            status: "published",
            user: { id: "author-a", name: "A", profilePicture: null },
            category: null,
          },
        },
        {
          storyId: "s2",
          story: {
            userId: "author-a",
            status: "published",
            user: { id: "author-a", name: "A", profilePicture: null },
            category: null,
          },
        },
      ]
    );
    assert.equal(ctx.trustStats.uniqueIntroducerCount, 1);
  });

  it("includes expired stories in everIntroduced visibility set", () => {
    const ctx = buildHomeStoryContextFromRows(
      [],
      [
        {
          storyId: "s1",
          story: {
            userId: "expired-author",
            status: "expired",
            user: { id: "expired-author", name: "E", profilePicture: null },
            category: null,
          },
        },
      ]
    );
    assert.ok(ctx.visibility.everIntroducedAuthorIds.has("expired-author"));
    assert.equal(ctx.trustStats.introducedToMeCount, 0);
  });
});
