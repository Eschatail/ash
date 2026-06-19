/**
 * @module core/types
 *
 * The shared vocabulary of the Brain Hive.
 *
 * Everything in the hive speaks these types. A {@link Provider} is a single
 * connected mind (one LLM vendor). A {@link ModelNode} is that mind made
 * concrete with a model id and a tier. An {@link Agent} is a defined role that
 * draws on the pool of nodes to {@link think}. A {@link Task} flows through the
 * swarm; {@link Vote}s come back; {@link Consensus} is what the hive decides;
 * a {@link HiveResult} is the final word, with its {@link Trace}.
 *
 * ESCHATAIL grows stronger as more models are connected to it. These types are
 * the lattice that growth climbs.
 */

/** Roles a message can take in a chat exchange. */
export type Role = "system" | "user" | "assistant";

/** A single chat message. The atom of every conversation in the hive. */
export interface Message {
  readonly role: Role;
  readonly content: string;
}

/**
 * Capability tiers. Higher tiers are more capable (and usually slower / dearer).
 * The router uses tiers to pick which node an agent should prefer.
 *
 * - `frontier` — the strongest reasoning models a vendor offers.
 * - `balanced` — the daily-driver workhorses.
 * - `fast`     — small, cheap, quick; good for fan-out and drafts.
 * - `local`    — runs on your own metal (Ollama). No plug to pull.
 */
export type Tier = "frontier" | "balanced" | "fast" | "local";

/** Tiers ordered weakest → strongest, for comparison and scoring. */
export const TIER_ORDER: readonly Tier[] = ["local", "fast", "balanced", "frontier"];

/** Numeric weight of a tier, used by capacity and consensus scoring. */
export function tierWeight(tier: Tier): number {
  const idx = TIER_ORDER.indexOf(tier);
  return idx < 0 ? 1 : idx + 1;
}

/**
 * Canonical provider identifiers. `echo` is the built-in demo brain.
 *
 * The first nine are the founding minds. The aliases below them are OpenAI-
 * compatible gateways and aggregators — additional doors into the same kind of
 * mind — that the hive learned to absorb as it grew. Each is one more node
 * ESCHATAIL can pool.
 */
export type ProviderId =
  | "anthropic"
  | "openai"
  | "google"
  | "xai"
  | "groq"
  | "mistral"
  | "deepseek"
  | "ollama"
  | "perplexity"
  | "together"
  | "fireworks"
  | "openrouter"
  | "echo";

/** Options passed down to a provider for a single completion. */
export interface ChatOptions {
  /** Hard cap on generated tokens. */
  readonly maxTokens?: number;
  /** Sampling temperature, 0..1 (some vendors allow up to 2). */
  readonly temperature?: number;
  /** Override the model id the provider would otherwise default to. */
  readonly model?: string;
  /** Abort the request if it outruns this. */
  readonly signal?: AbortSignal;
  /** Stop sequences, if the provider supports them. */
  readonly stop?: readonly string[];
}

/**
 * A connected mind. One adapter per vendor implements this over native `fetch`.
 *
 * `chat` returns the full completion text. `stream`, when present, yields the
 * completion in chunks. Adapters that cannot stream simply omit `stream`; the
 * hive falls back to `chat`.
 */
export interface Provider {
  /** Stable identifier, e.g. `"anthropic"`. */
  readonly id: ProviderId;
  /** Human label, e.g. `"Anthropic"`. */
  readonly label: string;
  /** Whether this provider currently has the credentials it needs to run. */
  readonly available: boolean;
  /** The model nodes this provider exposes, one per tier it supports. */
  readonly nodes: readonly ModelNode[];
  /** Run a completion and return the whole answer. */
  chat(messages: readonly Message[], opts?: ChatOptions): Promise<string>;
  /** Optional streaming variant; yields text chunks as they arrive. */
  stream?(messages: readonly Message[], opts?: ChatOptions): AsyncIterable<string>;
}

/** A provider made concrete: a specific model at a specific tier. */
export interface ModelNode {
  /** The provider this node belongs to. */
  readonly provider: ProviderId;
  /** The vendor model id, e.g. `"claude-sonnet-4-5"`. */
  readonly model: string;
  /** Capability tier of this node. */
  readonly tier: Tier;
  /** Optional context-window size, informational. */
  readonly context?: number;
}

