/**
 * @module core/router
 *
 * The fan-out. The router sends one task to many minds at once and gathers what
 * comes back. It is the hive's nervous system: it does not decide — it spreads,
 * times, and collects, then hands the candidates to consensus to be weighed.
 *
 * Concurrency is bounded by a small Promise pool so a hundred nodes do not open
 * a hundred sockets at once. Failures never throw out of the pool; a dead node
 * returns a low-confidence error vote, and the swarm closes the gap around it.
 */

import type { Agent, AgentHiveAccess, ChatOptions, ModelNode, Task, Vote } from "./types.js";

/** Options for a fan-out run. */
export interface RouteOptions {
  /** Max in-flight requests at once. Default 8. */
  readonly concurrency?: number;
  /** Per-request options forwarded to each agent. */
  readonly chat?: ChatOptions;
}

/**
 * Run a bounded-concurrency pool over `items`, applying `work` to each. Order of
 * results matches order of inputs. Rejections are surfaced to the caller's
 * `work` if it chooses to catch; the pool itself never aborts on one failure.
 */
export async function pool<T, R>(
  items: readonly T[],
  work: (item: T, index: number) => Promise<R>,
  concurrency = 8,
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let cursor = 0;
  const width = Math.max(1, Math.min(concurrency, items.length || 1));

  async function runner(): Promise<void> {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await work(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: width }, () => runner()));
  return results;
}

/**
 * Fan a task out across many agents concurrently and collect their votes.
 * Each agent picks its own node from the hive; the router only schedules them.
 */
export async function fanOut(
  agents: readonly Agent[],
  task: Task,
  hive: AgentHiveAccess,
  opts: RouteOptions = {},
): Promise<Vote[]> {
  return pool(agents, (agent) => agent.think(task, hive, opts.chat), opts.concurrency ?? 8);
}

/**
 * Fan a single agent out across many nodes concurrently — the same role, every
 * connected model, asked at once. Used by the `swarm` mode to get model
 * diversity even from one charter. Each result is tagged with the node that
 * produced it so consensus can weigh by tier.
 */
export async function fanAcrossNodes(
  agent: Agent,
  nodes: readonly ModelNode[],
  task: Task,
  run: (node: ModelNode, task: Task, opts?: ChatOptions) => Promise<string>,
  opts: RouteOptions = {},
): Promise<Vote[]> {
  return pool(
    nodes,
    async (node) => {
      const t0 = Date.now();
      try {
        const content = await run(node, task, opts.chat);
        return {
          agent: agent.name,
          node,
          content,
          confidence: heuristicConfidence(content),
          ms: Date.now() - t0,
        } satisfies Vote;
      } catch (err) {
        return {
          agent: agent.name,
          node,
          content: `[${agent.name}@${node.model} failed] ${err instanceof Error ? err.message : String(err)}`,
          confidence: 0,
          ms: Date.now() - t0,
          error: true,
        } satisfies Vote;
      }
    },
    opts.concurrency ?? 8,
  );
}

/** A length-shaped confidence, mirroring the agent base's default curve. */
function heuristicConfidence(content: string): number {
  const len = content.trim().length;
  if (len === 0) return 0;
  const ideal = 600;
  const ratio = Math.min(len, ideal) / ideal;
  return Math.max(0, Math.min(1, 0.45 + ratio * 0.45));
}
