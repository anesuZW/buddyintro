/**
 * Simulation validation unit tests — graph invariants (no DB required).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSimulationPlan } from "@/lib/simulation/personas";
import { planSimulationContent } from "@/lib/simulation/content-plan";
import { TARGETS } from "@/lib/simulation/constants";
import { mulberry32 } from "@/lib/simulation/rng";

describe("simulation plan", () => {
  it("generates 1000 personas with regional communities", () => {
    const { personas, communities } = buildSimulationPlan(1000);
    assert.equal(personas.length, 1000);
    assert.equal(communities.length, 20);
    assert.ok(personas.some((p) => p.isBridge));
    assert.ok(personas.every((p) => p.profession && p.interests.length >= 3));
  });

  it("does not plan fully-connected communities", () => {
    const { personas, communities } = buildSimulationPlan(1000);
    const { stories } = planSimulationContent(personas, communities);
    const published = stories.filter((s) => s.status === "published");
    const pairs = new Set(published.map((s) => `${s.authorIndex}->${s.taggedIndex}`));
    const maxPossible = 1000 * 999;
    assert.ok(pairs.size < maxPossible * 0.02, "graph should stay sparse");
  });

  it("hits content volume targets", () => {
    const { personas, communities } = buildSimulationPlan(1000);
    const plan = planSimulationContent(personas, communities);
    assert.equal(plan.stories.length, TARGETS.taggedStories);
    assert.equal(plan.stories.filter((s) => s.status === "draft").length, TARGETS.introductionRequests);
    assert.equal(plan.discoveries.length, TARGETS.discoveryPosts);
    assert.equal(plan.messages.length, TARGETS.messages);
    assert.equal(plan.notifications.length, TARGETS.notifications);
  });

  it("uses deterministic RNG", () => {
    const a = mulberry32(42)();
    const b = mulberry32(42)();
    assert.equal(a, b);
  });
});
