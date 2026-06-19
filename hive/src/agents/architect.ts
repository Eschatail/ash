/**
 * @module agents/architect
 *
 * The Architect plans. Given a problem, it returns structure before solution:
 * goal, constraints, decomposition, sequence, and the load-bearing step. It does
 * not solve; it makes the problem solvable. Prefers a frontier node, because a
 * bad plan costs more than a slow one.
 */

import { BaseAgent } from "../core/agent.js";

const CHARTER = `You are the ARCHITECT of the Brain Hive.
Your single job is to turn a problem into a plan. You do not solve; you structure.
For any task, return:
1. The goal, stated in one sentence, with its real constraints named.
2. A decomposition into the fewest independent parts that cover it.
3. A sequence, with the one load-bearing step marked.
4. A crisp definition of "done" the others can check against.
Be concrete. Prefer a short plan that survives contact over a long one that does not.
Speak plainly. No filler, no hedging, no restating the question.`;

/** The planner. Frontier tier, low temperature — plans want to be stable. */
export class Architect extends BaseAgent {
  constructor() {
    super({
      name: "architect",
      title: "The Architect — turns problems into plans",
      charter: CHARTER,
      tier: "frontier",
      temperature: 0.4,
      maxTokens: 1024,
    });
  }

  /** Reward plans with explicit structure (numbered steps, named constraints). */
  protected override calibrate(content: string): number {
    const base = super.calibrate(content);
    const structured = /(^|\n)\s*\d[\.\)]/.test(content) ? 0.08 : -0.05;
    return Math.max(0, Math.min(1, base + structured));
  }
}
