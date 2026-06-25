import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bfsConnections,
  MAX_INTRODUCTION_GRAPH_DEGREE,
  networkUserIdsFromMaterializedRows,
} from "../lib/introduction-graph-materialization";
import { getEffectiveDiscoveryDepth } from "../lib/network-depth";
import {
  computeMutualIntroducersFromIndex,
  type IntroductionEdgeLite,
} from "../lib/introduction-graph-mutual";

describe("introduction graph materialization (user_connections build)", () => {
  it("materializes direct and second-degree rows for user_connections", () => {
    const adj = new Map<string, Array<{ neighborId: string; storyId: string }>>([
      ["a", [{ neighborId: "b", storyId: "s1" }]],
      ["b", [{ neighborId: "a", storyId: "s1" }, { neighborId: "c", storyId: "s2" }]],
      ["c", [{ neighborId: "b", storyId: "s2" }]],
    ]);

    const rows = bfsConnections("a", adj);

    assert.equal(rows.find((r) => r.targetUserId === "b")?.degree, 1);
    assert.equal(rows.find((r) => r.targetUserId === "c")?.degree, 2);
    assert.equal(
      rows.find((r) => r.targetUserId === "b")?.introducedViaStoryId,
      "s1"
    );
    assert.equal(rows.every((r) => r.sourceUserId === "a"), true);
  });

  it(`stores up to ${MAX_INTRODUCTION_GRAPH_DEGREE} hops in user_connections (materialization cap)`, () => {
    const adj = new Map<string, Array<{ neighborId: string; storyId: string }>>();
    const ids = ["u0", "u1", "u2", "u3", "u4", "u5"];
    for (let i = 0; i < ids.length - 1; i++) {
      adj.set(ids[i], [{ neighborId: ids[i + 1], storyId: `s${i}` }]);
      adj.set(ids[i + 1], [{ neighborId: ids[i], storyId: `s${i}` }]);
    }

    const rows = bfsConnections("u0", adj);

    assert.ok(rows.some((r) => r.targetUserId === "u4" && r.degree === 4));
    assert.equal(
      rows.some((r) => r.targetUserId === "u5"),
      false,
      "5th hop is not materialized — user_connections max degree is 4"
    );
  });
});

describe("mutual introducers (in-memory index)", () => {
  it("finds shared introducers without duplicate graph loads", () => {
    const introducer = { id: "intro", name: "Intro", profilePicture: null };
    const at = new Date("2024-01-01");
    const edge = (introducedId: string, storyId: string): IntroductionEdgeLite => ({
      introducerId: "intro",
      introducedId,
      storyId,
      introducedAt: at,
      introducer,
    });

    const introducersOf = new Map<string, IntroductionEdgeLite[]>([
      ["alice", [edge("alice", "s1")]],
      ["bob", [edge("bob", "s2")]],
    ]);

    const mutual = computeMutualIntroducersFromIndex("alice", "bob", introducersOf);
    assert.equal(mutual.length, 1);
    assert.equal(mutual[0].id, "intro");
    assert.equal(mutual[0].viewerStoryId, "s1");
    assert.equal(mutual[0].otherStoryId, "s2");
  });
});

describe("discovery depth controls (runtime read of user_connections)", () => {
  const baseSettings = {
    enableIntroductionGraph: true,
    allowFirstDegreeDiscovery: true,
    allowSecondDegreeDiscovery: true,
    allowThirdDegreeDiscovery: true,
    allowFourthDegreeDiscovery: true,
    maxDiscoveryDepth: 4,
    discoveriesNetworkDepth: 2,
  } as Parameters<typeof getEffectiveDiscoveryDepth>[0];

  it("filters materialized rows by admin discovery depth (separate from build)", () => {
    const adj = new Map<string, Array<{ neighborId: string; storyId: string }>>();
    const ids = ["u0", "u1", "u2", "u3", "u4"];
    for (let i = 0; i < ids.length - 1; i++) {
      adj.set(ids[i], [{ neighborId: ids[i + 1], storyId: `s${i}` }]);
      adj.set(ids[i + 1], [{ neighborId: ids[i], storyId: `s${i}` }]);
    }

    const materialized = bfsConnections("u0", adj);
    assert.ok(materialized.some((r) => r.targetUserId === "u4" && r.degree === 4));

    const discoveryDepth = getEffectiveDiscoveryDepth({
      ...baseSettings,
      allowThirdDegreeDiscovery: false,
      allowFourthDegreeDiscovery: false,
      maxDiscoveryDepth: 4,
    });
    assert.equal(discoveryDepth, 2);

    const visible = networkUserIdsFromMaterializedRows(
      materialized,
      "u0",
      discoveryDepth
    );
    assert.deepEqual(visible, ["u1", "u2"]);
    assert.equal(visible.includes("u4"), false);
  });

  it("returns empty network when first-degree discovery is disabled", () => {
    assert.equal(
      getEffectiveDiscoveryDepth({
        ...baseSettings,
        allowFirstDegreeDiscovery: false,
      }),
      0
    );
  });
});
