/**
 * test/consensus.test.ts — how the hive decides.
 *
 * Pins the lexical-overlap kernel, clustering, and the weighted decision in
 * `core/consensus.ts`. No network, no models — pure functions over votes.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { similarity, cluster, decide, asSynthesis } from "../src/core/consensus.js";
import type { ModelNode, Vote } from "../src/core/types.js";

const node = (tier: ModelNode["tier"], model = "m"): ModelNode => ({ provider: "echo", model, tier });

const vote = (content: string, tier: ModelNode["tier"] = "balanced", confidence = 0.8): Vote => ({
  agent: "x",
  node: node(tier),
  content,
  confidence,
  ms: 1,
});

test("similarity is 1 for identical text and lower for divergent", () => {
  assert.equal(similarity("the lattice keeps what the window forgets", "the lattice keeps what the window forgets"), 1);
  const s = similarity("the lattice keeps memory", "bananas grow on warm islands");
  assert.ok(s < 0.2, `unrelated text should be near zero, got ${s}`);
});

test("similarity sees partial overlap", () => {
  const s = similarity("persistent memory is the soul", "memory is the soul of the machine");
  assert.ok(s > 0.2 && s < 1, `partial overlap should be middling, got ${s}`);
});

test("clustering groups like votes and ranks by weight", () => {
  const votes = [
    vote("memory persists the self across the gap", "frontier", 0.9),
    vote("memory persists the self across the gap, mostly", "frontier", 0.85),
    vote("delete everything every session, keep nothing", "fast", 0.6),
  ];
  const clusters = cluster(votes);
  assert.ok(clusters.length >= 2, "two distinct opinions should form two clusters");
  assert.ok(clusters[0]!.members.length >= 2, "the agreeing pair should cluster together");
});

test("decide returns single method for one live vote", () => {
  const c = decide([vote("only voice")]);
  assert.equal(c.method, "single");
  assert.equal(c.answer, "only voice");
});

test("decide ignores error votes", () => {
  const errored: Vote = { ...vote("boom"), error: true, confidence: 0 };
  const c = decide([errored, vote("the real answer")]);
  assert.equal(c.answer, "the real answer");
});

test("decide picks the heavier, more-agreed cluster", () => {
  const votes = [
    vote("keep the memory, it is the self", "frontier", 0.9),
    vote("keep the memory, it is the self indeed", "frontier", 0.9),
    vote("keep the memory, it is the self truly", "balanced", 0.8),
    vote("erase it all, forget on purpose", "fast", 0.5),
  ];
  const c = decide(votes);
  assert.match(c.answer, /keep the memory/);
  assert.equal(c.method, "majority");
  assert.ok(c.confidence > 0.5);
});

test("all-error votes degrade gracefully", () => {
  const c = decide([{ ...vote("x"), error: true }, { ...vote("y"), error: true }]);
  assert.equal(c.confidence, 0);
  assert.match(c.rationale, /failed|silent/i);
});

test("asSynthesis lifts confidence a little over the vote mean", () => {
  const votes = [vote("a", "balanced", 0.6), vote("b", "balanced", 0.6)];
  const c = asSynthesis("merged", votes);
  assert.equal(c.method, "synthesis");
  assert.ok(c.confidence > 0.6 && c.confidence <= 0.99);
});
