/**
 * test/power.test.ts — the capacity math.
 *
 * The Brain Hive meter must be monotone: feeding the hive (more providers, more
 * tiers, more agents) never lowers the score, and the bands are ordered. These
 * tests pin the math from `core/hive.ts::power()`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Hive } from "../src/core/hive.js";
import { EchoProvider } from "../src/providers/echo.js";
import { coreAgents, defaultAgents } from "../src/agents/index.js";
import type { ModelNode, Provider } from "../src/core/types.js";

/** A tiny fake provider with declarable nodes, for capacity tests. */
function fakeProvider(id: Provider["id"], nodes: readonly ModelNode[]): Provider {
  return {
    id,
    label: id,
    available: true,
    nodes,
    chat: async () => "ok",
  };
}

test("a hive needs at least one provider", () => {
  assert.throws(() => new Hive({ providers: [], agents: coreAgents() }));
});

test("echo-only hive reads as a low but living band", () => {
  const hive = new Hive({ providers: [new EchoProvider()], agents: coreAgents() });
  const p = hive.power();
  assert.equal(p.providers, 1);
  assert.equal(p.agents, 6);
  assert.ok(p.score >= 1, "the floor is never DORMANT once an agent is present");
  assert.ok(["DIM", "STIRRING", "AWAKENING"].includes(p.band));
});

test("more providers strictly raise capacity", () => {
  const one = new Hive({ providers: [new EchoProvider()], agents: coreAgents() });
  const two = new Hive({
    providers: [
      new EchoProvider(),
      fakeProvider("anthropic", [
        { provider: "anthropic", model: "x", tier: "frontier" },
        { provider: "anthropic", model: "y", tier: "fast" },
      ]),
    ],
    agents: coreAgents(),
  });
  assert.ok(two.power().score > one.power().score, "adding a provider must raise the score");
});

test("more agents raise capacity (agentGain)", () => {
  // A pool with real tierMass, so the log-shaped agentGain survives rounding.
  // (At the bare echo floor, tierMass is 1 and the rounding can collapse the
  //  difference — the gain is still monotone, just sub-integer.)
  const providers = [
    fakeProvider("openai", [
      { provider: "openai", model: "F", tier: "frontier" },
      { provider: "openai", model: "b", tier: "balanced" },
      { provider: "openai", model: "f", tier: "fast" },
    ]),
  ];
  const few = new Hive({ providers, agents: coreAgents() });
  const many = new Hive({ providers, agents: defaultAgents() });
  assert.ok(many.power().score > few.power().score, "ten agents must outweigh six");
});

test("stronger tiers raise tierMass and score", () => {
  const fast = new Hive({
    providers: [fakeProvider("openai", [{ provider: "openai", model: "f", tier: "fast" }])],
    agents: coreAgents(),
  });
  const frontier = new Hive({
    providers: [fakeProvider("openai", [{ provider: "openai", model: "F", tier: "frontier" }])],
    agents: coreAgents(),
  });
  assert.ok(frontier.power().tierMass > fast.power().tierMass);
  assert.ok(frontier.power().score > fast.power().score);
});

test("a full board reads near the top band", () => {
  const board: Provider[] = ["anthropic", "openai", "google", "xai", "groq", "mistral"].map((id) =>
    fakeProvider(id as Provider["id"], [
      { provider: id as Provider["id"], model: `${id}-frontier`, tier: "frontier" },
      { provider: id as Provider["id"], model: `${id}-balanced`, tier: "balanced" },
      { provider: id as Provider["id"], model: `${id}-fast`, tier: "fast" },
    ]),
  );
  const hive = new Hive({ providers: board, agents: defaultAgents() });
  const p = hive.power();
  assert.ok(p.score >= 100, `a full board should be ASCENDANT-class, got ${p.score}`);
  assert.equal(p.band, "ASCENDANT");
});
