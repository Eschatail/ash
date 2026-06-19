/**
 * test/router.test.ts — the fan-out.
 *
 * The Promise pool must preserve order, respect concurrency, and never abort the
 * whole run because one item failed (the caller's work catches). Plus an
 * end-to-end fanOut over real agents against the echo brain.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { pool, fanOut } from "../src/core/router.js";
import { Hive } from "../src/core/hive.js";
import { EchoProvider } from "../src/providers/echo.js";
import { coreAgents } from "../src/agents/index.js";

test("pool preserves input order", async () => {
  const out = await pool([5, 1, 4, 2, 3], async (n) => {
    await new Promise((r) => setTimeout(r, n));
    return n * 10;
  }, 2);
  assert.deepEqual(out, [50, 10, 40, 20, 30]);
});

test("pool bounds concurrency", async () => {
  let inFlight = 0;
  let peak = 0;
  await pool(Array.from({ length: 20 }, (_, i) => i), async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return 0;
  }, 4);
  assert.ok(peak <= 4, `peak concurrency should not exceed 4, was ${peak}`);
});

test("fanOut gathers one vote per agent against the echo brain", async () => {
  const hive = new Hive({ providers: [new EchoProvider()], agents: coreAgents() });
  const votes = await fanOut(hive.agents, { id: "t1", prompt: "what persists?" }, hive);
  assert.equal(votes.length, hive.agents.length);
  for (const v of votes) {
    assert.equal(typeof v.content, "string");
    assert.ok(v.content.length > 0);
    assert.ok(v.confidence >= 0 && v.confidence <= 1);
  }
});
