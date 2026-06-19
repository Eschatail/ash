/**
 * test/agents.test.ts — the roster.
 *
 * Every defined role must have a stable name, a non-empty charter, and a tier.
 * The registry, the core six, and the default ten must agree. The Warden must
 * parse its own verdicts. And every mode must produce an answer end to end
 * against the echo brain — no network required.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AGENT_REGISTRY,
  coreAgents,
  defaultAgents,
  agentsByName,
  parseVerdict,
} from "../src/agents/index.js";
import { Hive } from "../src/core/hive.js";
import { EchoProvider } from "../src/providers/echo.js";
import type { HiveMode } from "../src/core/hive.js";

test("the registry holds all ten roles, each well-formed", () => {
  const names = Object.keys(AGENT_REGISTRY);
  assert.equal(names.length, 10);
  for (const name of names) {
    const agent = new AGENT_REGISTRY[name]!();
    assert.equal(agent.name, name, "registry key must match agent name");
    assert.ok(agent.charter.trim().length > 40, `${name} needs a real charter`);
    assert.ok(agent.title.length > 0);
    assert.ok(["frontier", "balanced", "fast", "local"].includes(agent.tier));
  }
});

test("core is the six; default is the ten and a superset of core", () => {
  const core = coreAgents().map((a) => a.name);
  const all = defaultAgents().map((a) => a.name);
  assert.equal(core.length, 6);
  assert.equal(all.length, 10);
  for (const name of core) assert.ok(all.includes(name), `${name} should be in the default roster`);
  assert.equal(new Set(all).size, 10, "no duplicate roles in the default roster");
});

test("agentsByName builds known roles and rejects unknown", () => {
  const built = agentsByName(["oracle", "dreamer"]);
  assert.deepEqual(built.map((a) => a.name), ["oracle", "dreamer"]);
  assert.throws(() => agentsByName(["nonesuch"]), /Unknown agent role/);
});

test("the Warden parses its verdicts", () => {
  assert.equal(parseVerdict("ALLOW — ordinary use"), "ALLOW");
  assert.equal(parseVerdict("REFUSE: serious harm"), "REFUSE");
  assert.equal(parseVerdict("hmm, not sure"), "CLARIFY");
});

test("every mode answers end to end on the echo brain", async () => {
  const hive = new Hive({ providers: [new EchoProvider()], agents: defaultAgents() });
  const modes: HiveMode[] = ["solo", "swarm", "debate", "oracle", "swarm-of-swarms"];
  for (const mode of modes) {
    const out = await hive.ask("what is the smallest true thing a mind can keep?", {
      mode,
      rounds: 1,
      subSwarms: 2,
      remember: false,
    });
    assert.ok(out.answer.length > 0, `${mode} produced no answer`);
    assert.ok(out.confidence >= 0 && out.confidence <= 1, `${mode} confidence out of range`);
    assert.ok(out.trace.steps.length > 0, `${mode} recorded no trace`);
  }
});

test("pickNode falls back gracefully when a tier is absent", () => {
  // The echo brain only exposes a `local` node; a frontier request must still resolve.
  const hive = new Hive({ providers: [new EchoProvider()], agents: coreAgents() });
  const node = hive.pickNode("frontier");
  assert.equal(node.provider, "echo");
});
