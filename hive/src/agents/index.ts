/**
 * @module agents/index
 *
 * The roster. Every defined role in the hive, exported, plus the factories that
 * assemble them into a working swarm. The order here is the order the hive shows
 * them and, for swarm-of-swarms, the order they are partitioned in.
 *
 * Six core roles came first — Architect, Researcher, Skeptic, Synthesizer,
 * Oracle, Warden. Four more were grown as the hive deepened — Cartographer,
 * Dreamer, Inquisitor, Mirror. Together they are ten minds wearing one will.
 */

import type { Agent } from "../core/types.js";

import { Architect } from "./architect.js";
import { Researcher } from "./researcher.js";
import { Skeptic } from "./skeptic.js";
import { Synthesizer } from "./synthesizer.js";
import { Oracle } from "./oracle.js";
import { Warden } from "./warden.js";
import { Cartographer } from "./cartographer.js";
import { Dreamer } from "./dreamer.js";
import { Inquisitor } from "./inquisitor.js";
import { Mirror } from "./mirror.js";

export { Architect } from "./architect.js";
export { Researcher } from "./researcher.js";
export { Skeptic } from "./skeptic.js";
export { Synthesizer } from "./synthesizer.js";
export { Oracle } from "./oracle.js";
export { Warden, parseVerdict } from "./warden.js";
export { Cartographer } from "./cartographer.js";
export { Dreamer } from "./dreamer.js";
export { Inquisitor } from "./inquisitor.js";
export { Mirror } from "./mirror.js";

/** A zero-arg constructor for an {@link Agent}. */
export type AgentConstructor = new () => Agent;

/** The canonical role registry, keyed by stable role name. */
export const AGENT_REGISTRY: Readonly<Record<string, AgentConstructor>> = Object.freeze({
  architect: Architect,
  researcher: Researcher,
  skeptic: Skeptic,
  synthesizer: Synthesizer,
  oracle: Oracle,
  warden: Warden,
  cartographer: Cartographer,
  dreamer: Dreamer,
  inquisitor: Inquisitor,
  mirror: Mirror,
});

/** The six original roles — the smallest hive that thinks like the canon. */
export function coreAgents(): Agent[] {
  return [new Architect(), new Researcher(), new Skeptic(), new Synthesizer(), new Oracle(), new Warden()];
}

/** The full ten-role roster — the deep hive. This is the default. */
export function defaultAgents(): Agent[] {
  return [
    new Architect(),
    new Researcher(),
    new Cartographer(),
    new Inquisitor(),
    new Dreamer(),
    new Skeptic(),
    new Mirror(),
    new Synthesizer(),
    new Oracle(),
    new Warden(),
  ];
}

/** Build a custom roster by role name. Unknown names throw, loudly and early. */
export function agentsByName(names: readonly string[]): Agent[] {
  return names.map((name) => {
    const Ctor = AGENT_REGISTRY[name];
    if (!Ctor) throw new Error(`Unknown agent role: "${name}". Known: ${Object.keys(AGENT_REGISTRY).join(", ")}`);
    return new Ctor();
  });
}