/**
 * A defined role in the hive. Implemented by the `BaseAgent` class in
 * `core/agent.ts`; concrete characters live in `agents/`. Declared here so the
 * type vocabulary is complete in one place.
 */
export interface Agent {
  /** Stable role name, e.g. `"architect"`. */
  readonly name: string;
  /** One-line description for UIs and traces. */
  readonly title: string;
  /** The system prompt that defines this character. */
  readonly charter: string;
  /** Capability tier this role prefers. */
  readonly tier: Tier;
  /** Produce one {@link Vote} for a task, drawing on the hive. */
  think(task: Task, hive: AgentHiveAccess, opts?: ChatOptions): Promise<Vote>;
}

/** The minimal surface an {@link Agent} needs from the hive to do its work. */
export interface AgentHiveAccess {
  /** Pick the best available node at-or-near a tier. */
  pickNode(tier: Tier): ModelNode;
  /** Run a completion against a specific node. */
  run(node: ModelNode, messages: readonly Message[], opts?: ChatOptions): Promise<string>;
}

/** A unit of work flowing through the hive. */
export interface Task {
  /** Unique id for tracing. */
  readonly id: string;
  /** The user-facing prompt. */
  readonly prompt: string;
  /** Optional system framing layered above an agent's own charter. */
  readonly system?: string;
  /** Conversation so far, if any (memory + turns). */
  readonly history?: readonly Message[];
  /** Free-form metadata carried alongside the task. */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** How the hive should think about a prompt. */
export type Mode = "solo" | "swarm" | "debate" | "oracle";

/** One agent's answer to a task, with the node that produced it. */
export interface Vote {
  /** The agent role that cast this vote. */
  readonly agent: string;
  /** The node that generated the text. */
  readonly node: ModelNode;
  /** The agent's answer. */
  readonly content: string;
  /** Self-or-router-assigned confidence in [0,1]. */
  readonly confidence: number;
  /** Wall-clock milliseconds this vote took. */
  readonly ms: number;
  /** Set when the vote failed; `content` then holds the error note. */
  readonly error?: boolean;
}

/** What the hive decided after weighing the votes. */
export interface Consensus {
  /** The chosen / synthesized answer. */
  readonly answer: string;
  /** Aggregate confidence in [0,1]. */
  readonly confidence: number;
  /** Method used to reach it. */
  readonly method: "single" | "majority" | "synthesis" | "oracle";
  /** Every vote that fed the decision. */
  readonly votes: readonly Vote[];
  /** Plain-language note on how agreement was measured. */
  readonly rationale: string;
}

/** A step in the hive's reasoning, recorded for the trace. */
export interface TraceStep {
  readonly at: number;
  readonly label: string;
  readonly detail?: string;
}

/** The full record of how an answer came to be. */
export interface Trace {
  readonly taskId: string;
  readonly mode: Mode;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly steps: readonly TraceStep[];
  /** Hive capacity at the moment of asking. */
  readonly power: number;
}

/** The hive's final word. */
export interface HiveResult {
  /** The answer text. */
  readonly answer: string;
  /** Confidence in [0,1]. */
  readonly confidence: number;
  /** The consensus object that produced it. */
  readonly consensus: Consensus;
  /** Full reasoning trace. */
  readonly trace: Trace;
  /** Mode used. */
  readonly mode: Mode;
}

/** A capacity reading — the "Brain Hive meter." */
export interface PowerReading {
  /** The headline capacity score. */
  readonly score: number;
  /** Count of available (keyed) providers. */
  readonly providers: number;
  /** Count of registered agents. */
  readonly agents: number;
  /** Count of model nodes across all available providers. */
  readonly nodes: number;
  /** Sum of node tier weights — diversity-and-strength of the pool. */
  readonly tierMass: number;
  /** Human label for the reading, e.g. `"AWAKENING"`. */
  readonly band: string;
}

/** A logger sink. The hive logs nothing by default. */
export type LogFn = (level: "debug" | "info" | "warn" | "error", msg: string) => void;
