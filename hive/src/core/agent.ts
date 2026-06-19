/**
 * @module core/agent
 *
 * The agent base. An agent is a defined role: a charter (system prompt), a
 * preferred capability tier, and a {@link think} method that draws on the hive's
 * pool of providers to produce one {@link Vote}.
 *
 * Agents are "highly defined" by design. Each subclass in `../agents/` is a
 * crisp character with a single job. The base handles node selection, timing,
 * error capture, and confidence calibration so the roles stay small.
 */

import type { Agent, AgentHiveAccess, ChatOptions, Task, Tier, Vote } from "./types.js";
import { buildMessages } from "./prompt.js";

/** Re-export so `../agents/*` can import the contract from one place. */
export type { Agent, AgentHiveAccess } from "./types.js";

/** Alias kept for readability inside this module. */
export type HiveAccess = AgentHiveAccess;

/** Construction options shared by all agents. */
export interface AgentConfig {
  /** The role name, e.g. `"architect"`. Lowercase, stable. */
  readonly name: string;
  /** One-line description for UIs and traces. */
  readonly title: string;
  /** The system prompt that defines the character. */
  readonly charter: string;
  /** The capability tier this role prefers. */
  readonly tier: Tier;
  /** Default sampling temperature for this role. */
  readonly temperature?: number;
  /** Default max tokens for this role. */
  readonly maxTokens?: number;
}

/**
 * Base class for all agents. Subclasses typically only pass an {@link AgentConfig}
 * to `super` and, if needed, override {@link calibrate} to shape confidence.
 */
export abstract class BaseAgent implements Agent {
  readonly name: string;
  readonly title: string;
  readonly charter: string;
  readonly tier: Tier;
  protected readonly temperature: number;
  protected readonly maxTokens: number;

  constructor(cfg: AgentConfig) {
    this.name = cfg.name;
    this.title = cfg.title;
    this.charter = cfg.charter;
    this.tier = cfg.tier;
    this.temperature = cfg.temperature ?? 0.7;
    this.maxTokens = cfg.maxTokens ?? 1024;
  }

  /**
   * Produce one vote for a task. Selects a node at this agent's preferred tier,
   * builds the prompt from the charter + task, runs it, and times it. Failures
   * are captured as low-confidence error votes rather than thrown, so one dead
   * node never collapses the swarm.
   */
  async think(task: Task, hive: AgentHiveAccess, opts?: ChatOptions): Promise<Vote> {
    const node = hive.pickNode(this.tier);
    const messages = buildMessages(this.charter, task);
    const t0 = Date.now();
    try {
      const content = await hive.run(node, messages, {
        temperature: this.temperature,
        maxTokens: this.maxTokens,
        ...opts,
      });
      const ms = Date.now() - t0;
      return {
        agent: this.name,
        node,
        content,
        confidence: this.calibrate(content),
        ms,
      };
    } catch (err) {
      const ms = Date.now() - t0;
      return {
        agent: this.name,
        node,
        content: `[${this.name} failed] ${err instanceof Error ? err.message : String(err)}`,
        confidence: 0,
        ms,
        error: true,
      };
    }
  }

  /**
   * Heuristic confidence from an answer's shape. Subclasses may override to
   * reward or penalize traits specific to their role (e.g. the Skeptic prizes
   * finding a flaw; the Oracle prizes brevity).
   */
  protected calibrate(content: string): number {
    const len = content.trim().length;
    if (len === 0) return 0;
    // A gentle curve: too short reads as thin, very long reads as unfocused.
    const ideal = 600;
    const ratio = Math.min(len, ideal) / ideal;
    const overrun = len > ideal * 3 ? 0.15 : 0;
    return clamp01(0.45 + ratio * 0.45 - overrun);
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
