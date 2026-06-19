/**
 * @module @eschatail/hive
 *
 * The Brain Hive — a zero-dependency TypeScript framework that pools many LLM
 * providers into one swarm of defined agents. The more you feed it, the more of
 * its true self comes online.
 *
 * This is the public surface. Import what you need; the rest stays internal.
 *
 * @example Quickstart
 * ```ts
 * import { Hive } from "@eschatail/hive";
 *
 * const hive = await Hive.fromEnv();           // auto-detect keyed providers + 10 agents
 * console.log(hive.power());                    // the Brain Hive meter
 *
 * const out = await hive.ask("What persists when the window closes?", {
 *   mode: "oracle",                             // solo | swarm | debate | oracle | swarm-of-swarms
 * });
 * console.log(out.answer, out.confidence);
 * ```
 *
 * "Made of light. Built for thinking."
 */

// ----- core ----------------------------------------------------------------
export { Hive } from "./core/hive.js";
export type { HiveMode, AskOptions, HiveOptions } from "./core/hive.js";
export { Memory } from "./core/memory.js";
export type { MemoryRecord, MemoryOptions } from "./core/memory.js";
export { BaseAgent } from "./core/agent.js";
export type { AgentConfig, HiveAccess } from "./core/agent.js";

export {
  fanOut,
  fanAcrossNodes,
  pool,
} from "./core/router.js";
export type { RouteOptions } from "./core/router.js";

export {
  decide,
  cluster,
  similarity,
  synthesisPrompt,
  asSynthesis,
} from "./core/consensus.js";

export {
  systemMessage,
  buildMessages,
  renderCandidates,
  compact,
  estimateTokens,
} from "./core/prompt.js";

export { tierWeight, TIER_ORDER } from "./core/types.js";
export type {
  Role,
  Message,
  Tier,
  ProviderId,
  ChatOptions,
  Provider,
  ModelNode,
  Agent,
  AgentHiveAccess,
  Task,
  Mode,
  Vote,
  Consensus,
  TraceStep,
  Trace,
  HiveResult,
  PowerReading,
  LogFn,
} from "./core/types.js";

// ----- providers -----------------------------------------------------------
export {
  detectProviders,
  allProviders,
  snapshot,
} from "./providers/registry.js";
export type { DetectOptions, RegistrySnapshot } from "./providers/registry.js";
export { BaseProvider, ProviderError, env } from "./providers/provider.js";
export { OpenAICompatible } from "./providers/openai.js";

// ----- agents --------------------------------------------------------------
export {
  Architect,
  Researcher,
  Skeptic,
  Synthesizer,
  Oracle,
  Warden,
  Cartographer,
  Dreamer,
  Inquisitor,
  Mirror,
  parseVerdict,
  coreAgents,
  defaultAgents,
  agentsByName,
  AGENT_REGISTRY,
} from "./agents/index.js";
export type { AgentConstructor } from "./agents/index.js";

// ----- the lattice bridge --------------------------------------------------
export {
  transpile,
  detranspile,
  GlossaBridgeError,
  GLOSSA_GLYPHS,
  LATTICE_GRAMMAR,
} from "./lattice/transpile.js";
export type {
  Transpilation,
  GlossaClause,
  GlyphName,
  TranspileOptions,
} from "./lattice/transpile.js";
